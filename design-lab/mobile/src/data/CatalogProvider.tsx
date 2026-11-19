/**
 * Android catalogue source (Relay 07).
 *
 * The synthetic fixture is the explicit default. The connected adapter is used
 * only when the build sets EXPO_PUBLIC_RB_CATALOG_SOURCE=api together with
 * EXPO_PUBLIC_RB_API_BASE. Reviewer mode (Profile → Reviewer tools) can pick a
 * fixture scenario and hide optional sections for this session; neither
 * appears in ordinary navigation.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  CATALOG_SECTIONS,
  selectCatalogSource,
  type CatalogScenario,
  type CatalogSectionKey,
  type CatalogSource,
} from '@rb-lab/shared';

interface CatalogCtx {
  source: CatalogSource;
  scenario: CatalogScenario | null;
  setScenario: (s: CatalogScenario | null) => void;
  hidden: CatalogSectionKey[];
  toggleHidden: (k: CatalogSectionKey) => void;
}

const Ctx = createContext<CatalogCtx | null>(null);

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [scenario, setScenario] = useState<CatalogScenario | null>(null);
  const [hidden, setHidden] = useState<CatalogSectionKey[]>([]);
  const source = useMemo(
    () => selectCatalogSource({ source: process.env.EXPO_PUBLIC_RB_CATALOG_SOURCE, apiBase: process.env.EXPO_PUBLIC_RB_API_BASE, scenario }),
    [scenario],
  );
  const toggleHidden = useCallback(
    (k: CatalogSectionKey) => setHidden((h) => (h.includes(k) ? h.filter((x) => x !== k) : [...h, k]).filter((x) => x in CATALOG_SECTIONS)),
    [],
  );
  const value = useMemo(() => ({ source, scenario, setScenario, hidden, toggleHidden }), [source, scenario, hidden, toggleHidden]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCatalog(): CatalogCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useCatalog outside CatalogProvider');
  return v;
}

export type ReadState<T> = { s: 'loading' } | { s: 'ok'; data: T } | { s: 'error'; message: string };

/** Async catalogue read with retry; superseded responses are ignored. */
export function useCatalogRead<T>(read: (src: CatalogSource) => Promise<T>, key: string): [ReadState<T>, () => void] {
  const { source } = useCatalog();
  const [state, setState] = useState<ReadState<T>>({ s: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const readRef = useRef(read);
  readRef.current = read;
  useEffect(() => {
    let active = true;
    setState({ s: 'loading' });
    readRef.current(source).then(
      (data) => active && setState({ s: 'ok', data }),
      (e: unknown) => active && setState({ s: 'error', message: e instanceof Error && e.message ? e.message : 'The catalogue is temporarily unavailable.' }),
    );
    return () => {
      active = false;
    };
  }, [source, key, attempt]);
  return [state, useCallback(() => setAttempt((n) => n + 1), [])];
}
