import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { exportJWK, generateKeyPair } from 'jose';

const [envPath, accountsPath] = process.argv.slice(2);
assert(envPath && accountsPath, 'Supply a private Auth env path and synthetic accounts path.');
const { privateKey } = await generateKeyPair('ES256', { extractable: true });
const signingKey = {
  ...await exportJWK(privateKey), alg: 'ES256', kid: randomUUID(), key_ops: ['sign', 'verify'],
};
const env = {
  API_EXTERNAL_URL: 'http://127.0.0.1:55433',
  GOTRUE_SITE_URL: 'http://localhost:3210',
  GOTRUE_API_HOST: '0.0.0.0',
  GOTRUE_API_PORT: '9999',
  GOTRUE_DB_DRIVER: 'postgres',
  GOTRUE_DB_DATABASE_URL: 'postgres://rb_auth:local-test-auth@rhythm-biome-foundation-test:5432/postgres?sslmode=disable&search_path=auth',
  DB_NAMESPACE: 'auth',
  GOTRUE_JWT_SECRET: randomBytes(48).toString('base64url'),
  GOTRUE_JWT_KEYS: JSON.stringify([signingKey]),
  GOTRUE_JWT_ISSUER: 'http://127.0.0.1:55433',
  GOTRUE_JWT_AUD: 'authenticated',
  GOTRUE_JWT_DEFAULT_GROUP_NAME: 'authenticated',
  GOTRUE_EXTERNAL_EMAIL_ENABLED: 'true',
  GOTRUE_MAILER_AUTOCONFIRM: 'true',
  GOTRUE_DISABLE_SIGNUP: 'false',
  GOTRUE_LOG_LEVEL: 'warn',
};
const accounts = ['review-a', 'review-b'].map(name => ({
  email: name + '@example.test',
  password: randomBytes(27).toString('base64url'),
}));
writeFileSync(envPath, Object.entries(env).map(entry => entry.join('=')).join('\n') + '\n', { mode: 0o600, flag: 'wx' });
writeFileSync(accountsPath, JSON.stringify(accounts), { mode: 0o600, flag: 'wx' });
