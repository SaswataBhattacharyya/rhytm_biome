/**
 * Session manager shared by web and Android.
 *
 *  - Web: SessionStore over MemoryKV → tokens live only in page memory; a
 *    reload signs the user out (no browser-storage persistence of tokens).
 *  - Android: SessionStore over the secure-storage port → survives restart.
 *
 * Access tokens are refreshed once on 401 (single-flight). A rejected refresh
 * moves to `expired`, which keeps the user id so that user's queued
 * check-ins stay on the device until the same account signs in again.
 */
/// <reference lib="dom" />
import { DailyError, isDailyError, userKey, type AuthSession, type DailyBackend, type SecureKV } from './backend';

const SESSION_KEY = 'rb.session.v1';
const PROFILE_TZ_KEY = (userId: string) => `rb.tz.v1.${userKey(userId)}`;

export type SessionStatus = 'restoring' | 'signedOut' | 'signedIn' | 'expired';

export interface SessionState {
  status: SessionStatus;
  /** Present when signedIn; when expired only userId/email are meaningful. */
  session: AuthSession | null;
  /** Last user id seen on this device (kept while expired). */
  userId: string | null;
  email: string | null;
}

type Listener = (s: SessionState) => void;

export class SessionManager {
  private st: SessionState = { status: 'restoring', session: null, userId: null, email: null };
  private listeners = new Set<Listener>();
  private refreshing: Promise<AuthSession> | null = null;
  /** Called with the user id whose local data must be wiped (sign-out). */
  onSignedOut: ((userId: string) => Promise<void> | void) | null = null;

  constructor(
    readonly backend: DailyBackend,
    private readonly kv: SecureKV,
  ) {}

  get state() {
    return this.st;
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private set(next: SessionState) {
    this.st = next;
    for (const fn of this.listeners) fn(next);
  }

  /** Restore a persisted session (Android) or start signed out (web). */
  async restore(): Promise<SessionState> {
    let saved: (AuthSession & { expired?: boolean }) | null = null;
    try {
      const raw = await this.kv.getItem(SESSION_KEY);
      saved = raw ? (JSON.parse(raw) as AuthSession & { expired?: boolean }) : null;
    } catch {
      saved = null;
    }
    if (!saved?.userId) {
      this.set({ status: 'signedOut', session: null, userId: null, email: null });
      return this.st;
    }
    if (saved.expired) {
      this.set({ status: 'expired', session: null, userId: saved.userId, email: saved.email });
      return this.st;
    }
    this.set({ status: 'signedIn', session: saved, userId: saved.userId, email: saved.email });
    return this.st;
  }

  async signIn(email: string, password: string): Promise<AuthSession> {
    const s = await this.backend.signIn(email, password);
    await this.persist(s);
    this.set({ status: 'signedIn', session: s, userId: s.userId, email: s.email });
    return s;
  }

  /**
   * Sign out: invalidate the refresh token (best effort), clear the stored
   * session and wipe the user's local data through onSignedOut.
   */
  async signOut(): Promise<void> {
    const { session, userId } = this.st;
    if (session) await this.backend.signOut(session).catch(() => undefined);
    await this.kv.deleteItem(SESSION_KEY).catch(() => undefined);
    if (userId) {
      await this.kv.deleteItem(PROFILE_TZ_KEY(userId)).catch(() => undefined);
      await this.onSignedOut?.(userId);
    }
    this.set({ status: 'signedOut', session: null, userId: null, email: null });
  }

  /** Remember the profile timezone so the Log can pick dates offline after restart. */
  async rememberTimezone(userId: string, timezone: string) {
    await this.kv.setItem(PROFILE_TZ_KEY(userId), timezone).catch(() => undefined);
  }

  async knownTimezone(userId: string): Promise<string | null> {
    return this.kv.getItem(PROFILE_TZ_KEY(userId)).catch(() => null);
  }

  /**
   * Run an API call with a valid access token. Refreshes ahead of expiry and
   * once after a 401. Throws DailyError('session_expired') when the account
   * must sign in again, or the original error otherwise.
   */
  async authorized<T>(work: (accessToken: string) => Promise<T>): Promise<T> {
    let s = this.st.session;
    if (this.st.status === 'expired') throw new DailyError('session_expired', 'Your session has expired. Sign in again.');
    if (!s) throw new DailyError('unauthorized', 'Sign in to continue.');
    if (s.expiresAt - 30 <= Math.floor(Date.now() / 1000)) s = await this.refresh(s);
    try {
      return await work(s.accessToken);
    } catch (e) {
      if (!isDailyError(e) || e.kind !== 'unauthorized') throw e;
      const renewed = await this.refresh(s);
      return work(renewed.accessToken);
    }
  }

  private refresh(s: AuthSession): Promise<AuthSession> {
    if (!this.refreshing) {
      this.refreshing = (async () => {
        try {
          const next = await this.backend.refresh(s);
          if (next.userId !== s.userId) throw new DailyError('session_expired', 'Your session has expired. Sign in again.');
          await this.persist(next);
          this.set({ status: 'signedIn', session: next, userId: next.userId, email: next.email || s.email });
          return next;
        } catch (e) {
          if (isDailyError(e) && e.kind === 'session_expired') {
            await this.kv.setItem(SESSION_KEY, JSON.stringify({ userId: s.userId, email: s.email, expired: true })).catch(() => undefined);
            this.set({ status: 'expired', session: null, userId: s.userId, email: s.email });
          }
          throw e;
        } finally {
          this.refreshing = null;
        }
      })();
    }
    return this.refreshing;
  }

  /** Memory-only on web (gone on reload); the secure-storage port on Android. */
  private async persist(s: AuthSession) {
    await this.kv.setItem(SESSION_KEY, JSON.stringify(s));
  }
}
