import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';

const databaseUrl = process.env.RB_CATALOGUE_SEED_DATABASE_URL;
if (!databaseUrl || !['127.0.0.1', 'localhost'].includes(new URL(databaseUrl).hostname)) {
  throw new Error('Set RB_CATALOGUE_SEED_DATABASE_URL to a local pilot database connection.');
}
const { tests, products } = JSON.parse(await readFile(
  new URL('../../../design-lab/shared/src/catalog-fixture.json', import.meta.url), 'utf8',
));
const pool = new Pool({ connectionString: databaseUrl });
try {
  const client = await pool.connect();
  try {
    await client.query('begin');
    for (const [kind, entries, key] of [['test', tests, 'id'], ['product', products, 'slug']]) {
      for (const entry of entries) {
        await client.query(
          `insert into rb_private.catalogue_entries (kind, lookup_key, document, published)
           values ($1, $2, $3, true) on conflict (kind, lookup_key) do nothing`,
          [kind, entry[key], entry],
        );
      }
    }
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}
