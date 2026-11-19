'use client';

/**
 * Synthetic sign-in (Relay 05). States: restoring · idle · submitting ·
 * invalid credentials · offline · service unavailable · session expired ·
 * signed in. Credentials are sent once to the configured Auth service and
 * never stored or logged; the password field is cleared after each attempt.
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { FIXTURE_ACCOUNTS, isDailyError } from '@rb-lab/shared';
import { BackendBadge, useDailySession } from './DailySession';

type Problem = { kind: 'invalid' | 'offline' | 'unavailable'; text: string } | null;

/** Only same-site relative paths are honoured for ?next=. */
function safeNext(): string {
  if (typeof window === 'undefined') return '/account/progress';
  const n = new URLSearchParams(window.location.search).get('next') ?? '';
  return /^\/(?!\/)[\w\-/]*$/.test(n) ? n : '/account/progress';
}

export function SignInForm() {
  const ctx = useDailySession();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (problem) errorRef.current?.focus();
  }, [problem]);

  if (!ctx || ctx.state.status === 'restoring') {
    return (
      <p className="daily-muted" role="status">
        Checking your session…
      </p>
    );
  }
  const { manager, backend, state } = ctx;

  if (state.status === 'signedIn') {
    return (
      <div className="daily-card">
        <BackendBadge backend={backend} />
        <p>
          Signed in as <strong>{state.email}</strong>.
        </p>
        <div className="daily-actions">
          <Link href="/account/progress" className="btn btn-primary">
            Your progress
          </Link>
          <button type="button" className="btn btn-secondary" onClick={() => manager.signOut()}>
            Sign out
          </button>
        </div>
      </div>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setProblem(null);
    try {
      await manager.signIn(email.trim(), password);
      setPassword('');
      router.push(safeNext());
    } catch (err) {
      setPassword('');
      const kind = isDailyError(err) ? err.kind : 'unavailable';
      if (kind === 'invalid_credentials') setProblem({ kind: 'invalid', text: 'That email and password don’t match a synthetic account. Check both and try again.' });
      else if (kind === 'network') setProblem({ kind: 'offline', text: 'Can’t reach the sign-in service. Check your connection and try again.' });
      else setProblem({ kind: 'unavailable', text: 'Sign-in is temporarily unavailable. Try again in a moment.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="daily-card daily-form" onSubmit={submit} noValidate aria-busy={busy}>
      <BackendBadge backend={backend} />
      {state.status === 'expired' ? (
        <div className="daily-banner" data-tone="warning" role="status">
          Your session ended. Sign in again to continue.
        </div>
      ) : null}
      {problem ? (
        <div ref={errorRef} tabIndex={-1} className="daily-banner" data-tone="danger" role="alert" id="signin-error">
          {problem.text}
        </div>
      ) : null}
      <label className="daily-field">
        <span>Email</span>
        <input
          type="email"
          name="email"
          autoComplete="username"
          inputMode="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={problem?.kind === 'invalid' || undefined}
          aria-describedby={problem ? 'signin-error' : undefined}
        />
      </label>
      <label className="daily-field">
        <span>Password</span>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={problem?.kind === 'invalid' || undefined}
          aria-describedby={problem ? 'signin-error' : undefined}
        />
      </label>
      <button type="submit" className="btn btn-primary" disabled={busy || !email || !password}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
      {backend.mode === 'fixture' ? (
        <p className="daily-muted">
          Fixture preview accounts: {FIXTURE_ACCOUNTS.map((a) => a.email).join(' or ')} with the public placeholder password
          “fixture-preview”. They only unlock this in-memory preview.
        </p>
      ) : (
        <p className="daily-muted">Use a synthetic pilot account. Your session is kept in this tab only; reloading signs you out.</p>
      )}
    </form>
  );
}
