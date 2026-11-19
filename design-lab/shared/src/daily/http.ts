/**
 * Connected adapter: local Supabase Auth (GoTrue, endpoints directly under
 * the base URL) + the synthetic daily API (apps/api). Paths and shapes follow
 * the generated contract types. Tokens are only ever placed in the
 * Authorization header; they are never logged or put in URLs.
 */
import { DailyError, type AuthSession, type ConsentState, type DailyBackend } from './backend';
import { SYNTHETIC_NOTICE, type ApiErrorBody, type DailyLog, type LogInput, type Profile, type Progress } from './contract';

export interface HttpBackendConfig {
  apiBase: string;
  authBase: string;
  /** Injected for tests; defaults to global fetch. */
  fetch?: typeof fetch;
  timeoutMs?: number;
}

type GoTrueSession = {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  expires_at?: number;
  user?: { id?: string; email?: string };
};

const trim = (u: string) => u.replace(/\/+$/, '');

export function createHttpBackend(cfg: HttpBackendConfig): DailyBackend {
  const api = trim(cfg.apiBase);
  const auth = trim(cfg.authBase);
  const doFetch = cfg.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const timeoutMs = cfg.timeoutMs ?? 15000;

  async function send(url: string, init: RequestInit): Promise<Response> {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
    try {
      return await doFetch(url, { ...init, signal: ctrl?.signal });
    } catch {
      throw new DailyError('network', 'No connection to the service.');
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function apiError(res: Response): Promise<DailyError> {
    let code = '';
    let message = 'Request temporarily unavailable.';
    try {
      const body = (await res.json()) as ApiErrorBody;
      code = body.error?.code ?? '';
      if (body.error?.message && res.status < 500) message = body.error.message;
    } catch {
      /* non-JSON body */
    }
    const s = res.status;
    if (s === 401) return new DailyError('unauthorized', 'Sign in to continue.', s, code || 'UNAUTHORIZED');
    if (s === 403) return new DailyError('consent_required', message, s, code || 'FORBIDDEN');
    if (s === 404) return new DailyError('not_found', message, s, code || 'NOT_FOUND');
    if (s === 409) return new DailyError('conflict', message, s, code || 'CONFLICT');
    if (s === 400 || s === 422) return new DailyError('validation', message, s, code || 'VALIDATION_FAILED');
    return new DailyError('unavailable', 'Request temporarily unavailable.', s, code || 'UNAVAILABLE');
  }

  async function call<T>(token: string, method: string, path: string, opts: { body?: unknown; key?: string } = {}): Promise<T> {
    const headers: Record<string, string> = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    if (opts.key) headers['Idempotency-Key'] = opts.key;
    const res = await send(api + path, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
    if (!res.ok) throw await apiError(res);
    return (await res.json()) as T;
  }

  async function token(grant: 'password' | 'refresh_token', body: object, onReject: 'invalid_credentials' | 'session_expired') {
    const res = await send(`${auth}/token?grant_type=${grant}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.status === 400 || res.status === 401 || res.status === 403 || res.status === 422) {
      throw new DailyError(
        onReject,
        onReject === 'invalid_credentials' ? 'That email and password don’t match a synthetic account.' : 'Your session has expired. Sign in again.',
        res.status,
      );
    }
    if (!res.ok) throw new DailyError('unavailable', 'Sign-in is temporarily unavailable.', res.status);
    const s = (await res.json()) as GoTrueSession;
    if (!s.access_token || !s.refresh_token || !s.user?.id) throw new DailyError('unavailable', 'Unexpected sign-in response.', res.status);
    const now = Math.floor(Date.now() / 1000);
    return {
      userId: s.user.id,
      email: s.user.email ?? '',
      accessToken: s.access_token,
      refreshToken: s.refresh_token,
      expiresAt: s.expires_at ?? now + (s.expires_in ?? 3600),
    } satisfies AuthSession;
  }

  return {
    mode: 'connected',
    label: (() => {
      try {
        return new URL(api).host;
      } catch {
        return api;
      }
    })(),
    signIn: (email, password) => token('password', { email, password }, 'invalid_credentials'),
    refresh: (s) => token('refresh_token', { refresh_token: s.refreshToken }, 'session_expired'),
    async signOut(s) {
      try {
        // scope=local ends only this client's session, so signing out on the
        // web doesn't revoke the phone's refresh token (GoTrue defaults to global).
        await send(`${auth}/logout?scope=local`, { method: 'POST', headers: { Authorization: `Bearer ${s.accessToken}` } });
      } catch {
        /* local sign-out still proceeds; the refresh token expires server-side */
      }
    },
    async profile(t) {
      return (await call<{ data: Profile }>(t, 'GET', '/v1/me')).data;
    },
    async consent(t): Promise<ConsentState> {
      // GET /v1/me/consents → { data: ConsentEvent[], meta } (newest first).
      const page = await call<{ data: { purpose: string; policy_version: string; action: string }[] }>(t, 'GET', '/v1/me/consents?limit=100');
      const latest = page.data.find((e) => e.purpose === SYNTHETIC_NOTICE.purpose && e.policy_version === SYNTHETIC_NOTICE.policy_version);
      return { granted: latest?.action === 'grant' };
    },
    async grantConsent(t, key) {
      await call(t, 'PUT', '/v1/me/consents', { body: { ...SYNTHETIC_NOTICE, action: 'grant' }, key });
    },
    async getLog(t, date) {
      try {
        return (await call<{ data: DailyLog }>(t, 'GET', `/v1/me/logs/${encodeURIComponent(date)}`)).data;
      } catch (e) {
        if (e instanceof DailyError && e.kind === 'not_found') return null;
        throw e;
      }
    },
    async putLog(t, date, input: LogInput, key) {
      return (await call<{ data: DailyLog }>(t, 'PUT', `/v1/me/logs/${encodeURIComponent(date)}`, { body: input, key })).data;
    },
    async progress(t, from, to) {
      const q = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
      return (await call<{ data: Progress }>(t, 'GET', `/v1/me/progress?${q}`)).data;
    },
  };
}
