/**
 * Native UI preferences: Light / Dark / System and Pause motion.
 * Stored locally with AsyncStorage. UI preferences only — no health data.
 *
 * NATIVE-HOME-01: `reviewer` is an explicit, off-by-default review mode that
 * reveals synthetic state switchers and deliberate error/empty test actions.
 * Turn it on in Profile and display → Reviewer tools, or open any tab with
 * the deep link `rhythmbiome-d0://?reviewer=1` (`?reviewer=0` turns it off).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as NavigationBar from 'expo-navigation-bar';
import * as SystemUI from 'expo-system-ui';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, useColorScheme } from 'react-native';
import { PREF_KEYS, themes, type ThemeName, type ThemePreference, type ThemeRoles } from '@rb-lab/shared';

interface ThemeCtx {
  pref: ThemePreference;
  theme: ThemeName;
  colors: ThemeRoles;
  paused: boolean;
  reducedMotion: boolean;
  /** True when decorative motion should not run (Pause, OS reduced motion, or a temporary hold). */
  motionOff: boolean;
  /**
   * Temporarily pause decorative motion (e.g. while a knowledge sheet is open).
   * Returns a release function. Never changes the user's saved Pause choice.
   */
  holdMotion: () => () => void;
  ready: boolean;
  setPref: (p: ThemePreference) => void;
  setPaused: (p: boolean) => void;
  /** Reviewer mode: synthetic state controls and deliberate test actions. */
  reviewer: boolean;
  setReviewer: (on: boolean) => void;
}

/** Local to the specimen app (not a shared contract key). */
const REVIEWER_KEY = 'rb-d0-reviewer';

const Ctx = createContext<ThemeCtx | null>(null);

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [pref, setPrefState] = useState<ThemePreference>('system');
  const [paused, setPausedState] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [ready, setReady] = useState(false);
  const [holds, setHolds] = useState(0);
  const [reviewer, setReviewerState] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([AsyncStorage.getItem(PREF_KEYS.theme), AsyncStorage.getItem(PREF_KEYS.motion), AsyncStorage.getItem(REVIEWER_KEY)])
      .then(([t, m, r]) => {
        if (!alive) return;
        if (t === 'light' || t === 'dark' || t === 'system') setPrefState(t);
        setPausedState(m === 'paused');
        setReviewerState(r === 'on');
      })
      .catch(() => {
        /* storage unavailable: defaults for this session */
      })
      .finally(() => alive && setReady(true));
    AccessibilityInfo.isReduceMotionEnabled().then((v) => alive && setReducedMotion(v));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  const theme: ThemeName = pref === 'system' ? (system === 'dark' ? 'dark' : 'light') : pref;
  const colors = themes[theme];

  // Theme the Android window background and system navigation bar buttons.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.canvas).catch(() => {});
    if (Platform.OS === 'android') {
      NavigationBar.setButtonStyleAsync(theme === 'dark' ? 'light' : 'dark').catch(() => {});
    }
  }, [colors.canvas, theme]);

  const setPref = useCallback((p: ThemePreference) => {
    setPrefState(p);
    AsyncStorage.setItem(PREF_KEYS.theme, p).catch(() => {});
  }, []);
  const setPaused = useCallback((p: boolean) => {
    setPausedState(p);
    AsyncStorage.setItem(PREF_KEYS.motion, p ? 'paused' : 'auto').catch(() => {});
  }, []);

  const setReviewer = useCallback((on: boolean) => {
    setReviewerState(on);
    AsyncStorage.setItem(REVIEWER_KEY, on ? 'on' : 'off').catch(() => {});
  }, []);

  const holdMotion = useCallback(() => {
    setHolds((h) => h + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      setHolds((h) => Math.max(0, h - 1));
    };
  }, []);

  const value = useMemo(
    () => ({
      pref,
      theme,
      colors,
      paused,
      reducedMotion,
      motionOff: paused || reducedMotion || holds > 0,
      holdMotion,
      ready,
      setPref,
      setPaused,
      reviewer,
      setReviewer,
    }),
    [pref, theme, colors, paused, reducedMotion, holds, holdMotion, ready, setPref, setPaused, reviewer, setReviewer],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppTheme(): ThemeCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAppTheme outside AppThemeProvider');
  return v;
}

/** Static font family names (files in assets/fonts, generated from the supplied variable font). */
export const F = {
  regular: 'HankenGrotesk-Regular',
  medium: 'HankenGrotesk-Medium',
  semibold: 'HankenGrotesk-SemiBold',
  bold: 'HankenGrotesk-Bold',
  mono: 'IBMPlexMono-Medium',
} as const;
