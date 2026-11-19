'use client';

/**
 * Web session for the daily pilot (Relay 05).
 *
 * Tokens are kept only in this page's memory (MemoryKV): nothing sensitive is
 * written to localStorage, sessionStorage, IndexedDB or cookies by this code.
 * A full page reload therefore signs the browser out. A longer-lived web
 * session should use an httpOnly-cookie exchange owned by Codex (see
 * relay/05_CLAUDE_RESULT.md); the SessionManager store is the swap point.
 *
 * Backend: connected when NEXT_PUBLIC_RB_API_BASE and NEXT_PUBLIC_RB_AUTH_BASE
 * are set at build time, otherwise the in-memory fixture (badged in the UI).
 * `?backend=fixture` forces the fixture for review.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { MemoryKV, SessionManager, selectBackend, type DailyBackend, type SessionState } from '@rb-lab/shared';

interface DailyCtx {
  backend: DailyBackend;
  manager: SessionManager;
  state: SessionState;
}

const Ctx = createContext<DailyCtx | null>(null);

function forceFixture() {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('backend') === 'fixture';
}

export function DailySessionProvider({ children }: { children: ReactNode }) {
  const [{ backend, manager }] = useState(() => {
    const be = selectBackend({
      apiBase: process.env.NEXT_PUBLIC_RB_API_BASE,
      authBase: process.env.NEXT_PUBLIC_RB_AUTH_BASE,
      forceFixture: forceFixture(),
    });
    return { backend: be, manager: new SessionManager(be, new MemoryKV()) };
  });
  const [state, setState] = useState<SessionState>(manager.state);

  useEffect(() => {
    // Review hook, fixture mode only: seed/inspect the in-memory preview data.
    if (backend.mode === 'fixture') (window as unknown as Record<string, unknown>).__rbFixture = backend;
  }, [backend]);

  useEffect(() => {
    const off = manager.subscribe(setState);
    manager.restore().catch(() => undefined);
    return off;
  }, [manager]);

  const value = useMemo(() => ({ backend, manager, state }), [backend, manager, state]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Null outside the provider (e.g. isolated previews). */
export function useDailySession(): DailyCtx | null {
  return useContext(Ctx);
}

export function BackendBadge({ backend }: { backend: DailyBackend }) {
  return backend.mode === 'connected' ? (
    <span className="backend-badge" data-mode="connected">
      Connected · synthetic pilot ({backend.label})
    </span>
  ) : (
    <span className="backend-badge" data-mode="fixture">
      Fixture preview · not connected to an account
    </span>
  );
}
