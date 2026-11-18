/**
 * Pointer-only selection targets for freely visible microbes (34 LEARN-01).
 *
 *  - Only target elements receive input; their container is pointer-transparent
 *    (no viewport-sized blocker).
 *  - Targets exist only in free space: never over links, buttons, form
 *    controls, headings, paragraphs, panels, the header or lower page.
 *  - A hovered target latches: it stops following the organism and stays put
 *    while the engine holds that organism in place and lets it wriggle.
 *  - Targets are aria-hidden and not focusable; the semantic "Meet the
 *    microbes" list is the keyboard / screen-reader / static equivalent.
 */
import type { MicrobeKind } from '@rb-lab/shared';
import type { FrameInfo } from './engine';

export interface HitTargetOptions {
  container: HTMLElement;
  onHover: (index: number | null) => void;
  onSelect: (kind: MicrobeKind, el: HTMLElement) => void;
}

interface Live {
  index: number;
  kind: MicrobeKind;
  el: HTMLDivElement;
  x: number;
  y: number;
  R: number;
  latchedUntil: number;
  hovering: boolean;
}

export const EXCLUDE_SELECTOR = [
  'a',
  'button',
  'input',
  'select',
  'textarea',
  'summary',
  'label',
  '[role="button"]',
  '[tabindex]:not([tabindex="-1"])',
  'h1',
  'h2',
  'h3',
  'p',
  '.panel',
  '.services-head',
  '.site-header',
  '.site-menu',
  '.lower',
  '.popover',
  '[data-no-microbe-target]',
].join(',');

const LATCH_MS = 450;
const MIN_RADIUS = 24; // ≥48px activation target

export class HitTargets {
  private opts: HitTargetOptions;
  private live = new Map<number, Live>();
  private exclusions: DOMRect[] = [];
  private lastExclusion = 0;
  private enabled = true;
  private hovered: Live | null = null;

  constructor(opts: HitTargetOptions) {
    this.opts = opts;
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) this.clear();
  }

  /** Force exclusion rects to be re-measured on the next update (scroll/resize). */
  invalidate() {
    this.lastExclusion = 0;
  }

  /** Current exclusion rects (for review tooling). */
  exclusionRects() {
    return this.exclusions;
  }

  /** Current live targets (for review tooling). */
  targets() {
    return [...this.live.values()].map((t) => ({ index: t.index, kind: t.kind, x: t.x, y: t.y, R: t.R, latched: t.hovering || t.latchedUntil > performance.now() }));
  }

  update(info: FrameInfo) {
    if (!this.enabled) return;
    const now = performance.now();
    if (now - this.lastExclusion > 120) {
      this.lastExclusion = now;
      this.exclusions = [];
      document.querySelectorAll<HTMLElement>(EXCLUDE_SELECTOR).forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < info.height && r.right > 0 && r.left < info.width) this.exclusions.push(r);
      });
    }
    const narrow = info.width < 700;
    const max = narrow ? 5 : 8;
    const free = (x: number, y: number, R: number, self: number) => {
      if (x - R < 6 || y - R < 6 || x + R > info.width - 6 || y + R > info.height - 6) return false;
      for (const r of this.exclusions) {
        const pad = 8;
        const nx = Math.max(r.left - pad, Math.min(x, r.right + pad));
        const ny = Math.max(r.top - pad, Math.min(y, r.bottom + pad));
        if (Math.hypot(x - nx, y - ny) < R) return false;
      }
      for (const t of this.live.values()) {
        if (t.index !== self && Math.hypot(t.x - x, t.y - y) < t.R + R + 4) return false;
      }
      return true;
    };

    // 1 — refresh or retire existing targets
    for (const t of [...this.live.values()]) {
      const latched = t.hovering || t.latchedUntil > now;
      if (latched) {
        // Stays put while the engine holds its organism here — unless page
        // content has scrolled underneath it, which would risk interception.
        if (!free(t.x, t.y, t.R, t.index)) this.remove(t);
        continue;
      }
      const o = info.organisms[t.index];
      const R = Math.max(MIN_RADIUS, o.r * 1.35 + 6);
      if (o.hidden || !o.inFocus || o.depth < 0.35 || !free(o.x, o.y, R, t.index)) {
        this.remove(t);
        continue;
      }
      t.x = o.x;
      t.y = o.y;
      t.R = R;
      this.place(t);
    }

    // 2 — add new targets, nearest/larger first
    if (this.live.size < max) {
      const candidates = info.organisms
        .filter((o) => !o.hidden && o.inFocus && o.depth >= 0.35 && !this.live.has(o.index))
        .sort((a, b) => b.depth - a.depth);
      for (const o of candidates) {
        if (this.live.size >= max) break;
        const R = Math.max(MIN_RADIUS, o.r * 1.35 + 6);
        if (!free(o.x, o.y, R, o.index)) continue;
        this.add(o.index, o.kind, o.x, o.y, R);
      }
    }
  }

  clear() {
    for (const t of [...this.live.values()]) this.remove(t);
    if (this.hovered) {
      this.hovered = null;
      this.opts.onHover(null);
    }
  }

  dispose() {
    this.clear();
  }

  private add(index: number, kind: MicrobeKind, x: number, y: number, R: number) {
    const el = document.createElement('div');
    el.className = 'microbe-target';
    el.setAttribute('aria-hidden', 'true');
    el.dataset.kind = kind;
    el.dataset.index = String(index);
    const t: Live = { index, kind, el, x, y, R, latchedUntil: 0, hovering: false };
    el.addEventListener('pointerenter', () => {
      t.hovering = true;
      if (this.hovered && this.hovered !== t) this.hovered.hovering = false;
      this.hovered = t;
      this.opts.onHover(index);
    });
    el.addEventListener('pointerleave', () => {
      t.hovering = false;
      t.latchedUntil = performance.now() + LATCH_MS;
      window.setTimeout(() => {
        if (this.hovered === t && !t.hovering) {
          this.hovered = null;
          this.opts.onHover(null);
        }
      }, LATCH_MS);
    });
    el.addEventListener('click', () => this.opts.onSelect(kind, el));
    this.live.set(index, t);
    this.place(t);
    this.opts.container.appendChild(el);
  }

  private place(t: Live) {
    const d = Math.round(t.R * 2);
    t.el.style.width = `${d}px`;
    t.el.style.height = `${d}px`;
    t.el.style.transform = `translate3d(${(t.x - t.R).toFixed(1)}px, ${(t.y - t.R).toFixed(1)}px, 0)`;
  }

  private remove(t: Live) {
    t.el.remove();
    this.live.delete(t.index);
    if (this.hovered === t) {
      this.hovered = null;
      this.opts.onHover(null);
    }
  }
}
