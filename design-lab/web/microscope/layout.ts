/**
 * Pure mappings for the microbial realm (planning 34, stages A–C).
 * All values in CSS px. Proposals for M1 tuning, not final art direction.
 *
 *  A  p = 0         lens roams an authored loop (time-driven)
 *  B  0 → 0.6       lens glides (0 → 0.4) from its *captured* roam pose to centre and
 *                   the aperture expands; organisms begin to spread out
 *  C  0.6 → 0.86    passage through the glass: restrained ripple, rim/sheen
 *                   gone, modest enlargement, translucent interiors appear
 *     ≥ 0.86        no lens composite at all (zero rim/handle/sheen/refraction)
 */

export interface Pt {
  x: number;
  y: number;
  /** Speed multiplier for the segment that starts at this point (default 1). */
  pace?: number;
}

export interface Anchor extends Pt {
  r: number;
}

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const smooth = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeInOutSine = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * t);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

// ------------------------------------------------------------------ roam path

export interface RoamPath {
  points: Pt[];
  /** Cumulative start time (s) of each segment; last entry = loop length. */
  starts: number[];
  total: number;
}

/** Closed loop with segment durations proportional to length (slow, ~speed px/s). */
export function buildRoamPath(points: Pt[], speed = 30, minSegment = 4): RoamPath {
  const starts: number[] = [0];
  let acc = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const pace = a.pace ?? 1;
    acc += Math.max(minSegment / pace, Math.hypot(b.x - a.x, b.y - a.y) / (speed * pace));
    starts.push(acc);
  }
  return { points, starts, total: acc };
}

/** Centripetal-ish Catmull-Rom on a closed loop; C1-continuous, no snaps. */
export function roamPoseAt(path: RoamPath, tSec: number): Pt {
  const n = path.points.length;
  if (n === 0) return { x: 0, y: 0 };
  if (n === 1) return path.points[0];
  const t = ((tSec % path.total) + path.total) % path.total;
  let i = 0;
  while (i < n - 1 && t >= path.starts[i + 1]) i++;
  const u = (t - path.starts[i]) / (path.starts[i + 1] - path.starts[i]);
  // ease within segment so the lens lingers near waypoints
  const s = u * u * (3 - 2 * u) * 0.6 + u * 0.4;
  const p0 = path.points[(i - 1 + n) % n];
  const p1 = path.points[i];
  const p2 = path.points[(i + 1) % n];
  const p3 = path.points[(i + 2) % n];
  const cr = (a: number, b: number, c: number, d: number) =>
    0.5 * (2 * b + (-a + c) * s + (2 * a - 5 * b + 4 * c - d) * s * s + (-a + 3 * b - 3 * c + d) * s * s * s);
  return { x: cr(p0.x, p1.x, p2.x, p3.x), y: cr(p0.y, p1.y, p2.y, p3.y) };
}

export interface RoamTargets {
  anchor: Anchor;
  /** Navbar control the lens briefly skims (e.g. header CTA or Menu button). */
  navControl?: DOMRectLike | null;
  /** Hero actions row the lens briefly skims. */
  heroActions?: DOMRectLike | null;
  /** Headline + lede block the lens must not travel across (reading surface). */
  avoid?: DOMRectLike | null;
  viewport: { w: number; h: number };
}

export interface DOMRectLike {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

/**
 * Authored roam loop around the opening lens position with brief excursions
 * that let the lens edge pass over a navbar control and the hero actions.
 * The lens never parks over the headline: it is drawn beneath the DOM, and
 * excursions are short segments of a ~60 s loop.
 */
export function authoredRoamPoints({ anchor: A, navControl, heroActions, viewport, avoid }: RoamTargets): Pt[] {
  const r = A.r;
  const pts: Pt[] = [
    { x: A.x, y: A.y },
    { x: A.x - 0.3 * r, y: A.y - 0.45 * r },
  ];
  // Navbar excursion on every layout (ROAM-MOBILE-01). When the direct route
  // would sweep across the headline/lede (stacked narrow layout), go up and
  // back down a side gutter beside the copy at a brisker pace, so the
  // reading surface is only briefly and partially covered.
  const navPoint: Pt | null = navControl ? { x: navControl.left + navControl.width * 0.3, y: navControl.bottom + r * 0.62 } : null;
  if (navPoint) {
    if (avoid && segmentNearRect(A, navPoint, avoid, r * 0.6)) {
      const spaceRight = viewport.w - avoid.right;
      const gx = spaceRight > r * 0.9 ? avoid.right + r * 0.75 : viewport.w - r * 0.3;
      pts.push(
        { x: gx, y: avoid.bottom + r * 0.6, pace: 3 },
        { x: gx, y: navPoint.y + r * 0.15, pace: 3 },
        { x: Math.min(navPoint.x, viewport.w - r * 0.3), y: navPoint.y, pace: 2.6 },
        { x: gx - r * 0.08, y: navPoint.y + r * 0.3, pace: 3 },
        { x: gx - r * 0.04, y: avoid.bottom + r * 0.6, pace: 1.8 },
      );
    } else pts.push(navPoint);
  }
  pts.push({ x: A.x + 0.28 * r, y: A.y - 0.12 * r }, { x: A.x + 0.12 * r, y: A.y + 0.42 * r });
  if (heroActions) pts.push({ x: heroActions.right + r * 0.5, y: heroActions.top + heroActions.height * 0.5 + r * 0.15 });
  pts.push({ x: A.x - 0.22 * r, y: A.y + 0.22 * r });
  // keep the lens centre inside a comfortable frame
  // Keep the ordinary loop around the opening lens below the reading block on
  // stacked layouts; only the brisk navbar excursion passes beside it.
  if (avoid) {
    for (const p of pts) {
      if (p.pace !== undefined) continue;
      const overX = p.x > avoid.left - r * 0.3 && p.x < avoid.right + r * 0.3;
      if (overX && p.y < avoid.bottom + r * 0.6 && A.y > avoid.bottom) p.y = avoid.bottom + r * 0.6;
    }
  }
  const minX = r * 0.25;
  const maxX = viewport.w - r * 0.25;
  const minY = r * 0.5;
  const maxY = viewport.h - r * 0.35;
  return pts.map((p) => ({ ...p, x: Math.min(maxX, Math.max(minX, p.x)), y: Math.min(maxY, Math.max(minY, p.y)) }));
}

/** True if the segment a→b passes within `pad` of the rectangle. */
function segmentNearRect(a: Pt, b: Pt, rect: DOMRectLike, pad: number): boolean {
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    if (x > rect.left - pad && x < rect.right + pad && y > rect.top - pad && y < rect.bottom + pad) return true;
  }
  return false;
}

// ------------------------------------------------------------------ scroll stages

export interface RealmState {
  cx: number;
  cy: number;
  r: number;
  rimW: number;
  handleAlpha: number;
  sheen: number;
  refract: number;
  /** 1 = outside blurred + wheat tinted; 0 = outside equals inside. */
  outside: number;
  rimAlpha: number;
  /** 0..1 bump while crossing the glass. */
  passage: number;
  /** 0→1 monotonic phase of the crossing (drives the outward ripple). */
  passagePhase: number;
  /** False once past the glass: the lens pass is not rendered at all. */
  composite: boolean;
  /** Radial spacing multiplier about the viewport centre. */
  spread: number;
  /** Organism size multiplier (art direction, not scientific magnification). */
  enlarge: number;
  /** 0..1 visibility of translucent envelope and interior detail. */
  detail: number;
}

export const ENLARGE_MAX = 1.35; // provisional, 34 asks to demonstrate 1.25–1.45×
export const SPREAD_MAX = 2.0; // provisional
export const COMPOSITE_OFF_AT = 0.86;

export function realmAt(pRaw: number, w: number, h: number, captured: Pt, r0: number): RealmState {
  const p = clamp01(pRaw);
  // Gentle glide from the captured roam pose: sine ease over the first 40%.
  const gather = easeInOutSine(clamp01(p / 0.4));
  const expand = easeInOutCubic(smooth(0.04, 0.6, p));
  const rimW = Math.min(16, Math.max(8, r0 * 0.075));
  const rEnd = Math.hypot(w / 2, h / 2) + rimW * 2 + 24;
  return {
    cx: mix(captured.x, w / 2, gather),
    cy: mix(captured.y, h / 2, gather),
    r: mix(r0, rEnd, expand),
    rimW,
    handleAlpha: 1 - smooth(0.04, 0.3, p),
    sheen: 1 - smooth(0.3, 0.62, p),
    refract: 1 - smooth(0.3, 0.62, p),
    outside: 1 - smooth(0.28, 0.6, p),
    rimAlpha: 1 - smooth(0.52, 0.74, p),
    passage: p > 0.6 && p < 0.86 ? Math.sin(Math.PI * ((p - 0.6) / 0.26)) : 0,
    passagePhase: clamp01((p - 0.6) / 0.26),
    composite: p < COMPOSITE_OFF_AT,
    spread: mix(1, SPREAD_MAX, smooth(0.28, 0.95, p)),
    enlarge: mix(1, ENLARGE_MAX, smooth(0.6, 0.9, p)),
    detail: mix(0.15, 1, smooth(0.55, 0.9, p)),
  };
}

/** Scroll distance (px) over which p runs 0→1: ~1.1 viewport. */
export const TRANSITION_VIEWPORTS = 1.1;

export function progressFromScroll(scrollY: number, viewportH: number): number {
  return clamp01(scrollY / (viewportH * TRANSITION_VIEWPORTS));
}
