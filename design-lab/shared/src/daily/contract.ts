/**
 * Daily check-in pilot — frontend view of the implemented API contract.
 *
 * Types come straight from Codex's generated client (`@rb/api-client`,
 * packages/api-client/src/schema.ts). The import is type-only, so neither
 * Metro nor Next ever resolves it at runtime; no dependency change is needed
 * to compile against the contract. If Codex prefers the package name, swap
 * the path for `@rb/api-client` once it is linked into design-lab.
 */
import type { components } from '../../../../packages/api-client/src/schema';

export type Profile = components['schemas']['Profile'];
export type DailyLog = components['schemas']['DailyLog'];
export type LogInput = components['schemas']['LogInput'];
export type Progress = components['schemas']['Progress'];
export type Answer = components['schemas']['Answer'];
export type ApiErrorBody = components['schemas']['Error'];

/** Pilot constants published in apps/api/README.md (not secrets). */
export const DAILY_DEFINITION_ID = '7ec13659-af4c-4ccf-b7c0-778ee655deed';
export const SYNTHETIC_NOTICE = { purpose: 'synthetic_daily_logging', policy_version: 'demo-1' } as const;
export const PILOT_MOODS = ['low', 'meh', 'okay', 'good', 'great'] as const;
export type PilotMood = (typeof PILOT_MOODS)[number];
export const MAX_PROGRESS_DAYS = 366;

export function isPilotMood(v: unknown): v is PilotMood {
  return typeof v === 'string' && (PILOT_MOODS as readonly string[]).includes(v);
}

/**
 * Build the exact pilot request: complete = one manual mood answer,
 * partial = no answers. `dose_outcomes` is always empty in the pilot.
 */
export function buildLogInput(opts: { baseRevision: number; timezone: string; mood: PilotMood | null }): LogInput {
  return {
    base_revision: opts.baseRevision,
    timezone: opts.timezone,
    definition_version_id: DAILY_DEFINITION_ID,
    status: opts.mood ? 'complete' : 'partial',
    answers: opts.mood ? [{ question_key: 'mood', value_type: 'single_select', value: opts.mood, source: 'manual' }] : [],
    dose_outcomes: [],
  };
}

export function moodOf(log: Pick<DailyLog, 'answers'> | Pick<LogInput, 'answers'> | null | undefined): PilotMood | null {
  const a = log?.answers.find((x) => x.question_key === 'mood');
  return a && isPilotMood(a.value) ? a.value : null;
}

// ------------------------------------------------------------------ dates

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(v: string): boolean {
  if (!ISO_DATE.test(v)) return false;
  const t = Date.parse(v + 'T00:00:00Z');
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === v;
}

/**
 * Calendar date "now" in an IANA timezone — mirrors the API's localDateAt.
 * Falls back to the device's local date only if the runtime lacks timezone
 * support (flagged by `exact: false` so the UI can say so).
 */
export function localDateIn(timeZone: string, now = new Date()): { date: string; exact: boolean } {
  try {
    const parts = new Intl.DateTimeFormat('en', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
    const get = (t: string) => parts.find((p) => p.type === t)?.value;
    const date = `${get('year')}-${get('month')}-${get('day')}`;
    if (isIsoDate(date)) return { date, exact: true };
  } catch {
    /* fall through */
  }
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return { date: `${y}-${m}-${d}`, exact: false };
}

/** Pure calendar arithmetic on YYYY-MM-DD (UTC-anchored, DST-safe). */
export function addDays(date: string, days: number): string {
  const t = Date.parse(date + 'T00:00:00Z') + days * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

/** Inclusive day count between two ISO dates. */
export function daysInclusive(from: string, to: string): number {
  return Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000) + 1;
}

/** "Thu 15 Jan" for a calendar date, independent of the device timezone. */
export function formatDay(date: string, locale = 'en-GB'): string {
  try {
    return new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
      new Date(date + 'T00:00:00Z'),
    );
  } catch {
    return date;
  }
}

export function validateRange(from: string, to: string, today?: string): string | null {
  if (!isIsoDate(from) || !isIsoDate(to)) return 'Enter both dates.';
  if (from > to) return 'The start date must be on or before the end date.';
  const n = daysInclusive(from, to);
  if (n > MAX_PROGRESS_DAYS) return `Choose a range of up to ${MAX_PROGRESS_DAYS} days.`;
  if (today && from > today) return 'The range starts in the future.';
  return null;
}

/** Coverage for a progress response: missing is derived, never stored. */
export function coverageOf(p: Progress) {
  const { complete, partial, expected } = p.logging;
  const missing = Math.max(0, expected - complete - partial);
  return { complete, partial, missing, expected };
}
