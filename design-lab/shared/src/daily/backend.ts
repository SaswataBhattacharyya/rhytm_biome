/**
 * Replaceable backend port for the daily pilot. Screens never call fetch
 * directly: they use a DailyBackend, which is either the connected HTTP
 * adapter (local Supabase Auth + the synthetic API) or the in-memory
 * fixture adapter for previews. `mode` is shown in the UI so a fixture
 * preview can never be mistaken for a connected account.
 */
import type { DailyLog, LogInput, Profile, Progress } from './contract';

export type BackendMode = 'connected' | 'fixture';

/** Tokens live only in memory (web) or the secure-storage port (Android). Never logged. */
export interface AuthSession {
  userId: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  /** Epoch seconds. */
  expiresAt: number;
}

export type DailyErrorKind =
  | 'network' // no response: offline, DNS, timeout, CORS
  | 'invalid_credentials'
  | 'unauthorized' // access token rejected
  | 'session_expired' // refresh token rejected
  | 'consent_required' // 403 — synthetic daily logging not granted
  | 'conflict' // 409 REVISION_CONFLICT / IDEMPOTENCY_CONFLICT
  | 'not_found'
  | 'validation' // 400 / 422
  | 'unavailable'; // 5xx or unexpected

export class DailyError extends Error {
  readonly kind: DailyErrorKind;
  readonly status: number;
  readonly code: string;
  constructor(kind: DailyErrorKind, message: string, status = 0, code = kind.toUpperCase()) {
    super(message);
    this.name = 'DailyError';
    this.kind = kind;
    this.status = status;
    this.code = code;
  }
}

export const isDailyError = (e: unknown): e is DailyError => e instanceof DailyError;

export interface ConsentState {
  granted: boolean;
}

export interface DailyBackend {
  readonly mode: BackendMode;
  /** Human-readable target for the status badge (no secrets). */
  readonly label: string;
  signIn(email: string, password: string): Promise<AuthSession>;
  refresh(session: AuthSession): Promise<AuthSession>;
  /** Best effort: invalidates the refresh token server-side. */
  signOut(session: AuthSession): Promise<void>;
  profile(accessToken: string): Promise<Profile>;
  consent(accessToken: string): Promise<ConsentState>;
  grantConsent(accessToken: string, idempotencyKey: string): Promise<void>;
  /** null when the day has no check-in (404). */
  getLog(accessToken: string, localDate: string): Promise<DailyLog | null>;
  putLog(accessToken: string, localDate: string, input: LogInput, idempotencyKey: string): Promise<DailyLog>;
  progress(accessToken: string, from: string, to: string): Promise<Progress>;
}

// ------------------------------------------------------------------ storage port

/**
 * Key–value port for anything persisted. Android binds it to the platform
 * secure store (expo-secure-store); there is deliberately no plaintext
 * fallback — without a secure implementation, nothing is persisted.
 * Keys use only [A-Za-z0-9._-].
 */
export interface SecureKV {
  readonly persistent: boolean;
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  deleteItem(key: string): Promise<void>;
}

/** Process-memory store (web, tests, or Android without a secure store). */
export class MemoryKV implements SecureKV {
  readonly persistent = false;
  private m = new Map<string, string>();
  async getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  async setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  async deleteItem(k: string) {
    this.m.delete(k);
  }
  keys() {
    return [...this.m.keys()];
  }
}

// ------------------------------------------------------------------ ids

/**
 * Idempotency key: 128 random bits as hex with a readable prefix. Uses
 * crypto.getRandomValues when the runtime has it; the key is a dedupe
 * token, not a secret, so a Math.random fallback only weakens uniqueness
 * marginally. Matches the API's ^[A-Za-z0-9._:-]{8,128}$.
 */
export function newIdempotencyKey(prefix = 'rb-log'): string {
  const bytes = new Uint8Array(16);
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (c?.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return `${prefix}.${Date.now().toString(36)}.${hex}`;
}

/** Storage-safe key fragment for a user id. */
export const userKey = (userId: string) => userId.replace(/[^A-Za-z0-9._-]/g, '_');
