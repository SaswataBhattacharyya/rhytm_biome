/**
 * Per-account read state for the Android Log (Relay 06).
 *
 *  - DayReader keeps the account's confirmed copy of each date. Every request
 *    carries a sequence number; a response is applied only if it is still the
 *    newest request for that date and the reader hasn't been disposed (account
 *    switch / sign-out), so late responses can never overwrite fresher state
 *    or leak into another account. Confirmed values from writes, conflict
 *    snapshots and "use the account version" are applied with set(), which
 *    only ever moves a date forward in revision.
 *
 *  - AccountMeta owns the profile timezone and consent. When the profile can't
 *    be verified it falls back to the timezone remembered in secure storage
 *    (source 'cached'); refresh() is retried on reconnect/foreground and a
 *    successful fetch switches the source back to 'server', clearing the
 *    offline warning even when the outbox is empty.
 */
import { isDailyError, type DailyBackend } from './backend';
import type { DailyLog } from './contract';
import type { SessionManager } from './session';

export type DayView =
  | { s: 'loading' }
  | { s: 'ok'; log: DailyLog | null }
  | { s: 'error'; kind: string; message: string; last: DailyLog | null | undefined };

type DayListener = (date: string, view: DayView) => void;

export class DayReader {
  private views = new Map<string, DayView>();
  private seq = new Map<string, number>();
  private listeners = new Set<DayListener>();
  private disposed = false;
  private n = 0;

  constructor(
    readonly userId: string,
    private readonly get: (localDate: string) => Promise<DailyLog | null>,
  ) {}

  subscribe(fn: DayListener) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  view(date: string): DayView | undefined {
    return this.views.get(date);
  }

  /** Last confirmed copy we know of (even while a refresh is failing). */
  confirmed(date: string): DailyLog | null | undefined {
    const v = this.views.get(date);
    if (!v) return undefined;
    if (v.s === 'ok') return v.log;
    if (v.s === 'error') return v.last;
    return undefined;
  }

  private put(date: string, v: DayView) {
    if (this.disposed) return;
    this.views.set(date, v);
    for (const fn of this.listeners) fn(date, v);
  }

  /** Fetch the account copy of a date. Stale responses are dropped. */
  async refresh(date: string): Promise<DayView> {
    const mine = ++this.n;
    this.seq.set(date, mine);
    const last = this.confirmed(date);
    if (last === undefined) this.put(date, { s: 'loading' });
    try {
      const log = await this.get(date);
      if (this.disposed || this.seq.get(date) !== mine) return this.views.get(date) ?? { s: 'loading' };
      // Never move backwards if a newer confirmed write landed meanwhile.
      const cur = this.confirmed(date);
      const next = cur && log && cur.revision > log.revision ? cur : log;
      this.put(date, { s: 'ok', log: next });
    } catch (e) {
      if (this.disposed || this.seq.get(date) !== mine) return this.views.get(date) ?? { s: 'loading' };
      this.put(date, {
        s: 'error',
        kind: isDailyError(e) ? e.kind : 'unavailable',
        message: isDailyError(e) ? e.message : 'Request failed.',
        last: this.confirmed(date),
      });
    }
    return this.views.get(date)!;
  }

  /**
   * Apply a confirmed account copy (from a successful write, a conflict
   * snapshot or "use the account version"). Ignored if older than what we
   * already hold. Supersedes any in-flight read for that date.
   */
  set(date: string, log: DailyLog | null) {
    const cur = this.confirmed(date);
    if (cur && log && cur.revision > log.revision) return;
    this.seq.set(date, ++this.n);
    this.put(date, { s: 'ok', log });
  }

  dispose() {
    this.disposed = true;
    this.listeners.clear();
  }
}

export type TimezoneSource = 'server' | 'cached' | null;

export interface AccountMetaState {
  timezone: string | null;
  tzSource: TimezoneSource;
  consent: 'unknown' | 'granted' | 'missing';
  /** Result of the last profile/consent attempt. */
  status: 'idle' | 'loading' | 'ok' | 'offline' | 'error';
  message: string | null;
}

export class AccountMeta {
  private st: AccountMetaState = { timezone: null, tzSource: null, consent: 'unknown', status: 'idle', message: null };
  private listeners = new Set<(s: AccountMetaState) => void>();
  private inflight: Promise<AccountMetaState> | null = null;
  private disposed = false;

  constructor(
    readonly userId: string,
    private readonly session: SessionManager,
    private readonly backend: DailyBackend,
  ) {}

  get state() {
    return this.st;
  }

  subscribe(fn: (s: AccountMetaState) => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private set(patch: Partial<AccountMetaState>) {
    if (this.disposed) return;
    this.st = { ...this.st, ...patch };
    for (const fn of this.listeners) fn(this.st);
  }

  /** True when the profile has not been verified by the service this session. */
  get stale() {
    return this.st.tzSource !== 'server' || this.st.consent === 'unknown';
  }

  /** Fetch profile + consent; single-flight. Falls back to the cached timezone. */
  refresh(): Promise<AccountMetaState> {
    if (!this.inflight) {
      this.inflight = this.run().finally(() => {
        this.inflight = null;
      });
    }
    return this.inflight;
  }

  private async run(): Promise<AccountMetaState> {
    this.set({ status: 'loading' });
    try {
      const p = await this.session.authorized((t) => this.backend.profile(t));
      this.set({ timezone: p.timezone, tzSource: 'server', message: null });
      void this.session.rememberTimezone(this.userId, p.timezone);
    } catch (e) {
      if (!this.st.timezone) {
        const known = await this.session.knownTimezone(this.userId);
        if (known) this.set({ timezone: known, tzSource: 'cached' });
      }
      const kind = isDailyError(e) ? e.kind : 'unavailable';
      this.set({ status: kind === 'network' ? 'offline' : 'error', message: isDailyError(e) ? e.message : 'Request failed.' });
      return this.st;
    }
    try {
      const c = await this.session.authorized((t) => this.backend.consent(t));
      this.set({ consent: c.granted ? 'granted' : 'missing', status: 'ok' });
    } catch (e) {
      const kind = isDailyError(e) ? e.kind : 'unavailable';
      this.set({ status: kind === 'network' ? 'offline' : 'error', message: isDailyError(e) ? e.message : 'Request failed.' });
    }
    return this.st;
  }

  markConsentGranted() {
    this.set({ consent: 'granted' });
  }

  dispose() {
    this.disposed = true;
    this.listeners.clear();
  }
}
