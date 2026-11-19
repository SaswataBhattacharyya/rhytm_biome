/**
 * Android daily-pilot state (Relay 05; recovery fixes in Relay 06).
 *
 *  - Backend: connected when EXPO_PUBLIC_RB_API_BASE and EXPO_PUBLIC_RB_AUTH_BASE
 *    are set (use `adb reverse tcp:3211 tcp:3211` and `adb reverse tcp:55433
 *    tcp:55433` with 127.0.0.1 URLs), otherwise the in-memory fixture.
 *  - Session and the per-account outbox persist through the secure-storage
 *    port only. Sign-out wipes that account's session, timezone and queue.
 *  - Per account, a shared AccountController owns the outbox, the confirmed
 *    copy of each date (late responses dropped) and profile/consent. This
 *    provider only schedules recovery passes: after sign-in/restore, on
 *    foreground, on "Retry now", after saves, and on a capped back-off while
 *    anything is stale or pending. When the service becomes reachable again,
 *    `onlineTick` bumps so the Log refetches its date.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import {
  AccountController,
  SessionManager,
  isDailyError,
  selectBackend,
  type AccountMetaState,
  type DailyBackend,
  type DayReader,
  type FlushResult,
  type LogInput,
  type QueuedCheckIn,
  type SecureKV,
  type SessionState,
  type TickResult,
} from '@rb-lab/shared';
import { createSecureKV } from './secureStore';

export type Connectivity = 'unknown' | 'online' | 'offline';

const EMPTY_META: AccountMetaState = { timezone: null, tzSource: null, consent: 'unknown', status: 'idle', message: null };

interface DailyCtx {
  ready: boolean;
  backend: DailyBackend;
  /** False when no secure store is available (nothing survives a restart). */
  persistent: boolean;
  session: SessionState;
  manager: SessionManager | null;
  queue: QueuedCheckIn[];
  connectivity: Connectivity;
  lastFlush: FlushResult | null;
  meta: AccountMetaState;
  /** Confirmed account copies per date for the signed-in account. */
  reader: DayReader | null;
  /** Bumps whenever a reader view changes (re-render trigger). */
  dayTick: number;
  /** Bumps when the service becomes reachable again. */
  onlineTick: number;
  save: (localDate: string, input: LogInput) => Promise<void>;
  retry: () => Promise<void>;
  keepMine: (id: string) => Promise<void>;
  /** Read the account copy, then drop the device edit; no write. */
  useAccountVersion: (id: string) => Promise<void>;
  discard: (id: string) => Promise<void>;
  grantConsent: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<DailyCtx | null>(null);

const BACKOFF_S = [10, 30, 60, 120];

export function DailyProvider({ children }: { children: ReactNode }) {
  const [backend] = useState<DailyBackend>(() =>
    selectBackend({ apiBase: process.env.EXPO_PUBLIC_RB_API_BASE, authBase: process.env.EXPO_PUBLIC_RB_AUTH_BASE }),
  );
  const [kv, setKv] = useState<SecureKV | null>(null);
  const [manager, setManager] = useState<SessionManager | null>(null);
  const [session, setSession] = useState<SessionState>({ status: 'restoring', session: null, userId: null, email: null });
  const [ctrl, setCtrl] = useState<AccountController | null>(null);
  const [queue, setQueue] = useState<QueuedCheckIn[]>([]);
  const [meta, setMeta] = useState<AccountMetaState>(EMPTY_META);
  const [connectivity, setConnectivity] = useState<Connectivity>('unknown');
  const [lastFlush, setLastFlush] = useState<FlushResult | null>(null);
  const [dayTick, setDayTick] = useState(0);
  const [onlineTick, setOnlineTick] = useState(0);
  const backoff = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ctrlRef = useRef<AccountController | null>(null);
  const statusRef = useRef(session.status);
  statusRef.current = session.status;

  // Secure store + session restore.
  useEffect(() => {
    let alive = true;
    let off: (() => void) | undefined;
    createSecureKV().then(async (store) => {
      if (!alive) return;
      const m = new SessionManager(backend, store);
      off = m.subscribe(setSession);
      setKv(store);
      setManager(m);
      await m.restore();
    });
    return () => {
      alive = false;
      off?.();
    };
  }, [backend]);

  // One controller per account (signed in or expired). Switching accounts disposes it.
  const userId = session.userId;
  useEffect(() => {
    if (!kv || !manager || !userId) {
      ctrlRef.current = null;
      setCtrl(null);
      setQueue([]);
      setMeta(EMPTY_META);
      setConnectivity('unknown');
      return;
    }
    const c = new AccountController(userId, kv, manager, backend);
    const offMeta = c.meta.subscribe(setMeta);
    const off = c.subscribe((ev) => {
      if (ev.type === 'queue') setQueue(ev.items);
      else if (ev.type === 'day') setDayTick((n) => n + 1);
      else {
        setConnectivity(ev.reachable ? 'online' : 'offline');
        if (ev.recovered) setOnlineTick((n) => n + 1);
      }
    });
    manager.onSignedOut = async (uid) => {
      if (uid === userId) await c.outbox.clear();
    };
    ctrlRef.current = c;
    setCtrl(c);
    setMeta(c.meta.state);
    void c.load();
    return () => {
      offMeta();
      off();
      c.dispose();
      if (ctrlRef.current === c) ctrlRef.current = null;
      if (manager.onSignedOut) manager.onSignedOut = null;
    };
  }, [kv, manager, userId, backend]);

  const arm = useCallback((r: TickResult, again: () => void) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (r.retry) {
      const s = BACKOFF_S[Math.min(backoff.current, BACKOFF_S.length - 1)];
      backoff.current += 1;
      timer.current = setTimeout(again, s * 1000);
    } else {
      backoff.current = 0;
    }
  }, []);

  const tick = useCallback(
    async (opts: { probe?: boolean } = {}) => {
      const c = ctrlRef.current;
      if (!c || statusRef.current !== 'signedIn') return;
      const r = await c.tick(opts);
      if (ctrlRef.current !== c) return; // account changed meanwhile
      setLastFlush(r.flush);
      arm(r, () => void tick());
    },
    [arm],
  );

  // Recovery pass on sign-in/restore and whenever the controller changes.
  useEffect(() => {
    if (session.status === 'signedIn' && ctrl) {
      backoff.current = 0;
      void tick({ probe: true });
    }
  }, [session.status, ctrl, tick]);

  // Foreground → probe and flush now (re-verifies profile with an empty queue too).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      backoff.current = 0;
      void tick({ probe: true });
    });
    return () => sub.remove();
  }, [tick]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const value = useMemo<DailyCtx>(
    () => ({
      ready: !!manager && session.status !== 'restoring',
      backend,
      persistent: !!kv?.persistent,
      session,
      manager,
      queue,
      connectivity,
      lastFlush,
      meta,
      reader: ctrl?.reader ?? null,
      dayTick,
      onlineTick,
      async save(localDate, input) {
        if (!ctrl) throw new Error('Sign in to save a check-in.');
        backoff.current = 0;
        const r = await ctrl.save(localDate, input);
        setLastFlush(r.flush);
        arm(r, () => void tick());
      },
      async retry() {
        backoff.current = 0;
        await tick({ probe: true });
      },
      async keepMine(id) {
        if (!ctrl) return;
        const r = await ctrl.keepMine(id);
        setLastFlush(r);
        if (r.kind === 'offline') void tick();
      },
      async useAccountVersion(id) {
        if (!ctrl) return;
        await ctrl.useAccountVersion(id);
      },
      async discard(id) {
        await ctrl?.outbox.discard(id);
      },
      async grantConsent() {
        if (!ctrl) return;
        const r = await ctrl.grantConsent();
        setLastFlush(r.flush);
        arm(r, () => void tick());
      },
      async signIn(email, password) {
        if (!manager) throw new Error('Not ready');
        await manager.signIn(email, password);
      },
      async signOut() {
        if (timer.current) clearTimeout(timer.current);
        await manager?.signOut();
        setLastFlush(null);
      },
    }),
    [manager, session, backend, kv, queue, connectivity, lastFlush, meta, ctrl, dayTick, onlineTick, tick, arm],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDaily(): DailyCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useDaily outside DailyProvider');
  return v;
}

/** Map an error to a short, user-facing sentence (no technical detail). */
export function describeError(e: unknown): { kind: string; text: string } {
  const kind = isDailyError(e) ? e.kind : 'unavailable';
  const text =
    isDailyError(e) && e.code === 'UNRESOLVED_CONFLICT'
      ? 'Choose which check-in to keep for this day first.'
      : kind === 'network'
        ? 'You’re offline or the service can’t be reached.'
        : kind === 'invalid_credentials'
          ? 'That email and password don’t match a synthetic account.'
          : kind === 'session_expired' || kind === 'unauthorized'
            ? 'Your session ended. Sign in again.'
            : kind === 'consent_required'
              ? 'Turn on synthetic daily logging first.'
              : 'The service is temporarily unavailable. Try again shortly.';
  return { kind, text };
}
