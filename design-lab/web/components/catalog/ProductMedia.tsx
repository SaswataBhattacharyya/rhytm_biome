'use client';
/* eslint-disable @next/next/no-img-element -- catalogue media are plain sized images (local preview assets or API URLs) */

/**
 * Product media (Relay 07, plan 36).
 *
 *  CardMedia      — cover by default. With ≥2 images, an intentional mouse
 *                   hover (350 ms) starts a restrained crossfade sequence on
 *                   that card only. It stops and resets to the cover on leave,
 *                   when the card scrolls out of view, when the tab or window
 *                   loses focus, when a dialog opens, when motion is paused or
 *                   reduced, and on unmount. Geometry is reserved (4:3), so
 *                   price and link never move. Touch/keyboard never autoplay.
 *  ProductGallery — manual detail gallery: previous/next, thumbnails, arrow
 *                   keys, swipe; single image shows no controls.
 *  MediaFallback  — the brand lockup on a tinted panel when there is no media.
 */
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { PREVIEW_MEDIA_SCHEME, type Media } from '@rb-lab/shared';
import { Logo } from '../Logo';

const HOVER_INTENT_MS = 350;
const STEP_MS = 1400;

/** Preview scheme → bundled asset; http(s) passes through; anything else is ignored. */
export function mediaSrc(url: string): string | null {
  if (url.startsWith(PREVIEW_MEDIA_SCHEME)) return `/catalog-preview/${url.slice(PREVIEW_MEDIA_SCHEME.length)}.png`;
  if (/^https?:\/\//.test(url)) return url;
  return null;
}

const usable = (media: Media[]) => media.filter((m) => mediaSrc(m.url));

export function MediaFallback({ label }: { label: string }) {
  return (
    <div className="media-fallback" role="img" aria-label={`${label} — no image yet`}>
      <Logo height={28} />
    </div>
  );
}

function motionAllowed() {
  if (typeof window === 'undefined') return false;
  if (document.documentElement.dataset.motion === 'paused') return false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  if (document.querySelector('dialog[open], [aria-modal="true"]')) return false;
  return document.visibilityState === 'visible';
}

/** Only one card animates at a time (rapid hover between cards). */
let stopActiveCard: (() => void) | null = null;

export function CardMedia({ media, title }: { media: Media[]; title: string }) {
  const items = usable(media);
  const [idx, setIdx] = useState(0);
  const [armed, setArmed] = useState(false); // non-cover images mounted (progressive load)
  const [running, setRunning] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const intent = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (intent.current) clearTimeout(intent.current);
    if (tick.current) clearInterval(tick.current);
    intent.current = null;
    tick.current = null;
    setRunning(false);
    setIdx(0); // next entry starts from the cover
    if (stopActiveCard === stop) stopActiveCard = null;
  }, []);

  const start = useCallback(() => {
    if (items.length < 2 || !motionAllowed()) return;
    if (stopActiveCard && stopActiveCard !== stop) stopActiveCard();
    stopActiveCard = stop;
    setRunning(true);
    tick.current = setInterval(() => {
      if (!motionAllowed()) {
        stop();
        return;
      }
      setIdx((i) => (i + 1) % items.length);
    }, STEP_MS);
  }, [items.length, stop]);

  const onEnter = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || items.length < 2) return;
    setArmed(true);
    if (intent.current) clearTimeout(intent.current);
    intent.current = setTimeout(start, HOVER_INTENT_MS);
  };

  // Stop when offscreen, on tab/window blur, when motion is paused, and on unmount.
  useEffect(() => {
    if (items.length < 2) return;
    const el = ref.current;
    const io = typeof IntersectionObserver !== 'undefined' && el ? new IntersectionObserver(([en]) => !en.isIntersecting && stop()) : null;
    if (io && el) io.observe(el);
    const onVis = () => document.visibilityState !== 'visible' && stop();
    const mo = new MutationObserver(() => document.documentElement.dataset.motion === 'paused' && stop());
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', stop);
    window.addEventListener('scroll', onScrollCheck, { passive: true });
    function onScrollCheck() {
      // IntersectionObserver covers most cases; this catches fast flings.
      const r = el?.getBoundingClientRect();
      if (r && (r.bottom < 0 || r.top > window.innerHeight)) stop();
    }
    return () => {
      io?.disconnect();
      mo.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', stop);
      window.removeEventListener('scroll', onScrollCheck);
      stop();
    };
  }, [items.length, stop]);

  if (!items.length) return <div className="card-media" ref={ref}><MediaFallback label={title} /></div>;
  return (
    <div
      className="card-media"
      ref={ref}
      onPointerEnter={onEnter}
      onPointerLeave={stop}
      data-running={running || undefined}
      data-index={idx}
    >
      {items.map((m, i) =>
        i === 0 || armed ? (
          <img
            key={m.id}
            src={mediaSrc(m.url)!}
            alt={i === 0 ? m.alt_text : ''}
            aria-hidden={i === 0 ? undefined : true}
            width={m.width}
            height={m.height}
            loading={i === 0 ? 'eager' : 'lazy'}
            decoding="async"
            className="media-layer"
            data-on={i === idx || undefined}
            draggable={false}
          />
        ) : null,
      )}
      {items.length > 1 ? (
        <span className="media-count" aria-hidden="true">
          {items.length} images
        </span>
      ) : null}
    </div>
  );
}

export function ProductGallery({ media, title }: { media: Media[]; title: string }) {
  const items = usable(media);
  const [idx, setIdx] = useState(0);
  const startX = useRef<number | null>(null);
  const n = items.length;
  const go = useCallback((i: number) => setIdx(((i % n) + n) % n), [n]);

  if (!n) return <div className="gallery-main"><MediaFallback label={title} /></div>;
  if (n === 1) {
    const m = items[0];
    return (
      <div className="gallery-main">
        <img src={mediaSrc(m.url)!} alt={m.alt_text} width={m.width} height={m.height} className="media-layer" data-on />
      </div>
    );
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      go(idx + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(idx - 1);
    }
  };
  return (
    <div className="gallery" role="group" aria-roledescription="gallery" aria-label={`${title} images`} onKeyDown={onKey}>
      <div
        className="gallery-main"
        onPointerDown={(e) => {
          if (e.pointerType !== 'mouse') startX.current = e.clientX;
        }}
        onPointerUp={(e) => {
          if (startX.current === null) return;
          const dx = e.clientX - startX.current;
          startX.current = null;
          if (Math.abs(dx) > 40) go(idx + (dx < 0 ? 1 : -1));
        }}
      >
        {items.map((m, i) => (
          <img
            key={m.id}
            src={mediaSrc(m.url)!}
            alt={i === idx ? m.alt_text : ''}
            aria-hidden={i === idx ? undefined : true}
            width={m.width}
            height={m.height}
            loading={i === 0 ? 'eager' : 'lazy'}
            className="media-layer"
            data-on={i === idx || undefined}
            draggable={false}
          />
        ))}
        <button type="button" className="gallery-nav" data-dir="prev" onClick={() => go(idx - 1)} aria-label="Previous image">
          <span aria-hidden="true">‹</span>
        </button>
        <button type="button" className="gallery-nav" data-dir="next" onClick={() => go(idx + 1)} aria-label="Next image">
          <span aria-hidden="true">›</span>
        </button>
      </div>
      <p className="gallery-count" aria-live="polite">
        Image {idx + 1} of {n}
      </p>
      <div className="gallery-thumbs">
        {items.map((m, i) => (
          <button
            key={m.id}
            type="button"
            className="gallery-thumb"
            aria-label={`Show image ${i + 1} of ${n}`}
            aria-current={i === idx || undefined}
            onClick={() => go(i)}
          >
            <img src={mediaSrc(m.url)!} alt="" width={96} height={72} loading="lazy" />
          </button>
        ))}
      </div>
    </div>
  );
}
