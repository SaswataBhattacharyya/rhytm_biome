'use client';

/**
 * Shared behaviour for the Relay 08 trust sections: review visibility,
 * motion gating, entry reveal, clamp detection and dialog focus/scroll return.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { isTrustVisible, parseHiddenTrust, type TrustSectionKey } from '../../lib/trust/visibility';

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** Motion is allowed only when not paused, not reduced, and the tab is visible. */
export function motionAllowed(): boolean {
  if (typeof window === 'undefined') return false;
  if (document.documentElement.dataset.motion === 'paused') return false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  return document.visibilityState === 'visible';
}

/**
 * Checked-in visibility plus the review-only `?hide=` override. The override
 * is applied in a layout effect so a hidden section is removed before paint.
 * `withReview` keeps the override on internal trust links.
 */
export function useTrustVisibility() {
  const [hidden, setHidden] = useState<TrustSectionKey[]>([]);
  const [hideParam, setHideParam] = useState('');
  useIsoLayoutEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('hide');
    setHidden(parseHiddenTrust(raw));
    setHideParam(raw ?? '');
  }, []);
  const visible = useCallback((key: TrustSectionKey) => isTrustVisible(key, hidden), [hidden]);
  const withReview = useCallback(
    (href: string) => {
      if (!hideParam) return href;
      const [path, hash] = href.split('#');
      return `${path}${path.includes('?') ? '&' : '?'}hide=${encodeURIComponent(hideParam)}${hash ? `#${hash}` : ''}`;
    },
    [hideParam],
  );
  return { visible, withReview };
}

/**
 * Short fade + small offset when a group first enters view. Content is
 * rendered visible (server HTML, no-JS, Pause, reduced motion); only a group
 * still below the fold when motion is allowed is held back until it enters.
 */
export function useReveal<T extends HTMLElement>(): RefObject<T | null> {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !motionAllowed() || typeof IntersectionObserver === 'undefined') return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return;
    el.dataset.reveal = 'pending';
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.dataset.reveal = 'in';
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      delete el.dataset.reveal;
    };
  }, []);
  return ref;
}

/** True when a line-clamped element is truncating its text (re-checked on resize / text-size change). */
export function useClamped<T extends HTMLElement>(): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [clamped, setClamped] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setClamped(el.scrollHeight > el.clientHeight + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, clamped];
}

/**
 * Open/close state for a Read more dialog. Records the opener and the page
 * scroll position on open; on close returns focus to the opener without
 * scrolling and restores the scroll position if it moved.
 */
export function useReadMore<T>() {
  const [item, setItem] = useState<T | null>(null);
  const back = useRef<{ el: HTMLElement | null; y: number }>({ el: null, y: 0 });
  const open = useCallback((next: T, opener?: HTMLElement | null) => {
    back.current = { el: opener ?? (document.activeElement as HTMLElement | null), y: window.scrollY };
    setItem(next);
  }, []);
  const close = useCallback(() => {
    setItem(null);
    const { el, y } = back.current;
    requestAnimationFrame(() => {
      if (Math.abs(window.scrollY - y) > 1) window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior });
      if (el && el.isConnected) el.focus({ preventScroll: true });
    });
  }, []);
  return { item, open, close };
}
