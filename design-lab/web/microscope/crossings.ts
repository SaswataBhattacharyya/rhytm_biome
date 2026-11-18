/**
 * CROSS-01 — occasional incidental crossings of controls (Relay 03).
 * Replaces the Relay 02 recurring button orbits.
 *
 * A crossing is a chance encounter between an existing organism's trajectory
 * and a nearby control. When an organism enters the proximity band of a
 * control while heading toward it, a seeded decision (respecting global and
 * per-control cooldowns) chooses between passing by (most of the time) or one
 * of three crossing styles: easing along an edge, climbing across a corner, or
 * travelling across a quiet band of a wide control's face. The engine hands
 * that same organism to this pointer-transparent foreground layer and takes
 * it back where the crossing ends, so identity is kept throughout.
 *
 * Controls keep their size, label, focus ring and click target. While a
 * control is hovered, focused or pressed, a crossing over it fades right down.
 */
import { createRng, rimColor, shapeOf, shapeToSvg, type ThemeName } from '@rb-lab/shared';
import type { FrameInfo, OrganismVisual } from './engine';

export type CrossingVariant = 'edge' | 'corner' | 'face';

export interface CrossingLogEntry {
  t: number;
  kind: 'cross' | 'pass';
  host: string;
  organism: string;
  morphology: string;
  variant?: CrossingVariant;
  side?: 'top' | 'right' | 'bottom' | 'left';
  direction?: 'cw' | 'ccw';
}

export interface CrossingEngine {
  beginCrossing(index: number): OrganismVisual | null;
  endCrossing(index: number, sx: number, sy: number, heading: number, angle?: number): void;
}

export interface CrossingOptions {
  seed: number;
  /** Review mode: shorter quiet gaps and a higher chance, same rules otherwise. */
  demo?: boolean;
}

interface Host {
  el: HTMLElement;
  label: string;
  cooldownUntil: number;
}

interface Active {
  index: number;
  host: Host;
  visual: OrganismVisual;
  path: { x: number; y: number }[];
  lengths: number[];
  total: number;
  travelled: number;
  speed: number;
  bodies: Path2D[];
  strands: { path: Path2D; width: number }[];
  angle: number;
  fade: number;
  swimmer: boolean;
}

type Side = 'top' | 'right' | 'bottom' | 'left';

const BAND = 110; // px proximity band around a control
const MAX_CROSSER_RADIUS = 24; // larger organisms pass by instead of crossing

export class CrossingLayer {
  private ctx: CanvasRenderingContext2D | null;
  private canvas: HTMLCanvasElement;
  private engine: CrossingEngine;
  private rng: () => number;
  private demo: boolean;
  private hosts: Host[] = [];
  private inBand = new Set<string>();
  private active: Active | null = null;
  private globalCooldownUntil: number;
  private entries: CrossingLogEntry[] = [];
  private dpr = 1;
  private shown = true;
  /** The first sweep only records who is already near a control (no decisions). */
  private primed = false;

  constructor(canvas: HTMLCanvasElement, engine: CrossingEngine, opts: CrossingOptions) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.engine = engine;
    this.rng = createRng(opts.seed >>> 0);
    this.demo = !!opts.demo;
    this.globalCooldownUntil = this.demo ? 1.5 : 5 + this.rng() * 5;
  }

  setHosts(els: HTMLElement[]) {
    const prev = new Map(this.hosts.map((h) => [h.el, h]));
    this.hosts = els.map((el) => prev.get(el) ?? { el, label: describe(el), cooldownUntil: 0 });
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(window.innerWidth * this.dpr);
    const h = Math.round(window.innerHeight * this.dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  log(): CrossingLogEntry[] {
    return [...this.entries];
  }

  isActive() {
    return this.active !== null;
  }

  /** Per-frame update and draw. `enabled` is false once scrolling has begun. */
  update(info: FrameInfo, theme: ThemeName, enabled: boolean) {
    if (this.active) this.stepActive(info, enabled);
    else if (enabled) this.detect(info);
    this.draw(theme, info.dt);
  }

  /** Review: start a crossing now with the nearest suitable organism. */
  force(info: FrameInfo): boolean {
    if (this.active) return false;
    let best: { i: number; host: Host; d: number } | null = null;
    for (const host of this.hosts) {
      const r = host.el.getBoundingClientRect();
      if (!onScreen(r, info)) continue;
      for (const o of info.organisms) {
        if (o.hidden || o.busy || o.r > MAX_CROSSER_RADIUS || o.depth < 0.3) continue;
        const d = rectDistance(o.x, o.y, r);
        if (d > 0 && d < 220 && (!best || d < best.d)) best = { i: o.index, host, d };
      }
    }
    if (!best) return false;
    return this.start(best.i, best.host, info);
  }

  /** Hand back any crossing organism immediately (scroll start, teardown). */
  release() {
    const a = this.active;
    if (!a) return;
    const p = pointAt(a, a.travelled);
    const q = pointAt(a, Math.min(a.total, a.travelled + 4));
    this.engine.endCrossing(a.index, p.x, p.y, Math.atan2(q.y - p.y, q.x - p.x), a.angle);
    this.active = null;
    this.clear();
  }

  clear() {
    const ctx = this.ctx;
    if (ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    this.setShown(false);
  }

  // ------------------------------------------------------------ detection

  private detect(info: FrameInfo) {
    const t = info.time;
    for (const host of this.hosts) {
      const r = host.el.getBoundingClientRect();
      if (!onScreen(r, info)) continue;
      for (const o of info.organisms) {
        const key = `${host.label}:${o.index}`;
        const d = rectDistance(o.x, o.y, r);
        const inside = d > 0 && d < BAND;
        const was = this.inBand.has(key);
        if (inside && !was) {
          this.inBand.add(key);
          if (!this.primed) continue;
          // Encounter boundary: heading toward the control?
          const cx = Math.max(r.left, Math.min(o.x, r.right));
          const cy = Math.max(r.top, Math.min(o.y, r.bottom));
          const dist = Math.hypot(cx - o.x, cy - o.y) || 1;
          const toward = (Math.cos(o.heading) * (cx - o.x) + Math.sin(o.heading) * (cy - o.y)) / dist > -0.2;
          if (!toward || o.hidden || o.busy || o.depth < 0.3 || o.r > MAX_CROSSER_RADIUS) continue;
          const quiet = t < this.globalCooldownUntil || t < host.cooldownUntil || busy(host.el);
          const chance = this.demo ? 0.85 : 0.5;
          const roll = this.rng(); // seeded decision at the encounter boundary
          if (quiet || roll > chance) {
            this.entries.push({ t, kind: 'pass', host: host.label, organism: `org#${o.index}`, morphology: o.kind });
            continue;
          }
          if (this.start(o.index, host, info)) return;
        } else if (!inside && was) this.inBand.delete(key);
      }
    }
    this.primed = true;
  }

  private start(index: number, host: Host, info: FrameInfo): boolean {
    const o = info.organisms[index];
    const r = host.el.getBoundingClientRect();
    const plan = planPath(o.x, o.y, o.heading, o.r, r, this.rng);
    const visual = this.engine.beginCrossing(index);
    if (!visual) return false;
    const svg = shapeToSvg(shapeOf({ kind: visual.kind, size: visual.size, shapeSeed: visual.shapeSeed }));
    const lengths = [0];
    for (let i = 1; i < plan.points.length; i++) {
      lengths.push(lengths[i - 1] + Math.hypot(plan.points[i].x - plan.points[i - 1].x, plan.points[i].y - plan.points[i - 1].y));
    }
    this.active = {
      index,
      host,
      visual,
      path: plan.points,
      lengths,
      total: lengths[lengths.length - 1],
      travelled: 0,
      speed: Math.max(18, Math.min(34, o.speed * 2.2 + 14)),
      bodies: svg.bodies.map((d) => new Path2D(d)),
      strands: svg.strands.map((s) => ({ path: new Path2D(s.d), width: s.width })),
      angle: visual.angle,
      fade: 1,
      swimmer: visual.kind === 'shortRod' || visual.kind === 'flagellate',
    };
    this.entries.push({
      t: info.time,
      kind: 'cross',
      host: host.label,
      organism: `org#${index}`,
      morphology: visual.kind,
      variant: plan.variant,
      side: plan.side,
      direction: plan.direction,
    });
    return true;
  }

  private stepActive(info: FrameInfo, enabled: boolean) {
    const a = this.active!;
    if (!enabled) {
      this.release();
      return;
    }
    a.travelled = Math.min(a.total, a.travelled + a.speed * info.dt);
    const hostBusy = busy(a.host.el);
    const want = hostBusy ? 0.18 : 1;
    a.fade += (want - a.fade) * Math.min(1, info.dt * 6);
    if (a.travelled >= a.total) {
      const p = pointAt(a, a.total);
      const q = pointAt(a, a.total - 4);
      this.engine.endCrossing(a.index, p.x, p.y, Math.atan2(p.y - q.y, p.x - q.x), a.angle);
      const t = info.time;
      a.host.cooldownUntil = t + (this.demo ? 4 : 14 + this.rng() * 10);
      this.globalCooldownUntil = t + (this.demo ? 2.5 + this.rng() * 1.5 : 6 + this.rng() * 6);
      this.active = null;
    }
  }

  // ------------------------------------------------------------ drawing

  private setShown(v: boolean) {
    if (v === this.shown) return;
    this.shown = v;
    this.canvas.style.visibility = v ? 'visible' : 'hidden';
  }

  private draw(theme: ThemeName, dt: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const a = this.active;
    if (!a) {
      this.setShown(false);
      return;
    }
    this.setShown(true);
    const p = pointAt(a, a.travelled);
    const ahead = pointAt(a, Math.min(a.total, a.travelled + 6));
    const travel = Math.atan2(ahead.y - p.y, ahead.x - p.x);
    if (a.swimmer) {
      const diff = Math.atan2(Math.sin(travel - a.angle), Math.cos(travel - a.angle));
      a.angle += Math.max(-2.5 * dt, Math.min(2.5 * dt, diff));
    } else a.angle += 0.15 * dt;
    const s = a.visual.scale;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalAlpha = 0.95 * a.fade;
    ctx.translate(p.x, p.y);
    ctx.rotate(a.angle + Math.sin(a.travelled * 0.25) * 0.08);
    ctx.scale(s, s);
    ctx.lineCap = 'round';
    ctx.strokeStyle = rimColor(a.visual.color, theme);
    for (const st of a.strands) {
      ctx.lineWidth = Math.max(1.4 / s, st.width);
      ctx.stroke(st.path);
    }
    ctx.fillStyle = a.visual.color;
    ctx.lineWidth = Math.max(0.8, a.visual.size * 0.1);
    for (const b of a.bodies) {
      ctx.fill(b);
      ctx.stroke(b);
    }
    ctx.globalAlpha = 1;
  }
}

// -------------------------------------------------------------- geometry

function onScreen(r: DOMRect, info: FrameInfo) {
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < info.height && r.right > 0 && r.left < info.width;
}

function busy(el: HTMLElement) {
  return el.matches(':hover, :focus-visible, :active');
}

function describe(el: HTMLElement) {
  const where = el.closest('.site-header') ? 'navbar' : 'hero';
  return `${where}:${(el.textContent || el.getAttribute('aria-label') || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 24)}`;
}

/** Distance from a point outside the rect to the rect (0 when inside). */
function rectDistance(x: number, y: number, r: DOMRect) {
  const dx = Math.max(r.left - x, 0, x - r.right);
  const dy = Math.max(r.top - y, 0, y - r.bottom);
  return Math.hypot(dx, dy);
}

function nearestSide(x: number, y: number, r: DOMRect): Side {
  const d: [Side, number][] = [
    ['top', Math.abs(y - r.top)],
    ['bottom', Math.abs(y - r.bottom)],
    ['left', Math.abs(x - r.left)],
    ['right', Math.abs(x - r.right)],
  ];
  if (y < r.top) d[0][1] -= 1000;
  else if (y > r.bottom) d[1][1] -= 1000;
  if (x < r.left) d[2][1] -= 1000;
  else if (x > r.right) d[3][1] -= 1000;
  d.sort((a, b) => a[1] - b[1]);
  return d[0][0];
}

/**
 * Path for one crossing. Edge rides keep the body mostly outside the control
 * (only its rim overlaps the border); corner climbs cut across a corner, away
 * from the centred label; face crossings use the quiet band just inside the
 * top or bottom border of wide, tall controls only.
 */
function planPath(x: number, y: number, heading: number, radius: number, r: DOMRect, rng: () => number) {
  const side = nearestSide(x, y, r);
  const horizontal = side === 'top' || side === 'bottom';
  const out = { top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0] }[side] as [number, number];
  // Travel direction along the side follows the organism's heading.
  const along = horizontal ? Math.sign(Math.cos(heading)) || 1 : Math.sign(Math.sin(heading)) || 1;
  const ride = radius * 0.4; // body centre sits this far outside the border
  const wide = r.width >= 150 && r.height >= 50;
  const roll = rng();
  const variant: CrossingVariant = roll < 0.42 ? 'edge' : roll < 0.84 || !wide || !horizontal ? 'corner' : 'face';
  const pts: { x: number; y: number }[] = [{ x, y }];
  const onSide = (s: number) =>
    horizontal
      ? { x: Math.max(r.left + 6, Math.min(r.right - 6, s)), y: (side === 'top' ? r.top : r.bottom) + out[1] * ride }
      : { x: (side === 'left' ? r.left : r.right) + out[0] * ride, y: Math.max(r.top + 6, Math.min(r.bottom - 6, s)) };
  const start = horizontal ? x : y;
  if (variant === 'edge') {
    const len = Math.min((horizontal ? r.width : r.height) * 0.55, 90);
    const a = onSide(start);
    const b = onSide(start + along * len);
    pts.push(a, b, { x: b.x + out[0] * 60 + (horizontal ? along * 30 : 0), y: b.y + out[1] * 60 + (horizontal ? 0 : along * 30) });
  } else if (variant === 'corner') {
    // Around the corner at the end of this side in the travel direction:
    // approach outside side A, cut across the corner on the surface, leave
    // along adjacent side B and peel back into the field.
    const d: [number, number] = horizontal ? [along, 0] : [0, along];
    const K = {
      x: horizontal ? (along > 0 ? r.right : r.left) : side === 'left' ? r.left : r.right,
      y: horizontal ? (side === 'top' ? r.top : r.bottom) : along > 0 ? r.bottom : r.top,
    };
    const pA = { x: K.x - d[0] * 22 + out[0] * ride, y: K.y - d[1] * 22 + out[1] * ride };
    const pK = { x: K.x - d[0] * 7 - out[0] * 7, y: K.y - d[1] * 7 - out[1] * 7 };
    const pB = { x: K.x - out[0] * 16 + d[0] * ride, y: K.y - out[1] * 16 + d[1] * ride };
    pts.push(pA, pK, pB, { x: pB.x + d[0] * 55 - out[0] * 20, y: pB.y + d[1] * 55 - out[1] * 20 });
  } else {
    // Quiet band just inside the border, across the face, then peel away.
    const yb = side === 'top' ? r.top + 5 : r.bottom - 5;
    const x0 = along > 0 ? r.left + 4 : r.right - 4;
    const x1 = along > 0 ? r.right - 4 : r.left + 4;
    pts.push({ x: x0, y: yb }, { x: x1, y: yb }, { x: x1 + along * 50, y: yb + out[1] * 55 });
  }
  return {
    variant,
    side,
    direction: (horizontal ? out[0] * 0 - out[1] * along : out[0] * along) > 0 ? ('cw' as const) : ('ccw' as const),
    points: smoothPath(pts),
  };
}

/** Densify with Catmull-Rom so the crossing curves smoothly. */
function smoothPath(p: { x: number; y: number }[]) {
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[Math.max(0, i - 1)];
    const p1 = p[i];
    const p2 = p[i + 1];
    const p3 = p[Math.min(p.length - 1, i + 2)];
    for (let k = 0; k < 10; k++) {
      const s = k / 10;
      const cr = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * s + (2 * a - 5 * b + 4 * c - d) * s * s + (-a + 3 * b - 3 * c + d) * s * s * s);
      out.push({ x: cr(p0.x, p1.x, p2.x, p3.x), y: cr(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  out.push(p[p.length - 1]);
  return out;
}

function pointAt(a: Active, dist: number) {
  const L = a.lengths;
  let i = 1;
  while (i < L.length - 1 && L[i] < dist) i++;
  const seg = L[i] - L[i - 1] || 1;
  const t = Math.max(0, Math.min(1, (dist - L[i - 1]) / seg));
  const p = a.path[i - 1];
  const q = a.path[i];
  return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t };
}
