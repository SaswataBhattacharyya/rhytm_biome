import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { createDailyClient } from '@rb/api-client';
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from 'jose';
import { Pool } from 'pg';
import { createApp, sessionVerifier } from '../src/app.js';
import { localDateAt, logDefinitionId, syntheticNotice } from '../src/daily-contract.js';

test('local date follows the selected timezone across midnight', () => {
  const instant = new Date('2026-11-18T20:15:00Z');
  assert.equal(localDateAt('Asia/Kolkata', instant), '2026-11-19');
  assert.equal(localDateAt('America/Los_Angeles', instant), '2026-11-18');
});

test('two signed sessions, durable check-in and sandbox cart', async () => {
  const databaseUrl = process.env.RB_TEST_DATABASE_URL;
  assert(databaseUrl, 'RB_TEST_DATABASE_URL must point at a disposable migrated database.');
  const issuer = new URL('http://127.0.0.1:54321/auth/v1');
  const { publicKey, privateKey } = await generateKeyPair('ES256');
  const verify = sessionVerifier(issuer, createLocalJWKSet({ keys: [await exportJWK(publicKey)] }));
  const userA = randomUUID();
  const userB = randomUUID();
  const sign = (sub: string, audience = 'authenticated', expiry = '10m') =>
    new SignJWT({ role: 'authenticated' }).setProtectedHeader({ alg: 'ES256' }).setSubject(sub)
      .setIssuer(issuer.href).setAudience(audience).setExpirationTime(expiry).sign(privateKey);
  const tokenA = await sign(userA);
  const tokenB = await sign(userB);
  let pool = new Pool({ connectionString: databaseUrl });
  let app = await createApp(pool, verify);
  await app.init();

  const request = async (method: 'GET' | 'PATCH' | 'PUT' | 'POST' | 'DELETE', url: string, token?: string, payload?: object, key?: string) => {
    const result = await app.inject({
      method, url, payload,
      headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(key ? { 'idempotency-key': key } : {}) },
    });
    return { status: result.statusCode, body: result.json(), headers: result.headers };
  };
  const today = localDateAt('Asia/Kolkata');
  const range = { from: '2020-01-01', to: '2020-01-07' };
  const progress = '/v1/me/progress?' + new URLSearchParams(range);
  const logUrl = '/v1/me/logs/2020-01-03';
  const input = {
    base_revision: 0, timezone: 'Asia/Kolkata', definition_version_id: logDefinitionId, status: 'complete',
    answers: [{ question_key: 'mood', value_type: 'single_select', value: 'okay', source: 'manual' }], dose_outcomes: [],
  };
  const grant = { ...syntheticNotice, action: 'grant' };

  try {
    for (const invalid of [undefined, 'forged.token', await sign(userA, 'wrong-aud'), await sign(userA, 'authenticated', '1s ago')]) {
      assert.equal((await request('GET', '/v1/me', invalid)).status, 401);
    }
    const profile = await request('GET', '/v1/me', tokenA);
    assert.equal(profile.body.data.user_id, userA);
    assert.equal(profile.headers['cache-control'], 'private, no-store');
    assert.equal((await request('PATCH', '/v1/me', tokenA, { base_revision: 1, user_id: userB })).status, 422);
    assert.equal((await request('PATCH', '/v1/me', tokenA, { base_revision: 1, display_name: 'Synthetic' })).body.data.revision, 2);
    assert.equal((await request('PATCH', '/v1/me', tokenA, { base_revision: 1, display_name: null })).status, 409);
    assert.equal((await request('PATCH', '/v1/me', tokenA, { base_revision: 2, display_name: null })).body.data.display_name, null);
    assert.equal((await request('GET', '/v1/me/bootstrap', tokenA)).body.data.today_log_status, 'none');

    assert.equal((await request('PUT', logUrl, tokenA, input, 'daily-create')).status, 403);
    assert.equal((await request('PUT', '/v1/me/consents', tokenA, { ...grant, policy_version: 'unknown' }, 'consent-grant')).status, 422);
    const [first, repeat] = await Promise.all(Array.from({ length: 2 }, () =>
      request('PUT', '/v1/me/consents', tokenA, grant, 'consent-grant')));
    assert.equal(first.status, 200);
    assert.deepEqual(first.body, repeat.body);
    assert.equal((await request('GET', '/v1/me/consents', tokenA)).body.data.length, 1);
    assert.deepEqual((await request('GET', '/v1/me/consents', tokenB)).body.data, []);
    assert.equal((await request('PUT', '/v1/me/consents', tokenA, { ...grant, action: 'revoke' }, 'consent-grant')).status, 409);

    const [saved, concurrent] = await Promise.all([
      request('PUT', logUrl, tokenA, input, 'daily-create'),
      request('PUT', logUrl, tokenA, input, 'daily-create'),
    ]);
    assert.equal(saved.status, 200);
    assert.deepEqual(concurrent.body, saved.body);
    assert.equal(saved.body.data.revision, 1);
    assert.equal(saved.body.data.retrospective, true);
    assert.equal((await request('GET', logUrl, tokenB)).status, 404);
    assert.deepEqual((await request('GET', progress, tokenB)).body.data.logging, { complete: 0, partial: 0, expected: 7 });
    assert.equal((await request('PUT', logUrl, tokenA, input, 'another-key')).body.error.code, 'REVISION_CONFLICT');
    assert.equal((await request('PUT', logUrl, tokenA, { ...input, base_revision: 1 }, 'daily-create')).body.error.code, 'IDEMPOTENCY_CONFLICT');
    assert.equal((await request('PUT', `/v1/me/logs/${today}`, tokenA, { ...input, status: 'partial', answers: [] }, 'today-log')).status, 200);
    assert.equal((await request('GET', '/v1/me/bootstrap', tokenA)).body.data.today_log_status, 'partial');

    assert.equal((await request('POST', '/v1/carts', undefined, undefined, 'cart-open-a')).status, 401);
    const opened = await request('POST', '/v1/carts', tokenA, undefined, 'cart-open-a');
    assert.equal(opened.status, 201);
    const cartUrl = '/v1/carts/' + opened.body.data.id;
    const testLine = cartUrl + '/items/' + randomUUID();
    const skuLine = cartUrl + '/items/' + randomUUID();
    const testItem = { kind: 'test', subject_id: 'a0000000-0000-4000-8000-000000000001', quantity: 1, base_revision: 1 };
    const skuItem = { kind: 'sku', subject_id: 'b0000000-0000-4000-8000-000000000002', quantity: 1, base_revision: 2 };
    const [addedKit, kitRetry] = await Promise.all([
      request('PUT', testLine, tokenA, testItem, 'cart-add-kit'),
      request('PUT', testLine, tokenA, testItem, 'cart-add-kit'),
    ]);
    assert.equal(addedKit.status, 200);
    assert.deepEqual(addedKit.body, kitRetry.body);
    assert.equal(addedKit.body.data.items[0].unit_price_paise, 249900);
    assert.equal((await request('PUT', skuLine, tokenA, { ...skuItem, base_revision: 1 }, 'cart-stale')).body.error.code, 'REVISION_CONFLICT');
    assert.equal((await request('PUT', skuLine, tokenA, { ...skuItem, subject_id: 'b0000000-0000-4000-8000-000000000003' }, 'cart-unavailable')).body.error.code, 'ITEM_UNAVAILABLE');
    const addedBoth = await request('PUT', skuLine, tokenA, skuItem, 'cart-add-sku');
    assert.equal(addedBoth.status, 200);
    assert.deepEqual(addedBoth.body.data.items.map((line: { kind: string }) => line.kind), ['test', 'sku']);
    assert.equal(addedBoth.body.data.items[1].option_label, 'Small');
    assert.equal((await request('GET', cartUrl, tokenB)).status, 404);
    assert.equal((await request('PUT', skuLine, tokenB, skuItem, 'cart-other')).status, 404);
    assert.deepEqual((await request('POST', '/v1/carts', tokenB, undefined, 'cart-open-b')).body.data.items, []);
    const [qtyA, qtyB] = await Promise.all([
      request('PUT', skuLine, tokenA, { ...skuItem, base_revision: 3, quantity: 2 }, 'cart-qty-a'),
      request('PUT', skuLine, tokenA, { ...skuItem, base_revision: 3, quantity: 3 }, 'cart-qty-b'),
    ]);
    assert.deepEqual([qtyA.status, qtyB.status].sort(), [200, 409]);
    const updatedCart = [qtyA, qtyB].find(result => result.status === 200)!.body;
    assert.deepEqual((await request('GET', cartUrl, tokenA)).body, updatedCart);

    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query("select set_config('rb.user_id', $1, true)", [userB]);
      assert.equal((await client.query('select id from rb_private.daily_logs')).rowCount, 0);
      await client.query('rollback');
      assert.equal((await client.query('select user_id from rb_private.profiles')).rowCount, 0);
      await assert.rejects(client.query('update rb_private.audit_events set created_at = now()'), { code: '42501' });
    } finally {
      client.release();
    }

    await app.close();
    await pool.end();
    pool = new Pool({ connectionString: databaseUrl });
    app = await createApp(pool, verify);
    await app.listen(0, '127.0.0.1');

    assert.deepEqual((await request('PUT', logUrl, tokenA, input, 'daily-create')).body, saved.body);
    assert.deepEqual((await request('POST', '/v1/carts', tokenA, undefined, 'cart-resume')).body, updatedCart);
    const removed = await request('DELETE', testLine + '?base_revision=4', tokenA, undefined, 'cart-remove');
    assert.equal(removed.status, 200);
    assert.equal(removed.body.data.items.length, 1);
    assert.deepEqual((await request('DELETE', testLine + '?base_revision=4', tokenA, undefined, 'cart-remove')).body, removed.body);
    const clientAPI = createDailyClient(await app.getUrl(), () => tokenA);
    const { data, response } = await clientAPI.GET('/v1/me/progress', { params: { query: range } });
    assert.equal(response.status, 200);
    assert.deepEqual(data?.data.logging, { complete: 1, partial: 0, expected: 7 });
    assert.equal((await request('PUT', '/v1/me/consents', tokenA, { ...grant, action: 'revoke' }, 'consent-revoke')).status, 200);
    assert.equal((await request('PUT', logUrl, tokenA, input, 'daily-create')).status, 403);
    assert.equal((await request('GET', '/v1/me/consents', tokenA)).body.data.length, 2);
    const firstPage = await request('GET', '/v1/me/consents?limit=1', tokenA);
    const cursor = firstPage.body.meta.next_cursor;
    assert.equal(firstPage.body.data[0].action, 'revoke');
    const secondPage = await request('GET', `/v1/me/consents?limit=1&cursor=${cursor}`, tokenA);
    assert.equal(secondPage.body.data[0].action, 'grant');
    assert.equal(secondPage.body.meta.next_cursor, null);
    assert.equal((await request('GET', `/v1/me/consents?cursor=${cursor}`, tokenB)).status, 422);
  } finally {
    await app.close();
    await pool.end();
  }
});
