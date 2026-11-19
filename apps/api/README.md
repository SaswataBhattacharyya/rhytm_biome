# Local synthetic daily check-in API

The API is a NestJS application with the Fastify adapter. It verifies local Supabase Auth access tokens using the configured issuer's asymmetric JWKS. The database uses a private schema, a limited runtime login, and per-transaction row policies. Use only generated synthetic data. Starting the API requires `RB_SYNTHETIC_PILOT=1` and binds it to loopback.

From the workspace root, install and build with `npm ci` and `npm run build`. To check generated client types, run `npm run contract:generate -w @rb/api-client -- --check`. Regenerate without `--check` when the implemented OpenAPI routes change.

## Fresh local environment

Reuse the existing services if they are already running. These commands create two dedicated containers and two local fixture files. The database on port 55432 is disposable. The passwords below are public placeholders for these loopback-only test roles. The signing key and account passwords are generated separately with mode 0600.

```bash
docker network create rhythm-biome-pilot
docker run -d --rm --name rhythm-biome-foundation-test --network rhythm-biome-pilot \
  -e POSTGRES_PASSWORD=local-test-admin -p 127.0.0.1:55432:5432 \
  postgres@sha256:a77aa70e641402a21411b92b721c58d10f23b50ae5fdd2333efd22d166e1e5f7
docker exec rhythm-biome-foundation-test pg_isready -U postgres
# Continue once pg_isready reports that PostgreSQL accepts connections.
docker exec -i rhythm-biome-foundation-test psql -U postgres -v ON_ERROR_STOP=1 --single-transaction \
  < supabase/migrations/20261118000100_daily_foundation.sql
docker exec rhythm-biome-foundation-test psql -U postgres -v ON_ERROR_STOP=1 -c \
  "create role rb_test login password 'local-test-api'; grant rb_api to rb_test; create role rb_auth login password 'local-test-auth'; create schema auth authorization rb_auth;"

node apps/api/scripts/generate-auth-fixture.mjs /tmp/rhythm-biome-pilot-auth.env /tmp/rhythm-biome-pilot-accounts.json
docker run -d --rm --name rhythm-biome-pilot-auth --network rhythm-biome-pilot \
  --env-file /tmp/rhythm-biome-pilot-auth.env -p 127.0.0.1:55433:9999 supabase/gotrue:v2.197.0
```

Run the API in a separate terminal.

```bash
RB_SYNTHETIC_PILOT=1 \
  DATABASE_URL=postgresql://rb_test:local-test-api@127.0.0.1:55432/postgres \
  SUPABASE_AUTH_ISSUER=http://127.0.0.1:55433 WEB_ORIGIN=http://localhost:3210 PORT=3211 \
  npm run start -w @rb/api
```

Run the real sign-in smoke test after `http://127.0.0.1:55433/health` responds. The smoke provisions both `example.test` accounts in local Auth and exercises check-in, isolation, refresh and logout. It does not print fixture passwords or tokens.

```bash
RB_SYNTHETIC_ACCOUNTS_FILE=/tmp/rhythm-biome-pilot-accounts.json node apps/api/scripts/auth-smoke.mjs
```

API paths and response shapes are in [the core contract](../../Rhythm_Biome_Codex_Planning_Pack_v0.4/18_OPENAPI.yaml). The generated `@rb/api-client` handles the currently implemented paths. Framework reference for the HTTP adapter and JWT verification. [NestJS Fastify guide](https://docs.nestjs.com/techniques/performance) · [Supabase JWT guide](https://supabase.com/docs/guides/auth/jwts)

## Pilot behavior

- Web preview uses the local API at `http://127.0.0.1:3211` and Auth at `http://127.0.0.1:55433`. Android can use the same loopback addresses with ADB reverse for ports 3211 and 55433. Auth is a standalone local GoTrue service. Its auth endpoints are directly under the base URL.
- Use an exact `Idempotency-Key` on each consent or log write. Keep it with the queued payload across network failures or process restarts. Use `base_revision: 0` for a missing day. Once a log exists, use its current revision. A stale revision or reusing a key for changed data returns 409. Keep the unsent change and show a reload/reconcile choice.
- Current definition ID is `7ec13659-af4c-4ccf-b7c0-778ee655deed`. Allowed manual mood values are `low`, `meh`, `okay`, `good`, and `great`. A complete check-in sends one mood answer and an empty `dose_outcomes` array. A partial check-in may omit the mood by sending an empty `answers` array. The sample grant is `synthetic_daily_logging` / `demo-1`. Real consent, account lifecycle, routines, and report data are follow-on work.
- A logged day affects the completed or partial count. A missing day contributes to expected coverage only. The pilot has no adherence or clinical data.
- Logout invalidates the refresh token. Signed access tokens can remain valid until expiry. Both clients must clear their local session and user-scoped cached data on logout. Verify account changes with two synthetic accounts.

The database schema was exercised with PostgreSQL and the application with the separately running Supabase Auth service. Full Supabase local-stack setup, approved notices and production account lifecycle are future work.

## Synthetic catalogue

Apply the catalogue migration after the daily foundation. For an existing pilot, apply this migration once. Seed the published read model using the same sample data as the design-lab fixture.

```bash
docker exec -i rhythm-biome-foundation-test psql -U postgres -v ON_ERROR_STOP=1 --single-transaction \
  < supabase/migrations/20261119000100_catalogue_public_reads.sql
RB_CATALOGUE_SEED_DATABASE_URL=postgresql://postgres:local-test-admin@127.0.0.1:55432/postgres \
  node apps/api/scripts/seed-catalogue.mjs
```

The seed leaves existing rows intact. The API runtime role can read only published catalogue rows and has no catalogue write grants. The four public routes require no sign-in. Missing and unpublished details return 404. Enable connected reads with `NEXT_PUBLIC_RB_CATALOG_SOURCE=api` on web and `EXPO_PUBLIC_RB_CATALOG_SOURCE=api` on Android, using the existing API base settings.


## Sandbox cart

Apply the cart migration after both catalogue and check-in migrations. Run the tests after the catalogue seed so the cart suite has the synthetic kit and enabled and disabled pouch sizes.

```bash
docker exec -i rhythm-biome-foundation-test psql -U postgres -v ON_ERROR_STOP=1 --single-transaction \
  < supabase/migrations/20261119000200_sandbox_cart.sql
RB_TEST_DATABASE_URL=postgresql://rb_test:local-test-api@127.0.0.1:55432/postgres npm test
```

All cart endpoints require a signed-in synthetic account. One cart persists per account across web and Android.

| Operation | Request |
| --- | --- |
| Open or resume | `POST /v1/carts` with an `Idempotency-Key` and no body. Use a fresh key for a new open operation. |
| Reload | `GET /v1/carts/{id}` |
| Add or set quantity | `PUT /v1/carts/{id}/items/{line_id}` with `Idempotency-Key` and `{ kind, subject_id, quantity, base_revision }`. Use a client-generated UUID on add and reuse the existing line ID for an existing kind and subject. `kind` is `test` or `sku`. Send the desired final quantity from 1 to 10. |
| Remove | `DELETE /v1/carts/{id}/items/{line_id}?base_revision=N` with `Idempotency-Key` |

Every success returns `{ data: Cart }`. Use the returned revision for the next change. Keep the same key, route and payload when retrying an operation with an unknown outcome. A successful retry replays its original cart snapshot. It may be older than a cart you just read. On a revision conflict, reload before offering a new edit. The server rejects missing, unpublished or unavailable items and prevents duplicate lines for the same kit or SKU. The stored unit price is the catalogue price at the last accepted line change. Label cart totals as estimated. Shipping, quotes, orders and payments are outside this cart slice.
