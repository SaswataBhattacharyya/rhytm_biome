'use client';

/**
 * Homepage-only microbial realm island (planning 34).
 * Owns: background WebGL canvas, foreground skimmer overlay, pointer-only
 * microbe targets, scroll → progress, roam waypoints from the DOM, pause /
 * visibility / dialog pause, and teardown.
 *
 * Review query parameters (D0 only):
 *   ?lens=0.5   freeze progress at p
 *   ?t=12       freeze both clocks at t seconds (deterministic captures)
 *   ?static=1   force the static poster
 *   ?seed=42    alternate organism seed
 *   ?targets=1  outline hit targets (review)
 *   ?cross=demo shorter quiet gaps between control crossings (review)
 *   ?crossSeed=7 seed for crossing decisions (reproducible sample)
 *   ?encounter=1 start the pair encounter as soon as a pair is visible (review)
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { KNOWLEDGE_KEY_BY_MORPHOLOGY, type MicrobeKind } from '@rb-lab/shared';
import { useKnowledge } from './KnowledgeProvider';
import { usePrefs } from './PrefsProvider';
import { LensPoster, PosterField } from './LensPoster';
import { authoredRoamPoints, progressFromScroll, type DOMRectLike } from '../microscope/layout';
import type { FrameInfo, MicroscopeEngine } from '../microscope/engine';

type Mode = 'pending' | 'live' | 'static';

interface ReviewParams {
  lens: number | null;
  t: number | null;
  forceStatic: boolean;
  seed: number | undefined;
  showTargets: boolean;
  crossDemo: boolean;
  crossSeed: number;
  encounterSoon: boolean;
}

function readParams(): ReviewParams {
  const q = new URLSearchParams(window.location.search);
  const num = (k: string) => {
    const v = q.get(k);
    if (v === null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  return {
    lens: num('lens'),
    t: num('t'),
    forceStatic: q.get('static') === '1',
    seed: num('seed') ?? undefined,
    showTargets: q.get('targets') === '1',
    crossDemo: q.get('cross') === 'demo',
    crossSeed: num('crossSeed') ?? 3,
    encounterSoon: q.get('encounter') === '1',
  };
}

/** Opening lens: position/size of the hero's lens anchor at scroll 0. */
function measureAnchor() {
  const el = document.querySelector<HTMLElement>('[data-lens-anchor]');
  if (!el) return { x: window.innerWidth * 0.7, y: window.innerHeight * 0.5, r: 180 };
  const rect = el.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + window.scrollY + rect.height / 2, r: rect.width / 2 };
}

function visibleRect(sel: string): DOMRectLike | null {
  const els = Array.from(document.querySelectorAll<HTMLElement>(sel));
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      const top = r.top + window.scrollY;
      return { left: r.left, right: r.right, top, bottom: top + r.height, width: r.width, height: r.height };
    }
  }
  return null;
}

function unionRect(sels: string[]): DOMRectLike | null {
  const rects = sels.map(visibleRect).filter((r): r is DOMRectLike => r !== null);
  if (!rects.length) return null;
  const left = Math.min(...rects.map((r) => r.left));
  const top = Math.min(...rects.map((r) => r.top));
  const right = Math.max(...rects.map((r) => r.right));
  const bottom = Math.max(...rects.map((r) => r.bottom));
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

function measureRoamPoints() {
  const anchor = measureAnchor();
  return authoredRoamPoints({
    anchor,
    navControl: visibleRect('.header-cta, .header-menu-button'),
    heroActions: visibleRect('.hero .hero-actions'),
    avoid: unionRect(['.hero h1', '.hero .lede']),
    viewport: { w: window.innerWidth, h: window.innerHeight },
  });
}

export function MicroscopeStage() {
  const { theme, paused, reducedMotion } = usePrefs();
  const knowledge = useKnowledge();
  const [mode, setMode] = useState<Mode>('pending');
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const targetsRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<MicroscopeEngine | null>(null);
  const paramsRef = useRef<ReviewParams | null>(null);
  const prefsRef = useRef({ theme, paused, dialog: knowledge.isOpen });
  prefsRef.current = { theme, paused, dialog: knowledge.isOpen };
  const openRef = useRef(knowledge.open);
  openRef.current = knowledge.open;

  useEffect(() => {
    paramsRef.current = readParams();
    setAnchorEl(document.querySelector<HTMLElement>('[data-lens-anchor]'));
    const p = paramsRef.current;
    const rm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setMode(p.forceStatic || rm ? 'static' : 'live');
  }, []);

  useEffect(() => {
    if (reducedMotion && mode === 'live') setMode('static');
  }, [reducedMotion, mode]);

  useEffect(() => {
    if (mode !== 'live') return;
    let cancelled = false;
    let cleanup = () => {};
    Promise.all([import('../microscope/engine'), import('../microscope/crossings'), import('../microscope/hitTargets')]).then(
      ([{ MicroscopeEngine }, { CrossingLayer }, { HitTargets }]) => {
        const canvas = canvasRef.current;
        const overlay = overlayRef.current;
        const targetsEl = targetsRef.current;
        if (cancelled || !canvas || !overlay || !targetsEl) return;
        if (!MicroscopeEngine.isSupported()) {
          setMode('static');
          return;
        }
        const params = paramsRef.current!;
        // Controls an organism may occasionally cross (hero + navbar, CROSS-01).
        const hosts = () =>
          Array.from(
            document.querySelectorAll<HTMLElement>('.hero .hero-actions .btn, .header-cta, .header-menu-button, .header-display > button'),
          ).filter((el) => el.getBoundingClientRect().width > 0);

        let engine: MicroscopeEngine;
        let crossings: InstanceType<typeof CrossingLayer> | null = null;
        let lastInfo: FrameInfo | null = null;
        const targets = new HitTargets({
          container: targetsEl,
          onHover: (i) => engine?.setHovered(i),
          onSelect: (kind: MicrobeKind, el) => openRef.current(KNOWLEDGE_KEY_BY_MORPHOLOGY[kind], el),
        });
        const onFrame = (info: FrameInfo) => {
          lastInfo = info;
          targets.update(info);
          // Crossings only while the lens roams at the top of the page.
          crossings?.update(info, prefsRef.current.theme, info.progress < 0.04);
        };
        try {
          engine = new MicroscopeEngine(canvas, {
            seed: params.seed,
            theme: prefsRef.current.theme,
            paused: prefsRef.current.paused || prefsRef.current.dialog || params.t !== null,
            getAnchor: measureAnchor,
            getRoamPoints: measureRoamPoints,
            onFallback: () => {
              delete document.documentElement.dataset.scene;
              setMode('static');
            },
            onFrame,
            encounterSoon: params.encounterSoon,
          });
        } catch {
          setMode('static');
          return;
        }
        crossings = new CrossingLayer(overlay, engine, { seed: params.crossSeed, demo: params.crossDemo });
        // REVEAL-01: open the runway only while the live scene actually runs.
        document.documentElement.dataset.scene = 'live';
        crossings.setHosts(hosts());
        crossings.resize();
        engineRef.current = engine;
        if (params.t !== null) engine.setTime(params.t);

        const zone = document.getElementById('scene-zone');
        let zoneVisible = true;
        const update = () => {
          const p = params.lens ?? progressFromScroll(window.scrollY, window.innerHeight);
          engine.setProgress(p);
          targets.invalidate();
          if (zone) {
            const bottom = zone.getBoundingClientRect().bottom;
            const fade = Math.max(0, Math.min(1, bottom / (window.innerHeight * 0.6)));
            canvas.style.opacity = String(fade);
            const active = zoneVisible && fade > 0.01 && document.visibilityState === 'visible';
            engine.setActive(active);
            targets.setEnabled(active && fade > 0.5);
            if (!active) {
              crossings?.release();
              crossings?.clear();
            }
          }
        };
        let ticking = false;
        const onScroll = () => {
          if (ticking) return;
          ticking = true;
          requestAnimationFrame(() => {
            ticking = false;
            update();
          });
        };
        const onResize = () => {
          engine.resize();
          crossings?.setHosts(hosts());
          crossings?.resize();
          targets.invalidate();
          update();
        };
        const onVis = () => update();
        const io = zone
          ? new IntersectionObserver(([entry]) => {
              zoneVisible = entry.isIntersecting;
              update();
            })
          : null;
        if (zone && io) io.observe(zone);
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onResize);
        document.addEventListener('visibilitychange', onVis);
        update();

        (window as unknown as Record<string, unknown>).__rbD0 = {
          snapshot: () => engine.snapshot(),
          trackedDiameter: (i?: number) => engine.trackedDiameter(i),
          setTime: (t: number) => engine.setTime(t),
          targets: () => targets.targets(),
          exclusions: () => targets.exclusionRects().map((r) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom })),
          // Relay 03 review hooks
          forceCrossing: () => (lastInfo ? crossings?.force(lastInfo) ?? false : false),
          crossLog: () => crossings?.log() ?? [],
          crossingActive: () => crossings?.isActive() ?? false,
          triggerEncounter: () => engine.triggerEncounter(),
          events: () => engine.events(),
          previewWriggle: (i: number | null, tau?: number) => engine.previewWriggle(i, tau),
          hover: (i: number | null) => engine.setHovered(i),
          organisms: () => (lastInfo ? lastInfo.organisms.map((o) => ({ ...o })) : []),
        };

        cleanup = () => {
          io?.disconnect();
          window.removeEventListener('scroll', onScroll);
          window.removeEventListener('resize', onResize);
          document.removeEventListener('visibilitychange', onVis);
          delete document.documentElement.dataset.scene;
          targets.dispose();
          crossings?.release();
          crossings?.clear();
          engine.dispose();
          engineRef.current = null;
          delete (window as unknown as Record<string, unknown>).__rbD0;
        };
      },
    );
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [mode]);

  useEffect(() => {
    engineRef.current?.setTheme(theme);
  }, [theme]);

  // Opening a card pauses the world; closing restores the user's own choice.
  useEffect(() => {
    const frozen = paramsRef.current?.t !== null && paramsRef.current?.t !== undefined;
    engineRef.current?.setPaused(paused || knowledge.isOpen || frozen);
    if (knowledge.isOpen) engineRef.current?.setHovered(null);
  }, [paused, knowledge.isOpen]);

  const showTargets = paramsRef.current?.showTargets ?? false;

  return (
    <>
      {mode === 'live' ? <canvas ref={canvasRef} className="scene-canvas" aria-hidden="true" /> : null}
      {mode === 'live' ? <canvas ref={overlayRef} className="skimmer-canvas" aria-hidden="true" /> : null}
      {mode === 'live' ? (
        <div ref={targetsRef} className="microbe-targets" data-show={showTargets ? 'true' : undefined} aria-hidden="true" />
      ) : null}
      {mode === 'static' ? <PosterField theme={theme} /> : null}
      {mode === 'static' && anchorEl
        ? createPortal(
            <LensPoster theme={theme} onSelect={(kind, el) => knowledge.open(KNOWLEDGE_KEY_BY_MORPHOLOGY[kind], el)} />,
            anchorEl,
          )
        : null}
      <p className="sr-only" aria-live="polite">
        {mode === 'static' ? 'Showing a still microscope illustration. Use Meet the microbes to open cards.' : ''}
      </p>
    </>
  );
}
