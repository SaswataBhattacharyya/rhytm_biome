import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
const authRoot = 'http://127.0.0.1:55433';
const api = 'http://127.0.0.1:3211';
const accountPath = process.env.RB_SYNTHETIC_ACCOUNTS_FILE;
assert(accountPath, 'Set RB_SYNTHETIC_ACCOUNTS_FILE to the local synthetic account fixture.');
const auth = (path, body) => fetch(authRoot + path, {method:'POST', headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
const accounts = JSON.parse(fs.readFileSync(accountPath, 'utf8'));
const keyset = await fetch(authRoot + '/.well-known/jwks.json');
assert.equal(keyset.status, 200);
assert((await keyset.json()).keys.some(key => key.alg === 'ES256' && !key.d));
const sessions = [];
for (const account of accounts) {
  const signup = await auth('/signup', account);
  if (!signup.ok && signup.status !== 422) throw new Error('Synthetic Auth signup status: ' + signup.status);
  const login = await auth('/token?grant_type=password', account);
  assert.equal(login.status, 200, 'Synthetic password sign-in');
  const session = await login.json();
  const claims = JSON.parse(Buffer.from(session.access_token.split('.')[1], 'base64url'));
  assert.equal(claims.role, 'authenticated');
  assert.equal(claims.iss, authRoot);
  sessions.push(session);
}
const call = (path, user, method = 'GET', input) => fetch(api + path, {
  method, headers: {Authorization:'Bearer ' + sessions[user].access_token, ...(input ? {
    'Idempotency-Key': path === '/v1/me/consents' ? 'relay05-smoke-grant' : randomUUID(), 'Content-Type':'application/json'
  } : {})}, body: input && JSON.stringify(input)
});
const [a,b] = await Promise.all([call('/v1/me',0), call('/v1/me',1)]);
assert.equal(a.status,200);
assert.equal(b.status,200);
assert.notEqual((await a.json()).data.user_id,(await b.json()).data.user_id);
assert.equal((await call('/v1/me/consents',0,'PUT',{purpose:'synthetic_daily_logging',policy_version:'demo-1',action:'grant'})).status,200);
const logPath = '/v1/me/logs/2026-01-05';
const before = await call(logPath, 0);
if (before.status === 404) {
  const saved = await call(logPath,0,'PUT',{base_revision:0,timezone:'Asia/Kolkata',
    definition_version_id:'7ec13659-af4c-4ccf-b7c0-778ee655deed',status:'complete',
    answers:[{question_key:'mood',value_type:'single_select',value:'good',source:'manual'}],dose_outcomes:[]});
  assert.equal(saved.status,200);
}
assert.equal((await call(logPath,1)).status,404);
const progress = await call('/v1/me/progress?from=2026-01-01&to=2026-01-07',0);
assert.deepEqual((await progress.json()).data.logging,{complete:1,partial:0,expected:7});
const renewed = await auth('/token?grant_type=refresh_token',{refresh_token:sessions[0].refresh_token});
assert.equal(renewed.status,200);
const refreshed = await renewed.json();
const logout = await fetch(authRoot+'/logout',{method:'POST',headers:{Authorization:'Bearer '+refreshed.access_token}});
assert.equal(logout.status,204);
const revoked = await auth('/token?grant_type=refresh_token', {refresh_token: refreshed.refresh_token});
assert.equal(revoked.status, 400);
console.log('Real local Supabase Auth: ES256 JWKS, two password sessions, API authentication, check-in isolation, refresh and logout passed.');
