/**
 * Per-account outbox for daily check-ins.
 *
 * Every save is written to the storage port *before* it is sent, together
 * with its exact Idempotency-Key, so a process restart re-sends the same
 * request (the API returns the stored receipt if the first one landed).
 * Items are removed only after a successful response, so a failed request is
 * never shown as saved.
 *
 *   pending   → queued on this device, not confirmed by the account
 *   conflict  → 409; the local edit is kept until the user reconciles
 *   blocked   → 403; synthetic daily logging consent is needed
 *   rejected  → 400/422; kept for the user to change or discard
 *
 * One outbox per user id (storage key includes it), so accounts never see
 * each other's queued data.
 */
/// <reference lib="dom" />
import { DailyError, isDailyError, newIdempotencyKey, userKey, type SecureKV } from './backend';
import type { DailyLog, LogInput } from './contract';

export type QueueState = 'pending' | 'conflict' | 'blocked' | 'rejected';

export interface QueuedCheckIn {
  id: string;
  userId: string;
  localDate: string;
  input: LogInput;
  idempotencyKey: string;
  queuedAt: string;
  state: QueueState;
  attempts: number;
  lastError?: { kind: string; code: string; message: string };
  /** Server copy fetched when a conflict was detected (for the reconcile UI). */
  server?: DailyLog | null;
}

export type FlushResult =
  | { kind: 'idle' }
  | { kind: 'done'; saved: DailyLog[] }
  | { kind: 'offline'; saved: DailyLog[] }
  | { kind: 'expired'; saved: DailyLog[] }
  | { kind: 'unavailable'; saved: DailyLog[] };

export interface OutboxTransport {
  /** PUT /v1/me/logs/{date} through the session (handles token refresh). */
  send(item: QueuedCheckIn): Promise<DailyLog>;
  /** GET /v1/me/logs/{date}; null for 404. */
  fetchServer(localDate: string): Promise<DailyLog | null>;
}

type Listener = (items: QueuedCheckIn[], event?: { type: 'saved'; log: DailyLog; item: QueuedCheckIn }) => void;

export const outboxKey = (userId: string) => `rb.outbox.v1.${userKey(userId)}`;

export class Outbox {
  private list: QueuedCheckIn[] = [];
  private loaded = false;
  private flushing: Promise<FlushResult> | null = null;
  private listeners = new Set<Listener>();

  constructor(
    readonly userId: string,
    private readonly kv: SecureKV,
    private readonly transport: OutboxTransport,
  ) {}

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit(event?: Parameters<Listener>[1]) {
    const snap = this.items();
    for (const fn of this.listeners) fn(snap, event);
  }

  items(): QueuedCheckIn[] {
    return this.list.map((i) => ({ ...i }));
  }

  forDate(localDate: string): QueuedCheckIn | null {
    const i = this.list.find((x) => x.localDate === localDate);
    return i ? { ...i } : null;
  }

  async load(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await this.kv.getItem(outboxKey(this.userId));
      const parsed = raw ? (JSON.parse(raw) as QueuedCheckIn[]) : [];
      // Defence in depth: never surface another account's items.
      this.list = parsed.filter((i) => i.userId === this.userId);
    } catch {
      this.list = [];
    }
    this.loaded = true;
    this.emit();
  }

  private async persist() {
    if (this.list.length) await this.kv.setItem(outboxKey(this.userId), JSON.stringify(this.list));
    else await this.kv.deleteItem(outboxKey(this.userId));
  }

  /**
   * Queue a check-in for a date (replacing any unsent one for that date with
   * a fresh key, since the data changed) and persist it before sending.
   */
  async enqueue(localDate: string, input: LogInput): Promise<QueuedCheckIn> {
    await this.load();
    // Relay 06: an unresolved conflict needs an explicit choice first.
    if (this.list.some((x) => x.localDate === localDate && x.state === 'conflict')) {
      throw new DailyError('conflict', 'Choose which check-in to keep for this day first.', 0, 'UNRESOLVED_CONFLICT');
    }
    const item: QueuedCheckIn = {
      id: newIdempotencyKey('rb-q'),
      userId: this.userId,
      localDate,
      input,
      idempotencyKey: newIdempotencyKey('rb-log'),
      queuedAt: new Date().toISOString(),
      state: 'pending',
      attempts: 0,
    };
    this.list = [...this.list.filter((x) => x.localDate !== localDate), item];
    await this.persist();
    this.emit();
    return { ...item };
  }

  /** Send every pending item once. Concurrent callers share one flush. */
  flush(): Promise<FlushResult> {
    if (!this.flushing) {
      this.flushing = this.run().finally(() => {
        this.flushing = null;
      });
    }
    return this.flushing;
  }

  get isFlushing() {
    return this.flushing !== null;
  }

  private async run(): Promise<FlushResult> {
    await this.load();
    const saved: DailyLog[] = [];
    const queue = this.list.filter((i) => i.state === 'pending').map((i) => i.id);
    if (!queue.length) return { kind: 'idle' };
    for (const id of queue) {
      const item = this.list.find((i) => i.id === id);
      if (!item || item.state !== 'pending') continue;
      item.attempts += 1;
      try {
        const log = await this.transport.send(item);
        this.list = this.list.filter((i) => i.id !== id);
        await this.persist();
        saved.push(log);
        this.emit({ type: 'saved', log, item: { ...item } });
      } catch (e) {
        const kind = isDailyError(e) ? e.kind : 'unavailable';
        const err = isDailyError(e) ? { kind: e.kind, code: e.code, message: e.message } : { kind, code: 'UNAVAILABLE', message: 'Request failed.' };
        item.lastError = err;
        if (kind === 'network') {
          await this.persist();
          this.emit();
          return { kind: 'offline', saved };
        }
        if (kind === 'session_expired' || kind === 'unauthorized') {
          await this.persist();
          this.emit();
          return { kind: 'expired', saved };
        }
        if (kind === 'conflict') {
          item.state = 'conflict';
          item.server = await this.transport.fetchServer(item.localDate).catch(() => undefined);
        } else if (kind === 'consent_required') {
          item.state = 'blocked';
        } else if (kind === 'validation') {
          item.state = 'rejected';
        } else {
          await this.persist();
          this.emit();
          return { kind: 'unavailable', saved };
        }
        await this.persist();
        this.emit();
      }
    }
    return { kind: 'done', saved };
  }

  /**
   * Reconcile a conflict by re-applying the local edit on top of the current
   * account version: new base_revision, new idempotency key, then send.
   */
  async keepMine(id: string): Promise<FlushResult> {
    const item = this.list.find((i) => i.id === id);
    if (!item) return { kind: 'idle' };
    const server = await this.transport.fetchServer(item.localDate);
    item.input = { ...item.input, base_revision: server?.revision ?? 0, timezone: server?.timezone ?? item.input.timezone };
    item.idempotencyKey = newIdempotencyKey('rb-log');
    item.state = 'pending';
    item.server = undefined;
    item.lastError = undefined;
    await this.persist();
    this.emit();
    return this.flush();
  }

  /** True while the date has a 409 waiting for an explicit choice. */
  hasConflict(localDate: string): boolean {
    return this.list.some((x) => x.localDate === localDate && x.state === 'conflict');
  }

  /**
   * Relay 06 — "Use the account version": read the account's current copy
   * first; only when that succeeds is the local edit dropped. Issues no write.
   * Throws (and keeps the conflict) if the account copy can't be read.
   */
  async useServerVersion(id: string): Promise<{ localDate: string; log: DailyLog | null }> {
    const item = this.list.find((i) => i.id === id);
    if (!item) throw new DailyError('not_found', 'This edit is no longer waiting.', 0, 'NOT_QUEUED');
    const log = await this.transport.fetchServer(item.localDate);
    this.list = this.list.filter((i) => i.id !== id);
    await this.persist();
    this.emit();
    return { localDate: item.localDate, log };
  }

  /** Drop the local edit (use the account version / discard a rejected edit). */
  async discard(id: string): Promise<void> {
    this.list = this.list.filter((i) => i.id !== id);
    await this.persist();
    this.emit();
  }

  /** Re-queue items that were blocked on consent once it is granted. */
  async unblock(): Promise<void> {
    let changed = false;
    for (const i of this.list) {
      if (i.state === 'blocked') {
        i.state = 'pending';
        changed = true;
      }
    }
    if (changed) {
      await this.persist();
      this.emit();
    }
  }

  /** Wipe this user's queue (sign-out). */
  async clear(): Promise<void> {
    this.list = [];
    await this.kv.deleteItem(outboxKey(this.userId));
    this.emit();
  }
}
