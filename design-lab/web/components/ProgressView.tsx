'use client';

/**
 * Web Progress (Relay 05): logging coverage for a selected inclusive date
 * range, read through the same account and API as the Android Log.
 *
 * The pilot API returns counts only (complete, partial, expected); missing is
 * derived as expected − complete − partial. There is no per-day series yet,
 * so the view shows a proportional bar plus counts, never which days.
 * Patterns + text carry meaning, not colour alone.
 */
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  addDays,
  coverageOf,
  isDailyError,
  localDateIn,
  validateRange,
  type Progress,
} from '@rb-lab/shared';
import { BackendBadge, useDailySession } from './DailySession';

type Load =
  | { s: 'idle' }
  | { s: 'loading' }
  | { s: 'ok'; data: Progress }
  | { s: 'error'; kind: 'offline' | 'expired' | 'unavailable' | 'validation'; text: string };

const PRESETS = [
  { days: 7, label: 'Last 7 days' },
  { days: 14, label: 'Last 14 days' },
  { days: 30, label: 'Last 30 days' },
];

export function ProgressView() {
  const ctx = useDailySession();
  const [tz, setTz] = useState<string | null>(null);
  const [today, setToday] = useState<string | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [load, setLoad] = useState<Load>({ s: 'idle' });
  const userId = ctx?.state.status === 'signedIn' ? ctx.state.userId : null;
  const reqSeq = useRef(0);

  // Reset everything user-specific when the account changes or signs out.
  useEffect(() => {
    setTz(null);
    setToday(null);
    setFrom('');
    setTo('');
    setLoad({ s: 'idle' });
    setFieldError(null);
    reqSeq.current++;
  }, [userId]);

  const fetchRange = useCallback(
    async (f: string, t: string) => {
      if (!ctx || !userId) return;
      const seq = ++reqSeq.current;
      setLoad({ s: 'loading' });
      try {
        const data = await ctx.manager.authorized((token) => ctx.backend.progress(token, f, t));
        if (seq === reqSeq.current) setLoad({ s: 'ok', data });
      } catch (e) {
        if (seq !== reqSeq.current) return;
        const kind = isDailyError(e) ? e.kind : 'unavailable';
        if (kind === 'network') setLoad({ s: 'error', kind: 'offline', text: 'Can’t reach the service. Check your connection, then try again.' });
        else if (kind === 'session_expired' || kind === 'unauthorized') setLoad({ s: 'error', kind: 'expired', text: 'Your session ended. Sign in again to see your progress.' });
        else if (kind === 'validation') setLoad({ s: 'error', kind: 'validation', text: isDailyError(e) ? e.message : 'Check the dates.' });
        else setLoad({ s: 'error', kind: 'unavailable', text: 'Progress is temporarily unavailable. Try again in a moment.' });
      }
    },
    [ctx, userId],
  );

  // First load: profile timezone → default last 7 days → fetch.
  useEffect(() => {
    if (!ctx || !userId || tz) return;
    let alive = true;
    ctx.manager
      .authorized((token) => ctx.backend.profile(token))
      .then((p) => {
        if (!alive) return;
        const d = localDateIn(p.timezone).date;
        setTz(p.timezone);
        setToday(d);
        setFrom(addDays(d, -6));
        setTo(d);
        void fetchRange(addDays(d, -6), d);
      })
      .catch((e) => {
        if (!alive) return;
        const kind = isDailyError(e) ? e.kind : 'unavailable';
        setLoad({
          s: 'error',
          kind: kind === 'network' ? 'offline' : kind === 'session_expired' || kind === 'unauthorized' ? 'expired' : 'unavailable',
          text:
            kind === 'network'
              ? 'Can’t reach the service. Check your connection, then try again.'
              : kind === 'session_expired' || kind === 'unauthorized'
                ? 'Your session ended. Sign in again to see your progress.'
                : 'Progress is temporarily unavailable. Try again in a moment.',
        });
      });
    return () => {
      alive = false;
    };
  }, [ctx, userId, tz, fetchRange]);

  if (!ctx || ctx.state.status === 'restoring') {
    return (
      <p className="daily-muted" role="status">
        Checking your session…
      </p>
    );
  }
  if (ctx.state.status !== 'signedIn') {
    return (
      <div className="daily-card">
        {ctx.state.status === 'expired' ? (
          <div className="daily-banner" data-tone="warning" role="status">
            Your session ended. Sign in again to see your progress.
          </div>
        ) : null}
        <p>Sign in with a synthetic account to see your check-in coverage.</p>
        <div className="daily-actions">
          <Link href="/sign-in?next=/account/progress" className="btn btn-primary">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const err = validateRange(from, to, today ?? undefined);
    setFieldError(err);
    if (!err) void fetchRange(from, to);
  };

  const preset = (days: number) => {
    if (!today) return;
    const f = addDays(today, -(days - 1));
    setFrom(f);
    setTo(today);
    setFieldError(null);
    void fetchRange(f, today);
  };

  return (
    <div className="daily-stack">
      <div className="daily-account">
        <BackendBadge backend={ctx.backend} />
        <span>
          Signed in as <strong>{ctx.state.email}</strong>
        </span>
        <button type="button" className="btn btn-quiet" onClick={() => ctx.manager.signOut()}>
          Sign out
        </button>
      </div>

      <form className="daily-card daily-range" onSubmit={submit} noValidate aria-describedby="range-help">
        <fieldset>
          <legend>Date range</legend>
          <div className="daily-presets" role="group" aria-label="Quick ranges">
            {PRESETS.map((p) => (
              <button key={p.days} type="button" className="btn btn-secondary btn-small" onClick={() => preset(p.days)} disabled={!today}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="daily-range-fields">
            <label className="daily-field">
              <span>From</span>
              <input type="date" value={from} max={to || today || undefined} onChange={(e) => setFrom(e.target.value)} aria-invalid={!!fieldError || undefined} aria-describedby="range-help range-error" />
            </label>
            <label className="daily-field">
              <span>To</span>
              <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} aria-invalid={!!fieldError || undefined} aria-describedby="range-help range-error" />
            </label>
            <button type="submit" className="btn btn-primary" disabled={!today || load.s === 'loading'}>
              Show
            </button>
          </div>
          <p id="range-help" className="daily-muted">
            Inclusive dates in your profile timezone{tz ? ` (${tz})` : ''}, up to 366 days.
          </p>
          {fieldError ? (
            <p id="range-error" className="daily-field-error" role="alert">
              {fieldError}
            </p>
          ) : null}
        </fieldset>
      </form>

      <section className="daily-card" aria-labelledby="coverage-title" aria-busy={load.s === 'loading'}>
        <h2 id="coverage-title">Check-in coverage</h2>
        <div aria-live="polite">
          {load.s === 'loading' || load.s === 'idle' ? <p className="daily-muted">Loading…</p> : null}
          {load.s === 'error' ? (
            <div className="daily-banner" data-tone={load.kind === 'validation' ? 'warning' : 'danger'} role="alert">
              <span>{load.text}</span>
              {load.kind === 'expired' ? (
                <Link href="/sign-in?next=/account/progress" className="btn btn-secondary btn-small">
                  Sign in again
                </Link>
              ) : load.kind !== 'validation' && from && to ? (
                <button type="button" className="btn btn-secondary btn-small" onClick={() => fetchRange(from, to)}>
                  Try again
                </button>
              ) : null}
            </div>
          ) : null}
          {load.s === 'ok' ? <Coverage data={load.data} onRefresh={() => fetchRange(load.data.from, load.data.to)} /> : null}
        </div>
      </section>
      <p className="daily-muted">Self-reported logging only. This is not a health score and is kept separate from lab results.</p>
    </div>
  );
}

function Coverage({ data, onRefresh }: { data: Progress; onRefresh: () => void }) {
  const c = coverageOf(data);
  const pct = (n: number) => (c.expected ? (n / c.expected) * 100 : 0);
  const asOf = new Date(data.as_of);
  const summary = `${c.complete} complete, ${c.partial} partial and ${c.missing} missing out of ${c.expected} ${c.expected === 1 ? 'day' : 'days'}`;
  return (
    <div className="coverage">
      <p className="coverage-range">
        {data.from} to {data.to} · {c.expected} {c.expected === 1 ? 'day' : 'days'}
      </p>
      <div className="coverage-bar" role="img" aria-label={summary}>
        <span className="seg" data-k="complete" style={{ width: `${pct(c.complete)}%` }} />
        <span className="seg" data-k="partial" style={{ width: `${pct(c.partial)}%` }} />
        <span className="seg" data-k="missing" style={{ width: `${pct(c.missing)}%` }} />
      </div>
      <dl className="coverage-legend">
        <div>
          <dt>
            <span className="swatch" data-k="complete" aria-hidden="true" /> Complete
          </dt>
          <dd>{c.complete}</dd>
        </div>
        <div>
          <dt>
            <span className="swatch" data-k="partial" aria-hidden="true" /> Partial
          </dt>
          <dd>{c.partial}</dd>
        </div>
        <div>
          <dt>
            <span className="swatch" data-k="missing" aria-hidden="true" /> Missing
          </dt>
          <dd>{c.missing}</dd>
        </div>
      </dl>
      <p className="daily-muted">
        Missing days stay missing — they are never counted as zero. Which days were logged isn’t available from the pilot API
        yet.
      </p>
      <p className="daily-muted coverage-asof">
        As of {Number.isNaN(asOf.getTime()) ? data.as_of : asOf.toLocaleString()}{' '}
        <button type="button" className="btn btn-quiet btn-small" onClick={onRefresh}>
          Refresh
        </button>
      </p>
    </div>
  );
}
