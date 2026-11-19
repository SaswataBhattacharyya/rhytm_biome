import { Pool } from 'pg';
import { createApp, sessionVerifier } from './app.js';

async function main() {
  const { DATABASE_URL, SUPABASE_AUTH_ISSUER, WEB_ORIGIN, RB_SYNTHETIC_PILOT } = process.env;
  if (RB_SYNTHETIC_PILOT !== '1' || !DATABASE_URL || !SUPABASE_AUTH_ISSUER) throw new Error('Missing pilot configuration.');
  const issuer = new URL(SUPABASE_AUTH_ISSUER);
  if (!['http:', 'https:'].includes(issuer.protocol) || !['127.0.0.1', 'localhost'].includes(issuer.hostname)) {
    throw new Error('The pilot requires a local issuer.');
  }
  const pool = new Pool({ connectionString: DATABASE_URL });
  pool.on('error', () => console.error('Idle database connection lost.'));
  const { rows: [role] } = await pool.query(`
    select not (rolsuper or rolbypassrls or rolcreaterole)
      and pg_has_role(current_user, 'rb_api', 'usage')
      and not pg_has_role(current_user, nspowner, 'member') as restricted
    from pg_roles, pg_namespace where rolname = current_user and nspname = 'rb_private'
  `);
  if (!role?.restricted) throw new Error('A restricted API database role is required.');
  const app = await createApp(pool, sessionVerifier(issuer), WEB_ORIGIN);
  await app.listen(Number(process.env.PORT ?? 3001), '127.0.0.1');
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.once(signal, async () => {
      await app.close();
      await pool.end();
    });
  }
  console.log('Rhythm Biome API listening on loopback.');
}

main().catch(() => {
  console.error('Rhythm Biome API failed to start. Check port, issuer, migration and database role configuration.');
  process.exit(1);
});
