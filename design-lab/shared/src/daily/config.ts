/**
 * Backend selection. Connected only when both base URLs are configured
 * (web: NEXT_PUBLIC_RB_API_BASE / NEXT_PUBLIC_RB_AUTH_BASE; Android:
 * EXPO_PUBLIC_RB_API_BASE / EXPO_PUBLIC_RB_AUTH_BASE). Otherwise the
 * fixture adapter is used and the UI says "Fixture preview".
 */
import type { DailyBackend } from './backend';
import { createFixtureBackend } from './fixture';
import { createHttpBackend } from './http';

export interface BackendEnv {
  apiBase?: string;
  authBase?: string;
  /** Force the fixture adapter (e.g. ?backend=fixture in review). */
  forceFixture?: boolean;
}

export function selectBackend(env: BackendEnv): DailyBackend {
  if (!env.forceFixture && env.apiBase && env.authBase) {
    return createHttpBackend({ apiBase: env.apiBase, authBase: env.authBase });
  }
  return createFixtureBackend();
}
