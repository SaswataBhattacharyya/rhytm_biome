/**
 * In-memory fixture backend for previews and client tests. It mirrors the
 * pilot API's observable rules (apps/api/src/store.ts): per-account isolation,
 * consent before writes, base_revision checks, idempotency receipts keyed by
 * (user, key) with a request hash, inclusive progress counts, refresh-token
 * revocation on sign-out. It is NOT connected to any account; the UI labels
 * it "Fixture preview".
 *
 * The two fixture accounts and their password are public placeholders that
 * only unlock this in-memory preview. They are not the local Auth fixtures.
 */
import { DailyError, type AuthSession, type DailyBackend } from './backend';
import { DAILY_DEFINITION_ID, daysInclusive, localDateIn, type DailyLog, type LogInput, type Profile, type Progress } from './contract';

export const FIXTURE_PASSWORD = 'fixture-preview';
export const FIXTURE_ACCOUNTS = [
  { email: 'ada.fixture@example.test', userId: '00000000-0000-4000-8000-00000000a0da', name: 'Ada (fixture)' },
  { email: 'ben.fixture@example.test', userId: '00000000-0000-4000-8000-00000000b0e0', name: 'Ben (fixture)' },
] as const;

interface UserState {
  profile: Profile;
  consent: 'grant' | 'revoke' | null;
  logs: Map<string, DailyLog>;
  receipts: Map<string, { hash: string; response: unknown }>;
}

export interface FixtureControls {
  /** Every request fails as if the device were offline. */
  offline: boolean;
  /** The next log write commits on the "server" but the response is lost. */
  dropNextResponse: boolean;
  /** Access tokens issued from now on live this many seconds. */
  accessTtl: number;
  /** Simulated latency (ms). */
  latency: number;
}

export interface FixtureBackend extends DailyBackend {
  controls: FixtureControls;
  /** Requests that reached the fake server, by kind. */
  stats: { putLogReceived: number; putLogCommitted: number; putLogReplayed: number };
  /** Simulate an edit made on another device (bumps revision). */
  editElsewhere(userId: string, localDate: string, mood: string | null): DailyLog;
  /** Invalidate every refresh token (simulates an expired session). */
  revokeAllRefreshTokens(): void;
  /** Expire every access token now. */
  expireAccessTokens(): void;
  serverLog(userId: string, localDate: string): DailyLog | null;
}

let seq = 0;
const uuid = () => {
  seq += 1;
  const h = (Date.now().toString(16) + seq.toString(16).padStart(8, '0')).slice(-12).padStart(12, '0');
  return `00000000-0000-4000-8000-${h}`;
};

export function createFixtureBackend(opts: Partial<FixtureControls> & { timezone?: string } = {}): FixtureBackend {
  const controls: FixtureControls = { offline: false, dropNextResponse: false, accessTtl: 3600, latency: 0, ...opts };
  const stats = { putLogReceived: 0, putLogCommitted: 0, putLogReplayed: 0 };
  const users = new Map<string, UserState>();
  const access = new Map<string, { userId: string; exp: number }>();
  const refresh = new Map<string, string>();
  const tz = opts.timezone ?? 'Asia/Kolkata';

  const now = () => Math.floor(Date.now() / 1000);
  const wait = () => (controls.latency ? new Promise((r) => setTimeout(r, controls.latency)) : Promise.resolve());
  const net = async () => {
    await wait();
    if (controls.offline) throw new DailyError('network', 'No connection to the service.');
  };

  function state(userId: string): UserState {
    let s = users.get(userId);
    if (!s) {
      s = {
        profile: { user_id: userId, display_name: null, timezone: tz, locale: 'en-IN', onboarding_state: 'pending', revision: 1 },
        consent: null,
        logs: new Map(),
        receipts: new Map(),
      };
      users.set(userId, s);
    }
    return s;
  }

  function issue(userId: string, email: string): AuthSession {
    const a = `fx-access.${uuid()}`;
    const r = `fx-refresh.${uuid()}`;
    const exp = now() + controls.accessTtl;
    access.set(a, { userId, exp });
    refresh.set(r, userId);
    return { userId, email, accessToken: a, refreshToken: r, expiresAt: exp };
  }

  function who(token: string): UserState {
    const t = access.get(token);
    if (!t || t.exp <= now()) throw new DailyError('unauthorized', 'Sign in to continue.', 401, 'UNAUTHORIZED');
    return state(t.userId);
  }

  const fixtureMoodLog = (userId: string, date: string, rev: number, mood: string | null, prev?: DailyLog): DailyLog => ({
    id: prev?.id ?? uuid(),
    local_date: date,
    timezone: prev?.timezone ?? tz,
    revision: rev,
    definition_version_id: DAILY_DEFINITION_ID,
    status: mood ? 'complete' : 'partial',
    recorded_at: new Date().toISOString(),
    retrospective: prev?.retrospective ?? date < localDateIn(tz).date,
    answers: mood ? [{ question_key: 'mood', value_type: 'single_select', value: mood, source: 'manual' }] : [],
    doses: [],
  });

  const backend: FixtureBackend = {
    mode: 'fixture',
    label: 'in-memory fixture',
    controls,
    stats,
    async signIn(email, password) {
      await net();
      const acct = FIXTURE_ACCOUNTS.find((a) => a.email === email.trim().toLowerCase());
      if (!acct || password !== FIXTURE_PASSWORD) {
        throw new DailyError('invalid_credentials', 'That email and password don’t match a synthetic account.', 400);
      }
      state(acct.userId);
      return issue(acct.userId, acct.email);
    },
    async refresh(s) {
      await net();
      const userId = refresh.get(s.refreshToken);
      if (!userId) throw new DailyError('session_expired', 'Your session has expired. Sign in again.', 400);
      refresh.delete(s.refreshToken); // rotation, like GoTrue
      return issue(userId, s.email);
    },
    async signOut(s) {
      await net();
      for (const [r, u] of refresh) if (u === s.userId) refresh.delete(r);
    },
    async profile(t) {
      await net();
      return { ...who(t).profile };
    },
    async consent(t) {
      await net();
      return { granted: who(t).consent === 'grant' };
    },
    async grantConsent(t) {
      await net();
      who(t).consent = 'grant';
    },
    async getLog(t, date) {
      await net();
      const l = who(t).logs.get(date);
      return l ? structuredCloneish(l) : null;
    },
    async putLog(t, date, input: LogInput, key) {
      await net();
      const u = who(t);
      stats.putLogReceived++;
      if (u.consent !== 'grant') throw new DailyError('consent_required', 'Enable synthetic daily logging first.', 403, 'FORBIDDEN');
      const hash = JSON.stringify({ localDate: date, ...input });
      const receipt = u.receipts.get(key);
      if (receipt) {
        if (receipt.hash !== hash) {
          throw new DailyError('conflict', 'This key has already been used for a different change.', 409, 'IDEMPOTENCY_CONFLICT');
        }
        stats.putLogReplayed++;
        return structuredCloneish(receipt.response as DailyLog);
      }
      const prev = u.logs.get(date);
      if ((prev?.revision ?? 0) !== input.base_revision) {
        throw new DailyError('conflict', 'Reload the current check-in before retrying.', 409, 'REVISION_CONFLICT');
      }
      if (date > localDateIn(prev?.timezone ?? input.timezone).date || (prev && input.timezone !== prev.timezone)) {
        throw new DailyError('validation', 'Use a valid date and the original timezone when editing a check-in.', 422, 'VALIDATION_FAILED');
      }
      const mood = input.answers.find((a) => a.question_key === 'mood')?.value;
      const log = fixtureMoodLog(u.profile.user_id, date, (prev?.revision ?? 0) + 1, typeof mood === 'string' ? mood : null, prev);
      if (!prev) log.timezone = input.timezone;
      u.logs.set(date, log);
      u.receipts.set(key, { hash, response: structuredCloneish(log) });
      stats.putLogCommitted++;
      if (controls.dropNextResponse) {
        controls.dropNextResponse = false;
        throw new DailyError('network', 'No connection to the service.');
      }
      return structuredCloneish(log);
    },
    async progress(t, from, to): Promise<Progress> {
      await net();
      const u = who(t);
      const days = daysInclusive(from, to);
      if (days < 1 || days > 366) throw new DailyError('validation', 'Choose an inclusive range of up to 366 days.', 422);
      let complete = 0;
      let partial = 0;
      for (const l of u.logs.values()) {
        if (l.local_date < from || l.local_date > to) continue;
        if (l.status === 'complete') complete++;
        else partial++;
      }
      return {
        from,
        to,
        as_of: new Date().toISOString(),
        logging: { complete, partial, expected: days },
        adherence: { taken: 0, not_taken: 0, skipped: 0, unknown: 0, scheduled: 0 },
        series: [],
        comparable_reports: [],
      };
    },
    editElsewhere(userId, date, mood) {
      const u = state(userId);
      const prev = u.logs.get(date);
      const log = fixtureMoodLog(userId, date, (prev?.revision ?? 0) + 1, mood, prev);
      u.logs.set(date, log);
      return structuredCloneish(log);
    },
    revokeAllRefreshTokens() {
      refresh.clear();
    },
    expireAccessTokens() {
      for (const v of access.values()) v.exp = 0;
    },
    serverLog(userId, date) {
      const l = users.get(userId)?.logs.get(date);
      return l ? structuredCloneish(l) : null;
    },
  };
  return backend;
}

function structuredCloneish<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}
