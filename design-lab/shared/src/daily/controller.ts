/**
 * AccountController (Relay 06) — the per-account wiring behind the Android
 * Log, kept platform-free so it can be tested without React Native.
 *
 *  Outbox (writes) + DayReader (confirmed copy per date) + AccountMeta
 *  (profile timezone, consent). Confirmed writes and 409 snapshots update the
 *  reader; "use the account version" reads first, then drops the edit (no
 *  write); `tick()` re-verifies stale profile/consent — even with an empty
 *  outbox — then flushes, and reports whether to retry and whether the
 *  service just became reachable again (so the screen refetches its date).
 */
import { DailyError, newIdempotencyKey, type DailyBackend, type SecureKV } from './backend';
import { AccountMeta, DayReader } from './account';
import type { LogInput } from './contract';
import { Outbox, type FlushResult, type QueuedCheckIn } from './outbox';
import type { SessionManager } from './session';

export interface TickResult {
  flush: FlushResult;
  /** Service reachability observed in this pass (null = not determined). */
  reachable: boolean | null;
  /** True when this pass turned "unreachable" into "reachable". */
  recovered: boolean;
  /** Something is still stale or pending: schedule another pass. */
  retry: boolean;
}

type Listener = (ev: { type: 'queue'; items: QueuedCheckIn[] } | { type: 'day' } | { type: 'reachability'; reachable: boolean; recovered: boolean }) => void;

export class AccountController {
  readonly outbox: Outbox;
  readonly reader: DayReader;
  readonly meta: AccountMeta;
  private listeners = new Set<Listener>();
  private reachable: boolean | null = null;
  private disposed = false;
  private offs: (() => void)[] = [];

  constructor(
    readonly userId: string,
    kv: SecureKV,
    private readonly session: SessionManager,
    private readonly backend: DailyBackend,
  ) {
    this.reader = new DayReader(userId, (date) => session.authorized((t) => backend.getLog(t, date)));
    this.meta = new AccountMeta(userId, session, backend);
    this.outbox = new Outbox(userId, kv, {
      send: (item) => session.authorized((t) => backend.putLog(t, item.localDate, item.input, item.idempotencyKey)),
      fetchServer: (date) => session.authorized((t) => backend.getLog(t, date)),
    });
    this.offs.push(
      this.reader.subscribe(() => this.emit({ type: 'day' })),
      this.outbox.subscribe((items, ev) => {
        // A confirmed write is the newest account copy for that date.
        if (ev?.type === 'saved') this.reader.set(ev.log.local_date, ev.log);
        // A 409 snapshot is a confirmed account copy too.
        for (const i of items) {
          if (i.state === 'conflict' && i.server && this.reader.confirmed(i.localDate)?.revision !== i.server.revision) {
            this.reader.set(i.localDate, i.server);
          }
        }
        this.emit({ type: 'queue', items });
      }),
    );
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit(ev: Parameters<Listener>[0]) {
    if (this.disposed) return;
    for (const fn of this.listeners) fn(ev);
  }

  /** Record reachability; returns true if this is a recovery. */
  private observe(ok: boolean): boolean {
    const recovered = ok && this.reachable === false;
    this.reachable = ok;
    this.emit({ type: 'reachability', reachable: ok, recovered });
    return recovered;
  }

  get isReachable() {
    return this.reachable;
  }

  async load() {
    await this.outbox.load();
  }

  /**
   * One recovery pass: verify profile/consent if stale (or when `probe` is
   * set, e.g. on foreground while unreachable), then flush the outbox.
   */
  async tick(opts: { probe?: boolean } = {}): Promise<TickResult> {
    let reachable: boolean | null = null;
    let recovered = false;
    if (this.meta.stale || (opts.probe && this.reachable !== true)) {
      const m = await this.meta.refresh();
      if (this.disposed) return { flush: { kind: 'idle' }, reachable, recovered, retry: false };
      if (m.status === 'ok') {
        reachable = true;
        recovered = this.observe(true) || recovered;
      } else if (m.status === 'offline') {
        reachable = false;
        this.observe(false);
      }
    }
    const flush = await this.outbox.flush();
    if (this.disposed) return { flush, reachable, recovered, retry: false };
    if (flush.kind === 'offline') {
      reachable = false;
      this.observe(false);
    } else if (flush.kind === 'done') {
      reachable = true;
      recovered = this.observe(true) || recovered;
      // Writes went through, so the profile can be verified now as well.
      if (this.meta.stale) {
        const m = await this.meta.refresh();
        if (m.status === 'ok') recovered = this.observe(true) || recovered;
      }
    }
    const pending = this.outbox.items().some((i) => i.state === 'pending');
    const retry = reachable === false || flush.kind === 'unavailable' || this.meta.stale || (pending && flush.kind !== 'expired');
    return { flush, reachable, recovered, retry };
  }

  async save(localDate: string, input: LogInput): Promise<TickResult> {
    await this.outbox.enqueue(localDate, input); // throws UNRESOLVED_CONFLICT while a choice is pending
    return this.tick();
  }

  async keepMine(id: string): Promise<FlushResult> {
    const r = await this.outbox.keepMine(id);
    if (r.kind === 'done') this.observe(true);
    else if (r.kind === 'offline') this.observe(false);
    return r;
  }

  /** Read the account copy (no write); only then drop the device edit. */
  async useAccountVersion(id: string) {
    try {
      const { localDate, log } = await this.outbox.useServerVersion(id);
      this.reader.set(localDate, log);
      this.observe(true);
      return { localDate, log };
    } catch (e) {
      if (e instanceof DailyError && e.kind === 'network') this.observe(false);
      throw e;
    }
  }

  async grantConsent() {
    await this.session.authorized((t) => this.backend.grantConsent(t, newIdempotencyKey('rb-consent')));
    this.meta.markConsentGranted();
    await this.outbox.unblock();
    return this.tick();
  }

  dispose() {
    this.disposed = true;
    for (const off of this.offs) off();
    this.reader.dispose();
    this.meta.dispose();
    this.listeners.clear();
  }
}
