'use client';

/**
 * Integrated scroll-aware header (NAV-01, brief 29 "Navbar state contract").
 *  - top (≤24px): blends with the hero, no bar/border/shadow
 *  - scrolling down past the top: slides out (transform only, no layout change)
 *  - scrolling up away from the top: returns fixed, compact, opaque
 *  - direction must accumulate ~12px before switching (no flicker)
 *  - stays visible while focus is inside, a menu is open, or after anchor jumps
 */
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type FocusEvent } from 'react';
import { useDailySession } from './DailySession';
import { DisplaySettings } from './DisplaySettings';
import { Logo } from './Logo';

const TOP_ZONE = 24;
const DIRECTION_THRESHOLD = 12;

export const NAV_LINKS = [
  { href: '/tests', label: 'Tests' },
  { href: '/products', label: 'Products' },
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/#faq', label: 'Science & FAQ' },
];

type Mode = 'top' | 'hidden' | 'shown';

export function SiteHeader() {
  const daily = useDailySession();
  const signedIn = daily?.state.status === 'signedIn';
  const account = signedIn ? { href: '/account/progress', label: 'Your progress' } : { href: '/sign-in', label: 'Sign in' };
  const [mode, setMode] = useState<Mode>('top');
  const [instant, setInstant] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [displayOpen, setDisplayOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const displayButtonRef = useRef<HTMLButtonElement>(null);
  const lock = useRef({ focus: false, anchorUntil: 0 });
  const menuOpenRef = useRef(false);
  menuOpenRef.current = menuOpen || displayOpen;

  useEffect(() => {
    let lastY = window.scrollY;
    let acc = 0;
    let ticking = false;
    const evaluate = () => {
      ticking = false;
      const y = window.scrollY;
      const delta = y - lastY;
      lastY = y;
      if (y <= TOP_ZONE) {
        acc = 0;
        setMode('top');
        return;
      }
      if ((delta > 0 && acc < 0) || (delta < 0 && acc > 0)) acc = 0;
      acc += delta;
      const locked = lock.current.focus || menuOpenRef.current || performance.now() < lock.current.anchorUntil;
      if (acc > DIRECTION_THRESHOLD && !locked) {
        setInstant(false);
        setMode('hidden');
        acc = 0;
      } else if (acc < -DIRECTION_THRESHOLD) {
        setInstant(false);
        setMode('shown');
        acc = 0;
      } else {
        setMode((m) => (m === 'top' ? (locked ? 'shown' : 'hidden') : m));
      }
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(evaluate);
      }
    };
    const onHash = () => {
      lock.current.anchorUntil = performance.now() + 700;
      setMode((m) => (m === 'top' ? m : 'shown'));
    };
    evaluate();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('hashchange', onHash);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('hashchange', onHash);
    };
  }, []);

  // Keyboard focus entering a hidden header reveals it immediately.
  const onFocusCapture = useCallback(() => {
    lock.current.focus = true;
    setInstant(true);
    setMode((m) => (m === 'hidden' ? 'shown' : m));
  }, []);
  const onBlurCapture = useCallback((e: FocusEvent) => {
    if (!headerRef.current?.contains(e.relatedTarget as Node | null)) lock.current.focus = false;
  }, []);

  // Escape closes whichever panel is open and restores focus.
  useEffect(() => {
    if (!menuOpen && !displayOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (menuOpen) {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      } else if (displayOpen) {
        setDisplayOpen(false);
        displayButtonRef.current?.focus();
      }
    };
    const onPointer = (e: PointerEvent) => {
      if (!headerRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
        setDisplayOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [menuOpen, displayOpen]);

  const closeAll = () => {
    setMenuOpen(false);
    setDisplayOpen(false);
    lock.current.anchorUntil = performance.now() + 700;
  };

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header
        ref={headerRef}
        className="site-header"
        data-mode={mode}
        data-instant={instant ? 'true' : undefined}
        onFocusCapture={onFocusCapture}
        onBlurCapture={onBlurCapture}
      >
        <div className="header-inner">
          <Link href="/" className="header-logo" aria-label="Rhythm Biome home" onClick={closeAll}>
            <Logo />
          </Link>
          <nav aria-label="Main" className="header-nav">
            <ul>
              {NAV_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} onClick={closeAll}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="header-actions">
            <div className="popover-host header-display">
              <button
                ref={displayButtonRef}
                type="button"
                className="btn btn-quiet"
                aria-expanded={displayOpen}
                aria-controls="display-popover"
                onClick={() => {
                  setDisplayOpen((v) => !v);
                  setMenuOpen(false);
                }}
              >
                Display
              </button>
              {displayOpen ? (
                <div id="display-popover" className="popover" role="group" aria-label="Display settings">
                  <DisplaySettings />
                </div>
              ) : null}
            </div>
            <Link href={account.href} className="header-signin" onClick={closeAll}>
              {account.label}
            </Link>
            <Link href="/tests" className="btn btn-primary header-cta" onClick={closeAll}>
              Book a kit
            </Link>
            <button
              ref={menuButtonRef}
              type="button"
              className="btn btn-quiet header-menu-button"
              aria-expanded={menuOpen}
              aria-controls="site-menu"
              onClick={() => {
                setMenuOpen((v) => !v);
                setDisplayOpen(false);
              }}
            >
              <span className="menu-icon" aria-hidden="true" data-open={menuOpen ? 'true' : undefined}>
                <span />
                <span />
              </span>
              Menu
            </button>
          </div>
        </div>
        {menuOpen ? (
          <div id="site-menu" className="site-menu">
            <nav aria-label="Menu">
              <ul>
                {NAV_LINKS.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} onClick={closeAll}>
                      {l.label}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link href={account.href} onClick={closeAll}>
                    {account.label}
                  </Link>
                </li>
                <li className="menu-cta">
                  <Link href="/tests" onClick={closeAll}>
                    Book a kit
                  </Link>
                </li>
              </ul>
            </nav>
            <DisplaySettings />
          </div>
        ) : null}
      </header>
    </>
  );
}
