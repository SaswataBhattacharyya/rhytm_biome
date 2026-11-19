'use client';

/**
 * One row of equal-size trust cards. Cards per view follow the container
 * width in rem, so larger text gives fewer, wider cards that grow together.
 * When the row overflows, manual Previous/Next controls and a position
 * readout appear (no autoplay); when every card fits they are not rendered.
 * Touch users can also swipe; paging slides only when motion is allowed.
 * Ends use aria-disabled (not disabled) so keyboard focus is never dropped.
 */
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { motionAllowed } from './useTrust';

interface RailState {
  overflow: boolean;
  first: number;
  last: number;
  atStart: boolean;
  atEnd: boolean;
}

export function CardRail({ label, noun, count, children }: { label: string; noun: string; count: number; children: ReactNode }) {
  const track = useRef<HTMLUListElement>(null);
  const id = useId();
  const [st, setSt] = useState<RailState>({ overflow: false, first: 0, last: count - 1, atStart: true, atEnd: true });

  const measure = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    let first = -1;
    let last = -1;
    Array.from(el.children).forEach((c, i) => {
      const r = c.getBoundingClientRect();
      if (r.left >= box.left - 2 && r.right <= box.right + 2) {
        if (first < 0) first = i;
        last = i;
      }
    });
    const next: RailState = {
      overflow: el.scrollWidth > el.clientWidth + 2,
      first: Math.max(0, first),
      last: Math.max(0, last),
      atStart: el.scrollLeft <= 2,
      atEnd: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2,
    };
    setSt((p) => (p.overflow === next.overflow && p.first === next.first && p.last === next.last && p.atStart === next.atStart && p.atEnd === next.atEnd ? p : next));
  }, []);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    measure();
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    const ro = new ResizeObserver(onScroll);
    ro.observe(el);
    Array.from(el.children).forEach((c) => ro.observe(c));
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      el.removeEventListener('scroll', onScroll);
    };
  }, [measure, count]);

  const page = (dir: -1 | 1) => {
    const el = track.current;
    const card = el?.children[0] as HTMLElement | undefined;
    if (!el || !card) return;
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
    const perView = Math.max(1, st.last - st.first + 1);
    el.scrollBy({ left: dir * perView * (card.offsetWidth + gap), behavior: motionAllowed() ? 'smooth' : 'auto' });
  };

  return (
    <div className="trust-rail" data-overflow={st.overflow || undefined}>
      <ul ref={track} id={id} className="trust-track" aria-label={label}>
        {children}
      </ul>
      {st.overflow ? (
        <div className="rail-controls">
          <button type="button" className="rail-btn" aria-controls={id} aria-label={`Previous ${noun}`} aria-disabled={st.atStart || undefined} onClick={() => !st.atStart && page(-1)}>
            <span aria-hidden="true">←</span>
          </button>
          <p className="rail-pos" aria-live="polite">
            {st.first + 1}
            {st.last > st.first ? `–${st.last + 1}` : ''} of {count}
          </p>
          <button type="button" className="rail-btn" aria-controls={id} aria-label={`Next ${noun}`} aria-disabled={st.atEnd || undefined} onClick={() => !st.atEnd && page(1)}>
            <span aria-hidden="true">→</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
