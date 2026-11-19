'use client';

/**
 * Catalogue data context for web (Relay 07).
 *
 * Source: the synthetic fixture by default; the connected adapter only when
 * the build sets NEXT_PUBLIC_RB_CATALOG_SOURCE=api with NEXT_PUBLIC_RB_API_BASE.
 * Review-only URL controls (never linked from navigation):
 *   ?catalog=sample|gallery|empty|slow|error|flaky   fixture scenario
 *   ?hide=test.description,product.description        hide optional sections
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  isCatalogScenario,
  parseHiddenSections,
  selectCatalogSource,
  type CatalogSectionKey,
  type CatalogSource,
} from '@rb-lab/shared';

interface Ctx {
  source: CatalogSource | null;
  hidden: CatalogSectionKey[];
  /** Keep ?catalog / ?hide review params on internal catalogue links. */
  withReview: (href: string) => string;
}

const CatalogCtx = createContext<Ctx>({ source: null, hidden: [], withReview: (h) => h });

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ source: CatalogSource | null; hidden: CatalogSectionKey[]; review: string }>({
    source: null,
    hidden: [],
    review: '',
  });
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const scenario = q.get('catalog');
    const review = new URLSearchParams();
    if (isCatalogScenario(scenario)) review.set('catalog', scenario);
    if (q.get('hide')) review.set('hide', q.get('hide')!);
    setState({
      source: selectCatalogSource({
        source: process.env.NEXT_PUBLIC_RB_CATALOG_SOURCE,
        apiBase: process.env.NEXT_PUBLIC_RB_API_BASE,
        scenario: isCatalogScenario(scenario) ? scenario : null,
      }),
      hidden: parseHiddenSections(q.get('hide')),
      review: review.toString(),
    });
  }, []);
  const withReview = useCallback((href: string) => (state.review ? `${href}${href.includes('?') ? '&' : '?'}${state.review}` : href), [state.review]);
  return <CatalogCtx.Provider value={{ source: state.source, hidden: state.hidden, withReview }}>{children}</CatalogCtx.Provider>;
}

export const useCatalog = () => useContext(CatalogCtx);

export type ReadState<T> =
  | { s: 'loading' }
  | { s: 'ok'; data: T }
  | { s: 'error'; message: string };

/**
 * Async read with retry. Responses from superseded reads (route change,
 * retry) are ignored.
 */
export function useCatalogRead<T>(read: ((src: CatalogSource) => Promise<T>) | null, deps: unknown[]): [ReadState<T>, () => void] {
  const { source } = useCatalog();
  const [state, setState] = useState<ReadState<T>>({ s: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!source || !read) return;
    let active = true;
    setState({ s: 'loading' });
    read(source).then(
      (data) => active && setState({ s: 'ok', data }),
      (e: unknown) =>
        active &&
        setState({ s: 'error', message: e instanceof Error && e.message ? e.message : 'The catalogue is temporarily unavailable.' }),
    );
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, attempt, ...deps]);
  return [state, useCallback(() => setAttempt((n) => n + 1), [])];
}
