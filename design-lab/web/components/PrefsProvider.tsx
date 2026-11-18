'use client';

/**
 * UI preferences only (theme, motion). No health data.
 * Initial values are applied before first paint by the inline script in
 * app/layout.tsx; this provider mirrors and updates them.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { PREF_KEYS, type ThemeName, type ThemePreference } from '@rb-lab/shared';

interface Prefs {
  themePref: ThemePreference;
  theme: ThemeName;
  paused: boolean;
  reducedMotion: boolean;
  setThemePref: (p: ThemePreference) => void;
  setPaused: (p: boolean) => void;
}

const PrefsContext = createContext<Prefs | null>(null);

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: preference lasts for this page only */
  }
}

function systemDark() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  // Server render uses neutral defaults; the inline script already set the DOM.
  const [themePref, setPrefState] = useState<ThemePreference>('system');
  const [theme, setTheme] = useState<ThemeName>('light');
  const [paused, setPausedState] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  // True once the stored preference has been read; prevents the System
  // listener from overriding a saved Light/Dark choice on first mount.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const stored = readStorage(PREF_KEYS.theme);
    const pref: ThemePreference = stored === 'light' || stored === 'dark' ? stored : 'system';
    setPrefState(pref);
    setTheme((root.dataset.theme as ThemeName) || (systemDark() ? 'dark' : 'light'));
    setPausedState(readStorage(PREF_KEYS.motion) === 'paused');
    setReady(true);
    const rm = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(rm.matches);
    const onRm = () => setReducedMotion(rm.matches);
    rm.addEventListener('change', onRm);
    return () => rm.removeEventListener('change', onRm);
  }, []);

  // Follow the OS while preference is System.
  useEffect(() => {
    if (!ready || themePref !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const t: ThemeName = mq.matches ? 'dark' : 'light';
      document.documentElement.dataset.theme = t;
      setTheme(t);
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [themePref, ready]);

  const setThemePref = useCallback((p: ThemePreference) => {
    writeStorage(PREF_KEYS.theme, p);
    const root = document.documentElement;
    root.dataset.themePref = p;
    const t: ThemeName = p === 'system' ? (systemDark() ? 'dark' : 'light') : p;
    root.dataset.theme = t;
    setPrefState(p);
    setTheme(t);
  }, []);

  const setPaused = useCallback((p: boolean) => {
    writeStorage(PREF_KEYS.motion, p ? 'paused' : 'auto');
    if (p) document.documentElement.dataset.motion = 'paused';
    else delete document.documentElement.dataset.motion;
    setPausedState(p);
  }, []);

  const value = useMemo(
    () => ({ themePref, theme, paused, reducedMotion, setThemePref, setPaused }),
    [themePref, theme, paused, reducedMotion, setThemePref, setPaused],
  );
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs(): Prefs {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error('usePrefs outside PrefsProvider');
  return ctx;
}

