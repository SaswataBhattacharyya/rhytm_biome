/**
 * Original, stylised decorative microbes for Rhythm Biome (D0).
 *
 * These are illustrations, not taxonomic identifications or clinical status.
 * Four morphologies per brief 29: hairy sphere, short-projection rod,
 * rod with two long strands, curved chain of round cells.
 *
 * Everything is deterministic from a seed: the same organism keeps its colour,
 * shape and path across theme changes, reloads and platforms.
 */

export type MicrobeKind = 'hairy' | 'shortRod' | 'flagellate' | 'chain';
export const MICROBE_KINDS: readonly MicrobeKind[] = ['hairy', 'shortRod', 'flagellate', 'chain'];

/** mulberry32 — small seeded PRNG. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Authored decorative palette (owner's explicit non-brand exception, 29).
 * Controlled saturation; never re-rolled per frame. Not a status colour.
 */
export const DECORATIVE_PALETTE: readonly string[] = [
  '#C98B6B', // terracotta
  '#8FA7C9', // dusty blue
  '#B7A0C9', // lilac
  '#9CB98A', // moss
  '#D9B26A', // ochre
  '#7FB3AE', // sea glass
  '#C9849A', // rose
  '#A7A07A', // khaki
  '#8E9BD1', // periwinkle
  '#D49A7A', // apricot
];

export interface Organism {
  id: string;
  kind: MicrobeKind;
  /** Base size in CSS px / dp at depth 1 (body radius or rod half-length). */
  size: number;
  color: string;
  /** 0 = far/background, 1 = near/foreground. Fixed per organism. */
  depth: number;
  /** Home position, normalised to the field (0..1). */
  homeU: number;
  homeV: number;
  /** Slow constant drift, px per second. */
  vx: number;
  vy: number;
  /** Correlated wander: amplitude px, frequency Hz (cycle 12–30 s), phases. */
  ax: number;
  ay: number;
  fx: number;
  fy: number;
  phase: [number, number, number, number];
  heading: number;
  rotAmp: number;
  rotFreq: number;
  /** Focus wander, slow; 0..1 multiplier for edge softness. */
  focusFreq: number;
  /** Shape seed for appendage placement. */
  shapeSeed: number;
}

export interface FieldOptions {
  seed: number;
  count: number;
  /** Field size in px; positions are normalised against it. */
  width: number;
  height: number;
  /** Global size multiplier (e.g. 0.85 on narrow screens). */
  scale?: number;
}

const BASE_SIZE: Record<MicrobeKind, [number, number]> = {
  hairy: [14, 20],
  shortRod: [19, 25],
  flagellate: [17, 22],
  chain: [6, 8],
};

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/**
 * Seeded field of many instances across four morphologies (34 REALM-01).
 * No instance is pinned to the opening lens: the roaming lens finds a busy
 * field because the density is derived from the lens area by the caller.
 * The first four indices take one of each morphology so all four are present;
 * their positions are random like every other instance.
 */
export function createField(opts: FieldOptions): Organism[] {
  const rng = createRng(opts.seed);
  const scale = opts.scale ?? 1;
  const out: Organism[] = [];
  const placed: [number, number][] = [];
  const minGap = Math.sqrt((opts.width * opts.height) / Math.max(1, opts.count)) * 0.55;

  for (let i = 0; i < opts.count; i++) {
    const kind = i < 4 ? MICROBE_KINDS[i] : MICROBE_KINDS[Math.floor(rng() * 4)];
    const [lo, hi] = BASE_SIZE[kind];
    let x = 0;
    let y = 0;
    // Rejection sampling keeps the field even without visible grid structure.
    for (let tries = 0; tries < 24; tries++) {
      x = rng() * opts.width;
      y = rng() * opts.height;
      if (placed.every(([px, py]) => Math.hypot(px - x, py - y) > minGap)) break;
    }
    placed.push([x, y]);
    const depth = rng();
    const speed = lerp(3, 7.5, rng()); // px/s — modest travel, continuous arrivals/departures
    const dir = rng() * Math.PI * 2;
    out.push({
      id: `org_${opts.seed}_${i}`,
      kind,
      size: lerp(lo, hi, rng()) * scale,
      color: DECORATIVE_PALETTE[Math.floor(rng() * DECORATIVE_PALETTE.length)],
      depth,
      homeU: x / opts.width,
      homeV: y / opts.height,
      vx: Math.cos(dir) * speed,
      vy: Math.sin(dir) * speed,
      ax: lerp(10, 26, rng()),
      ay: lerp(10, 26, rng()),
      fx: 1 / lerp(12, 30, rng()),
      fy: 1 / lerp(12, 30, rng()),
      phase: [rng() * 6.283, rng() * 6.283, rng() * 6.283, rng() * 6.283],
      heading: rng() * Math.PI * 2,
      rotAmp: lerp(0.25, 0.6, rng()),
      rotFreq: 1 / lerp(16, 30, rng()),
      focusFreq: 1 / lerp(18, 34, rng()),
      shapeSeed: Math.floor(rng() * 1e9),
    });
  }
  return out;
}

export interface Pose {
  x: number;
  y: number;
  angle: number;
  /** 0..1 slow focus wander used for edge softness (gentle rack focus). */
  focus: number;
}

/** Largest extent of any organism including strands, at scale 1, in px. */
export const MAX_EXTENT = 120;

/**
 * Smooth correlated path. Constant slow drift plus two-frequency wander;
 * wraps only outside the visible field (margin > MAX_EXTENT) so recycling
 * never pops into view.
 */
export function poseAt(o: Organism, tSec: number, width: number, height: number): Pose {
  const TAU = Math.PI * 2;
  const m = MAX_EXTENT;
  const p = o.phase;
  let x =
    o.homeU * width +
    o.vx * tSec +
    o.ax * Math.sin(TAU * o.fx * tSec + p[0]) +
    o.ax * 0.35 * Math.sin(TAU * o.fx * 2.3 * tSec + p[1]);
  let y =
    o.homeV * height +
    o.vy * tSec +
    o.ay * Math.sin(TAU * o.fy * tSec + p[2]) +
    o.ay * 0.35 * Math.sin(TAU * o.fy * 1.7 * tSec + p[3]);
  const W = width + 2 * m;
  const H = height + 2 * m;
  x = ((((x + m) % W) + W) % W) - m;
  y = ((((y + m) % H) + H) % H) - m;
  const angle = o.heading + o.rotAmp * Math.sin(TAU * o.rotFreq * tSec + p[1]);
  const focus = 0.5 + 0.5 * Math.sin(TAU * o.focusFreq * tSec + p[3]);
  return { x, y, angle, focus };
}

// ---------------------------------------------------------------------------
// Shape model shared by WebGL (web) and SVG (web poster + native).
// Coordinates are local, centred on the organism, x along the body axis.
// ---------------------------------------------------------------------------

export type Pt = [number, number];

export interface Strand {
  /** Polyline from root (on the membrane) to tip. */
  points: Pt[];
  /** Base width at the root in px; tapers to ~35% at the tip. */
  width: number;
  /** Wave amplitude multiplier applied by animated renderers. */
  wave: number;
}

export interface Shape {
  /** One or more closed polygons (chain = several cells). */
  bodies: Pt[][];
  strands: Strand[];
}

function circle(cx: number, cy: number, r: number, n: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

function capsule(halfLen: number, halfW: number, n: number): Pt[] {
  const pts: Pt[] = [];
  const straight = Math.max(0, halfLen - halfW);
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI / 2 + (i / n) * Math.PI;
    pts.push([straight + Math.cos(a) * halfW, Math.sin(a) * halfW]);
  }
  for (let i = 0; i <= n; i++) {
    const a = Math.PI / 2 + (i / n) * Math.PI;
    pts.push([-straight + Math.cos(a) * halfW, Math.sin(a) * halfW]);
  }
  return pts;
}

/** Point on capsule outline plus outward normal, parameter s in [0,1). */
function capsulePoint(halfLen: number, halfW: number, s: number): { p: Pt; n: Pt } {
  const straight = Math.max(0, halfLen - halfW);
  const capLen = Math.PI * halfW;
  const total = 2 * straight * 2 + 2 * capLen;
  let d = (((s % 1) + 1) % 1) * total;
  // top edge (left→right)
  if (d < 2 * straight) return { p: [-straight + d, -halfW], n: [0, -1] };
  d -= 2 * straight;
  if (d < capLen) {
    const a = -Math.PI / 2 + d / halfW;
    return { p: [straight + Math.cos(a) * halfW, Math.sin(a) * halfW], n: [Math.cos(a), Math.sin(a)] };
  }
  d -= capLen;
  if (d < 2 * straight) return { p: [straight - d, halfW], n: [0, 1] };
  d -= 2 * straight;
  const a = Math.PI / 2 + d / halfW;
  return { p: [-straight + Math.cos(a) * halfW, Math.sin(a) * halfW], n: [Math.cos(a), Math.sin(a)] };
}

function strandFrom(root: Pt, dir: Pt, len: number, curl: number, segs: number, width: number, wave: number): Strand {
  const pts: Pt[] = [];
  const perp: Pt = [-dir[1], dir[0]];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const bend = Math.sin(t * Math.PI * 0.9) * curl * len * t;
    pts.push([root[0] + dir[0] * len * t + perp[0] * bend, root[1] + dir[1] * len * t + perp[1] * bend]);
  }
  return { points: pts, width, wave };
}

export function shapeOf(o: Pick<Organism, 'kind' | 'size' | 'shapeSeed'>): Shape {
  const rng = createRng(o.shapeSeed);
  const s = o.size;
  switch (o.kind) {
    case 'hairy': {
      const r = s;
      const n = 26;
      const strands: Strand[] = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + (rng() - 0.5) * 0.12;
        const dir: Pt = [Math.cos(a), Math.sin(a)];
        strands.push(strandFrom([dir[0] * r * 0.96, dir[1] * r * 0.96], dir, r * (0.42 + rng() * 0.12), (rng() - 0.5) * 0.5, 4, 1.3, 0.6));
      }
      return { bodies: [circle(0, 0, r, 40)], strands };
    }
    case 'shortRod': {
      const halfLen = s;
      const halfW = s * 0.36;
      const n = 18;
      const strands: Strand[] = [];
      for (let i = 0; i < n; i++) {
        const { p, n: nn } = capsulePoint(halfLen, halfW, i / n + rng() * 0.01);
        strands.push(strandFrom([p[0] * 0.97, p[1] * 0.97], nn, halfW * (0.55 + rng() * 0.15), (rng() - 0.5) * 0.4, 3, 1.2, 0.5));
      }
      return { bodies: [capsule(halfLen, halfW, 14)], strands };
    }
    case 'flagellate': {
      const halfLen = s;
      const halfW = s * 0.38;
      const strands: Strand[] = [];
      for (const side of [-1, 1]) {
        const root: Pt = [-halfLen * 0.92, side * halfW * 0.35];
        const len = s * (2.6 + rng() * 0.4);
        const pts: Pt[] = [];
        const segs = 18;
        for (let i = 0; i <= segs; i++) {
          const t = i / segs;
          pts.push([root[0] - len * t, root[1] + side * len * 0.12 * t + Math.sin(t * Math.PI * 2.2) * s * 0.28 * t]);
        }
        strands.push({ points: pts, width: 1.7, wave: 1.6 });
      }
      return { bodies: [capsule(halfLen, halfW, 14)], strands };
    }
    case 'chain': {
      const cellR = s;
      const count = 5;
      const bodies: Pt[][] = [];
      const arc = 0.9 + rng() * 0.4; // radians of curvature across the chain
      const radius = (cellR * 1.85 * (count - 1)) / arc;
      for (let i = 0; i < count; i++) {
        const a = -arc / 2 + (i / (count - 1)) * arc;
        const cx = Math.sin(a) * radius;
        const cy = radius - Math.cos(a) * radius - radius * (1 - Math.cos(arc / 2)) * 0.5;
        bodies.push(circle(cx, cy, cellR * (0.94 + rng() * 0.12), 24));
      }
      return { bodies, strands: [] };
    }
  }
}

/** SVG path data for a shape, for DOM SVG and react-native-svg. */
export function shapeToSvg(shape: Shape): { bodies: string[]; strands: Array<{ d: string; width: number }> } {
  const f = (n: number) => n.toFixed(2);
  return {
    bodies: shape.bodies.map((poly) => 'M' + poly.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L') + ' Z'),
    strands: shape.strands.map((st) => ({
      d: 'M' + st.points.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L'),
      width: st.width,
    })),
  };
}

/** Darker membrane rim for light theme; lighter for dark theme. */
export function rimColor(hex: string, theme: 'light' | 'dark'): string {
  const [r, g, b] = hexToRgb(hex);
  const mix = theme === 'light' ? [30, 36, 43] : [248, 249, 248];
  const k = theme === 'light' ? 0.42 : 0.5;
  return rgbToHex(r + (mix[0] - r) * k, g + (mix[1] - g) * k, b + (mix[2] - b) * k);
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Illustration ref used by knowledge cards for each morphology. */
export const ILLUSTRATION_REF_BY_KIND: Record<MicrobeKind, string> = {
  hairy: 'hairy_sphere',
  shortRod: 'short_rod',
  flagellate: 'twin_strand_rod',
  chain: 'cell_chain',
};

/** Reverse lookup: illustration ref → morphology (null for non-microbe refs). */
export function kindForIllustrationRef(ref: string): MicrobeKind | null {
  const hit = (Object.keys(ILLUSTRATION_REF_BY_KIND) as MicrobeKind[]).find((k) => ILLUSTRATION_REF_BY_KIND[k] === ref);
  return hit ?? null;
}
