/**
 * Microbial realm renderer — plain WebGL2, no runtime dependencies.
 *
 * Stages (planning 34): A roaming lens → B gather to centre + expand focus +
 * spread → C pass through the glass (modest enlargement, translucent
 * interiors) → no lens composite at all.
 *
 * Relay 03: organisms are driven by a bounded steering model (motion.ts),
 * appendages beat on independent phases, hover plays the midpoint-anchored
 * escape wriggle, one rare pair encounter can run at a time, and organisms
 * can be handed to the foreground crossing layer and back without losing
 * identity.
 *
 * Projection is a fixed orthographic mapping of CSS px. Organism size changes
 * only through the explicit `enlarge` term of the realm state.
 *
 * Loaded only by the homepage via dynamic import.
 */
import {
  createField,
  createRng,
  hexToRgb,
  rimColor,
  shapeOf,
  themes,
  type MicrobeKind,
  type Organism,
  type ThemeName,
} from '@rb-lab/shared';
import { buildRoamPath, realmAt, roamPoseAt, type Anchor, type Pt, type RealmState, type RoamPath } from './layout';
import {
  createMovers,
  EncounterDirector,
  scaleDeform,
  stepMover,
  triggerRecoil,
  wriggleAt,
  ZERO_DEFORM,
  type DeformParams,
  type EncounterLogEntry,
  type Mover,
} from './motion';
import { BACKGROUND_FS, BLUR_FS, COMPOSITE_FS, FULLSCREEN_VS, ORGANISM_FS, ORGANISM_VS } from './shaders';

export type FallbackReason = 'unsupported' | 'context-lost' | 'shader-error';

/** Per-frame screen data for hit targets, crossings and debugging (reused, do not retain). */
export interface OrganismScreen {
  index: number;
  kind: MicrobeKind;
  x: number;
  y: number;
  /** Screen radius of the body (CSS px). */
  r: number;
  depth: number;
  /** True when the body centre is inside the sharp lens aperture (or past the glass). */
  inFocus: boolean;
  /** Handed to the foreground crossing layer (not drawn by WebGL). */
  hidden: boolean;
  /** Travel heading (rad) and speed (px/s). */
  heading: number;
  speed: number;
  /** Rendered body angle (rad). */
  angle: number;
  /** Busy with an encounter or crossing — not available for new events. */
  busy: boolean;
}

export interface FrameInfo {
  progress: number;
  realm: RealmState;
  roamPose: Pt;
  organisms: OrganismScreen[];
  width: number;
  height: number;
  /** Engine clock (s); pauses with the world. */
  time: number;
  dt: number;
}

export interface OrganismVisual {
  kind: MicrobeKind;
  size: number;
  color: string;
  shapeSeed: number;
  /** Screen scale (depth × enlarge) relative to `size`. */
  scale: number;
  angle: number;
  depth: number;
}

export interface EngineOptions {
  seed?: number;
  theme: ThemeName;
  paused?: boolean;
  onFallback?: (reason: FallbackReason) => void;
  getAnchor: () => Anchor;
  getRoamPoints?: () => Pt[];
  onFrame?: (info: FrameInfo) => void;
  /** Start the pair encounter as soon as a suitable pair exists (review). */
  encounterSoon?: boolean;
}

interface OrgGpu {
  o: Organism;
  vao: WebGLVertexArrayObject;
  buf: WebGLBuffer;
  bodyCount: number;
  strandCount: number;
  depthScale: number;
  extent: number;
  /** Body half-length along local x (deformation axis). */
  half: number;
}

interface Target {
  fb: WebGLFramebuffer;
  tex: WebGLTexture;
  w: number;
  h: number;
}

const MAX_DPR = 1.5;
const STRIDE = 10; // aPos2 aNormal2 aT aEdge aSide aCentroid2 aStrandPhase
const SIM_STEP = 1 / 30;

const IN_LENS_TARGET_WIDE = 10;
const IN_LENS_TARGET_NARROW = 6.5;
/** Fade for organisms that wake or sleep on resize (s). */
const FADE_S = 0.6;
/** Upper bound on GPU organisms kept across many resizes. */
const MAX_CAPACITY = 120;
/** Ignore count changes smaller than this share of the field (URL-bar jitter). */
const COUNT_HYSTERESIS = 0.06;

const LINK_SEGMENTS = 18;
const LENS_RECOIL_COOLDOWN = 12;

const SCENE_COLORS: Record<ThemeName, {
  bgA: string; bgB: string; tint: string; metal: string; metalHi: string; shadow: string; link: string;
}> = {
  light: { bgA: themes.light.scene, bgB: themes.light.sceneDeep, tint: '#EADBD0', metal: '#7C4E28', metalHi: '#D9A46E', shadow: '#5A4636', link: '#94592A' },
  dark: { bgA: themes.dark.scene, bgB: themes.dark.sceneDeep, tint: '#1A2E33', metal: '#3E5A5B', metalHi: '#B9CFC7', shadow: '#05090B', link: '#F2C46B' },
};

const rgb01 = (hex: string): [number, number, number] => {
  const [r, g, b] = hexToRgb(hex);
  return [r / 255, g / 255, b / 255];
};

export class MicroscopeEngine {
  private gl: WebGL2RenderingContext;
  private canvas: HTMLCanvasElement;
  private opts: EngineOptions;
  private theme: ThemeName;
  private paused: boolean;
  private active = true;
  private progress = 0;
  private time = 0;
  private roamClock = 0;
  private lastFrame = 0;
  private lastDt = 0;
  private raf = 0;
  private pendingDraw = 0;
  private disposed = false;
  private failed = false;
  private dpr = 1;
  private cssW = 0;
  private cssH = 0;
  private seed = 20261118;
  private anchor: Anchor = { x: 0, y: 0, r: 100 };
  private roam: RoamPath | null = null;
  private orgs: OrgGpu[] = [];
  private movers: Mover[] = [];
  private director!: EncounterDirector;
  private recoilRng = createRng(7);
  private recoilCooldown = 0;
  private eventLog: EncounterLogEntry[] = [];
  /** Hover wriggle state. */
  private hovered = -1;
  private wriggleTau = new Float32Array(0);
  private wriggleEnv = new Float32Array(0);
  private asym = new Float32Array(0);
  private lag = new Float32Array(0);
  private hidden = new Uint8Array(0);
  /**
   * FIELD-RESIZE-01: organisms are never re-indexed (hit identities stay
   * stable). A resize rescales positions and changes the active count by
   * putting organisms to sleep (fade out) or waking/adding them (fade in).
   */
  private dormant = new Uint8Array(0);
  private fade = new Float32Array(0);
  private drawOrder: number[] = [];
  private fieldW = 0;
  private fieldH = 0;
  private activeCount = 0;
  private generation = 0;
  private resizeLog: { t: number; from: [number, number]; to: [number, number]; active: [number, number]; added: number; woke: number; slept: number }[] = [];
  private crossing = new Uint8Array(0);
  /** Review: render a fixed wriggle frame (index, tau). */
  private preview: { index: number; tau: number } | null = null;
  private screen: OrganismScreen[] = [];
  private lastRealm: RealmState | null = null;
  private lastRoamPose: Pt = { x: 0, y: 0 };
  private emptyVao: WebGLVertexArrayObject;
  private progBg!: WebGLProgram;
  private progOrg!: WebGLProgram;
  private progBlur!: WebGLProgram;
  private progComp!: WebGLProgram;
  private glow!: { vao: WebGLVertexArrayObject; buf: WebGLBuffer; count: number };
  private link!: { vao: WebGLVertexArrayObject; buf: WebGLBuffer; data: Float32Array; count: number };
  private sharp: Target | null = null;
  private q1: Target | null = null;
  private q2: Target | null = null;
  private uniformCache = new Map<WebGLProgram, Map<string, WebGLUniformLocation | null>>();
  private onLost = (e: Event) => {
    e.preventDefault();
    this.fail('context-lost');
  };

  static isSupported(): boolean {
    try {
      const c = document.createElement('canvas');
      return !!c.getContext('webgl2');
    } catch {
      return false;
    }
  }

  constructor(canvas: HTMLCanvasElement, opts: EngineOptions) {
    this.canvas = canvas;
    this.opts = opts;
    this.theme = opts.theme;
    this.paused = !!opts.paused;
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false, powerPreference: 'low-power' });
    if (!gl) throw new Error('webgl2-unavailable');
    this.gl = gl;
    canvas.addEventListener('webglcontextlost', this.onLost);
    this.emptyVao = gl.createVertexArray()!;
    try {
      this.progBg = this.program(FULLSCREEN_VS, BACKGROUND_FS);
      this.progOrg = this.program(ORGANISM_VS, ORGANISM_FS);
      this.progBlur = this.program(FULLSCREEN_VS, BLUR_FS);
      this.progComp = this.program(FULLSCREEN_VS, COMPOSITE_FS);
    } catch (err) {
      console.warn('[microscope] shader setup failed', err);
      this.fail('shader-error');
      return;
    }
    this.glow = this.buildGlow();
    this.link = this.buildLink();
    this.seed = opts.seed ?? 20261118;
    this.resize();
    this.buildField(this.seed);
    this.start();
  }

  // ------------------------------------------------------------- public API

  setProgress(p: number) {
    if (p === this.progress) return;
    this.progress = p;
    this.requestDraw();
  }

  setTheme(theme: ThemeName) {
    if (theme === this.theme) return;
    this.theme = theme; // identities, paths and clocks are preserved
    this.requestDraw();
  }

  setPaused(paused: boolean) {
    this.paused = paused;
    if (paused) this.stopLoop();
    this.start();
  }

  setActive(active: boolean) {
    this.active = active;
    if (!active) this.stopLoop();
    this.start();
  }

  /**
   * Deterministic clocks for review captures (?t=). The motion model is
   * stateful, so the field is re-seeded and simulated forward at a fixed step.
   */
  setTime(seconds: number) {
    this.resetMotion();
    const steps = Math.max(0, Math.round(seconds / SIM_STEP));
    for (let i = 0; i < steps; i++) this.advance(SIM_STEP, true);
    this.roamClock = seconds;
    this.requestDraw();
  }

  /** Hover latch: hold that organism and play the escape wriggle from its start. */
  setHovered(index: number | null) {
    const next = index ?? -1;
    if (next === this.hovered) return;
    if (this.hovered >= 0 && this.movers[this.hovered]) this.movers[this.hovered].frozen = this.crossing[this.hovered] === 1 || this.dormant[this.hovered] === 1;
    this.hovered = next;
    if (next >= 0 && this.movers[next]) {
      this.movers[next].frozen = true; // selection identity stays put
      this.wriggleTau[next] = 0;
    }
    this.start();
  }

  /** Review: hold organism `index` at a fixed wriggle time and draw. */
  previewWriggle(index: number | null, tau = 0) {
    this.preview = index === null ? null : { index, tau };
    this.requestDraw();
  }

  /** Crossing layer takes over drawing this organism (it keeps its identity). */
  beginCrossing(index: number): OrganismVisual | null {
    const m = this.movers[index];
    const g = this.orgs[index];
    if (!m || !g || m.frozen || this.crossing[index] || this.dormant[index]) return null;
    this.crossing[index] = 1;
    this.hidden[index] = 1;
    m.frozen = true;
    return this.organismVisual(index);
  }

  /** Hand the organism back at screen position (sx, sy) travelling along `heading`, drawn at `angle`. */
  endCrossing(index: number, sx: number, sy: number, heading: number, angle?: number) {
    const m = this.movers[index];
    if (!m || !this.crossing[index]) return;
    const realm = this.lastRealm ?? realmAt(this.progress, this.cssW, this.cssH, this.anchor, this.anchor.r);
    const cx = this.cssW / 2;
    const cy = this.cssH / 2;
    m.x = cx + (sx - cx) / realm.spread;
    m.y = cy + (sy - cy) / realm.spread;
    m.heading = heading;
    m.angle = angle ?? (m.swimmer ? heading : m.angle);
    this.crossing[index] = 0;
    this.hidden[index] = 0;
    m.frozen = this.hovered === index || this.dormant[index] === 1;
    this.requestDraw();
  }

  organismVisual(index: number): OrganismVisual | null {
    const m = this.movers[index];
    const g = this.orgs[index];
    if (!m || !g) return null;
    const realm = this.lastRealm ?? realmAt(this.progress, this.cssW, this.cssH, this.anchor, this.anchor.r);
    return {
      kind: g.o.kind,
      size: g.o.size,
      color: g.o.color,
      shapeSeed: g.o.shapeSeed,
      scale: g.depthScale * realm.enlarge,
      angle: m.angle,
      depth: g.o.depth,
    };
  }

  /** Review: start the pair encounter as soon as a suitable pair is visible. */
  triggerEncounter() {
    this.director.forceSoon(this.time);
    this.start();
  }

  events(): EncounterLogEntry[] {
    return [...this.eventLog, ...this.director.log].sort((a, b) => a.t - b.t);
  }

  trackedDiameter(index = 0): number {
    const g = this.orgs[index];
    const realm = this.lastRealm ?? realmAt(this.progress, this.cssW, this.cssH, this.anchor, this.anchor.r);
    return g ? g.extent * 2 * g.depthScale * realm.enlarge : 0;
  }

  snapshot() {
    const realm = this.lastRealm;
    const vis = (s: OrganismScreen) => !s.hidden && s.x > -s.r && s.y > -s.r && s.x < this.cssW + s.r && s.y < this.cssH + s.r;
    const modes: Record<string, number> = {};
    for (const m of this.movers) modes[m.mode] = (modes[m.mode] ?? 0) + 1;
    const e = this.director.current;
    return {
      progress: this.progress,
      time: this.time,
      total: this.activeCount,
      capacity: this.orgs.length,
      field: { w: this.fieldW, h: this.fieldH },
      halves: this.halfCounts(),
      visible: this.screen.filter(vis).length,
      inLens: this.screen.filter((s) => s.inFocus && vis(s)).length,
      composite: realm?.composite ?? true,
      realm,
      roamPose: { ...this.lastRoamPose },
      roamClock: this.roamClock,
      hovered: this.hovered,
      wriggleTau: this.hovered >= 0 ? this.wriggleTau[this.hovered] : 0,
      wriggleEnv: this.hovered >= 0 ? this.wriggleEnv[this.hovered] : 0,
      modes,
      encounter: e ? { phase: e.phase, a: e.a, b: e.b, link: e.link } : null,
      crossing: Array.from(this.crossing).reduce((n, v) => n + v, 0),
    };
  }

  resize() {
    if (this.failed) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    this.cssW = Math.max(1, this.canvas.clientWidth || window.innerWidth);
    this.cssH = Math.max(1, this.canvas.clientHeight || window.innerHeight);
    const w = Math.round(this.cssW * this.dpr);
    const h = Math.round(this.cssH * this.dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.anchor = this.opts.getAnchor();
    if (this.orgs.length && (this.cssW !== this.fieldW || this.cssH !== this.fieldH)) this.refit();
    const pts = this.opts.getRoamPoints?.();
    this.roam = pts && pts.length > 1 ? buildRoamPath(pts) : null;
    this.sharp = this.target(this.sharp, w, h);
    const qw = Math.max(1, Math.floor(w / 4));
    const qh = Math.max(1, Math.floor(h / 4));
    this.q1 = this.target(this.q1, qw, qh);
    this.q2 = this.target(this.q2, qw, qh);
    this.requestDraw();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.stopLoop();
    if (this.pendingDraw) cancelAnimationFrame(this.pendingDraw);
    this.canvas.removeEventListener('webglcontextlost', this.onLost);
    const gl = this.gl;
    for (const g of this.orgs) {
      gl.deleteVertexArray(g.vao);
      gl.deleteBuffer(g.buf);
    }
    this.orgs = [];
    for (const v of [this.glow, this.link]) {
      if (v) {
        gl.deleteVertexArray(v.vao);
        gl.deleteBuffer(v.buf);
      }
    }
    for (const t of [this.sharp, this.q1, this.q2]) {
      if (t) {
        gl.deleteFramebuffer(t.fb);
        gl.deleteTexture(t.tex);
      }
    }
    for (const p of [this.progBg, this.progOrg, this.progBlur, this.progComp]) if (p) gl.deleteProgram(p);
    gl.deleteVertexArray(this.emptyVao);
    this.uniformCache.clear();
  }

  // ------------------------------------------------------------- loop

  private running() {
    return !this.disposed && !this.failed && !this.paused && this.active;
  }

  private start() {
    if (this.disposed || this.failed) return;
    if (!this.running()) {
      this.requestDraw();
      return;
    }
    if (this.raf) return;
    this.lastFrame = performance.now();
    const tick = (now: number) => {
      this.raf = 0;
      if (!this.running()) return;
      const dt = Math.min(0.1, (now - this.lastFrame) / 1000);
      this.lastFrame = now;
      this.advance(dt, false);
      this.draw();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private resetMotion() {
    this.time = 0;
    this.roamClock = 0;
    this.recoilCooldown = 0;
    this.recoilRng = createRng((this.seed ^ 0x5eed) >>> 0);
    this.eventLog = [];
    this.movers = createMovers(
      this.orgs.map((g) => g.o),
      this.seed,
      { w: this.cssW, h: this.cssH },
    );
    for (let i = 0; i < this.movers.length; i++) {
      if (this.hovered === i || this.crossing[i] || this.dormant[i]) this.movers[i].frozen = true;
    }
    this.director = new EncounterDirector(this.seed ^ 0xe1c0, this.opts.encounterSoon ? 2 : 22);
  }

  /** Advance every clock and the motion model by dt (s). */
  private advance(dt: number, simulated: boolean) {
    this.lastDt = dt;
    this.time += dt;
    if (this.progress <= 0.0005) this.roamClock += dt;
    // Hover wriggle envelopes (timeline keeps running while the envelope eases out).
    for (let i = 0; i < this.wriggleTau.length; i++) {
      if (i === this.hovered) {
        this.wriggleTau[i] += dt;
        this.wriggleEnv[i] = Math.min(1, this.wriggleEnv[i] + dt * 8);
      } else if (this.wriggleEnv[i] > 0) {
        this.wriggleTau[i] += dt;
        this.wriggleEnv[i] = Math.max(0, this.wriggleEnv[i] - dt / 0.35);
      }
    }
    const bounds = { w: this.cssW, h: this.cssH };
    let pushes = 0;
    for (let i = 0; i < this.movers.length; i++) if (!this.dormant[i] && this.movers[i].mode === 'push') pushes++;
    const ctx = { t: this.time, dt, bounds, activePushes: pushes };
    for (let i = 0; i < this.movers.length; i++) {
      if (!this.dormant[i]) stepMover(this.movers[i], ctx);
      const want = this.dormant[i] ? 0 : 1;
      if (this.fade[i] !== want) this.fade[i] = want ? Math.min(1, this.fade[i] + dt / FADE_S) : Math.max(0, this.fade[i] - dt / FADE_S);
    }
    // LIFE-02: one rare encounter at a time, only while the field is on screen.
    if (this.progress < 0.95) {
      this.director.tryStart(this.movers, this.time, bounds);
      this.director.step(this.movers, this.time, dt);
    }
    // Lens-cued recoil while the lens roams (stage A only), rare.
    this.recoilCooldown = Math.max(0, this.recoilCooldown - dt);
    if (!simulated && this.progress <= 0.02 && this.recoilCooldown === 0 && this.lastRealm) {
      const r = this.lastRealm;
      for (const m of this.movers) {
        if (m.frozen || m.o.depth < 0.55) continue;
        const d = Math.hypot(m.x - r.cx, m.y - r.cy);
        if (Math.abs(d - r.r) < 4 && this.recoilRng() < 0.2 && triggerRecoil(m, r.cx, r.cy)) {
          this.recoilCooldown = LENS_RECOIL_COOLDOWN;
          this.eventLog.push({ t: this.time, kind: 'recoil', a: m.o.id, morphologies: m.o.kind });
          break;
        }
      }
    }
  }

  private requestDraw() {
    if (this.disposed || this.failed || this.raf || this.pendingDraw) return;
    this.pendingDraw = requestAnimationFrame(() => {
      this.pendingDraw = 0;
      this.draw();
    });
  }

  private stopLoop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private fail(reason: FallbackReason) {
    if (this.failed) return;
    this.failed = true;
    this.stopLoop();
    this.opts.onFallback?.(reason);
  }

  // ------------------------------------------------------------- scene setup

  /** Field size for the current viewport (same rule as a fresh load). */
  private countFor(): number {
    const narrow = this.cssW < 700;
    const lensArea = Math.PI * this.anchor.r * this.anchor.r;
    const target = narrow ? IN_LENS_TARGET_NARROW : IN_LENS_TARGET_WIDE;
    return Math.max(24, Math.min(80, Math.round((target * this.cssW * this.cssH) / Math.max(1, lensArea))));
  }

  private buildField(seed: number) {
    const narrow = this.cssW < 700;
    const count = this.countFor();
    const field = createField({ seed, count, width: this.cssW, height: this.cssH, scale: narrow ? 0.85 : 1 });
    field.sort((a, b) => a.depth - b.depth); // far first
    this.orgs = field.map((o) => this.uploadOrganism(o));
    const n = this.orgs.length;
    this.wriggleTau = new Float32Array(n);
    this.wriggleEnv = new Float32Array(n);
    this.hidden = new Uint8Array(n);
    this.crossing = new Uint8Array(n);
    this.dormant = new Uint8Array(n);
    this.fade = new Float32Array(n).fill(1);
    this.activeCount = n;
    this.fieldW = this.cssW;
    this.fieldH = this.cssH;
    this.drawOrder = this.orgs.map((_, i) => i); // already depth-sorted
    this.asym = new Float32Array(n);
    this.lag = new Float32Array(n);
    const rng = createRng((seed ^ 0xa5a5) >>> 0);
    for (let i = 0; i < n; i++) {
      this.asym[i] = 0.7 + rng() * 0.3;
      this.lag[i] = 0.03 + rng() * 0.06;
    }
    this.resetMotion();
    this.screen = this.orgs.map((g, i) => this.blankScreen(i, g.o));
  }

  /**
   * FIELD-RESIZE-01. Rescale every position into the new viewport, then match
   * the fresh-load density: sleep the most crowded organisms when shrinking,
   * wake sleeping ones in the sparsest places, and add new organisms there
   * only when the pool is exhausted. Indices (hit identities) never change.
   */
  private refit() {
    const fromW = this.fieldW;
    const fromH = this.fieldH;
    const sx = this.cssW / Math.max(1, fromW);
    const sy = this.cssH / Math.max(1, fromH);
    for (const m of this.movers) {
      m.x *= sx;
      m.y *= sy;
      if (m.steerTo) m.steerTo = { x: m.steerTo.x * sx, y: m.steerTo.y * sy };
    }
    this.fieldW = this.cssW;
    this.fieldH = this.cssH;
    const before = this.activeCount;
    const want = this.countFor();
    let added = 0;
    let woke = 0;
    let slept = 0;
    const band = Math.max(2, Math.round(before * COUNT_HYSTERESIS));
    if (Math.abs(want - before) >= band) {
      if (want < before) slept = this.sleep(before - want);
      else {
        woke = this.wake(want - before);
        if (before + woke < want) added = this.addOrganisms(want - before - woke);
      }
    }
    // A paused or static scene has no frames to animate the fade.
    if (!this.running()) for (let i = 0; i < this.fade.length; i++) this.fade[i] = this.dormant[i] ? 0 : 1;
    this.resizeLog.push({ t: this.time, from: [fromW, fromH], to: [this.cssW, this.cssH], active: [before, this.activeCount], added, woke, slept });
    if (this.resizeLog.length > 20) this.resizeLog.shift();
  }

  /** Organisms that an interaction currently owns are never put to sleep. */
  private busyIndex(i: number) {
    const e = this.director.current;
    return this.hovered === i || this.crossing[i] === 1 || (!!e && (e.a === i || e.b === i));
  }

  private nearestActive(x: number, y: number, skip: number) {
    let best = Infinity;
    for (let j = 0; j < this.movers.length; j++) {
      if (j === skip || this.dormant[j]) continue;
      const m = this.movers[j];
      best = Math.min(best, Math.hypot(m.x - x, m.y - y));
    }
    return best;
  }

  private sleep(k: number): number {
    let done = 0;
    for (; done < k; done++) {
      let pick = -1;
      let crowd = Infinity;
      for (let i = 0; i < this.movers.length; i++) {
        if (this.dormant[i] || this.busyIndex(i)) continue;
        const m = this.movers[i];
        // Off-screen organisms (wrap margin) go first, then the most crowded.
        const off = m.x < 0 || m.y < 0 || m.x > this.cssW || m.y > this.cssH ? -1e6 : 0;
        const d = this.nearestActive(m.x, m.y, i) + off;
        if (d < crowd) {
          crowd = d;
          pick = i;
        }
      }
      if (pick < 0) break;
      this.dormant[pick] = 1;
      this.movers[pick].frozen = true;
      this.activeCount--;
    }
    return done;
  }

  private wake(k: number): number {
    let done = 0;
    for (; done < k; done++) {
      let pick = -1;
      let space = -1;
      for (let i = 0; i < this.movers.length; i++) {
        if (!this.dormant[i]) continue;
        const m = this.movers[i];
        const inView = m.x >= 0 && m.y >= 0 && m.x <= this.cssW && m.y <= this.cssH;
        const d = inView ? this.nearestActive(m.x, m.y, i) : -1;
        if (d > space) {
          space = d;
          pick = i;
        }
      }
      if (pick < 0) break;
      const m = this.movers[pick];
      if (m.x < 0 || m.y < 0 || m.x > this.cssW || m.y > this.cssH) {
        const p = this.sparsestPoint(createRng((this.seed ^ (pick * 131 + this.generation * 17 + this.activeCount)) >>> 0));
        m.x = p.x;
        m.y = p.y;
      }
      this.dormant[pick] = 0;
      m.frozen = this.hovered === pick || this.crossing[pick] === 1;
      m.mode = 'drift';
      m.modeT = 0;
      this.activeCount++;
    }
    return done;
  }

  /** Best-candidate sampling: the point farthest from every active organism. */
  private sparsestPoint(rng: () => number) {
    let best = { x: rng() * this.cssW, y: rng() * this.cssH };
    let bestD = -1;
    for (let c = 0; c < 24; c++) {
      const x = rng() * this.cssW;
      const y = rng() * this.cssH;
      const d = this.nearestActive(x, y, -1);
      if (d > bestD) {
        bestD = d;
        best = { x, y };
      }
    }
    return best;
  }

  private addOrganisms(k: number): number {
    const room = Math.max(0, MAX_CAPACITY - this.orgs.length);
    k = Math.min(k, room);
    if (k <= 0) return 0;
    this.generation++;
    const seed = (this.seed + this.generation * 7777) >>> 0;
    const narrow = this.cssW < 700;
    const extra = createField({ seed, count: k, width: this.cssW, height: this.cssH, scale: narrow ? 0.85 : 1 });
    const rng = createRng((seed ^ 0x51ce) >>> 0);
    const start = this.orgs.length;
    const n = start + extra.length;
    const growF = (a: Float32Array, fill = 0) => {
      const b = new Float32Array(n).fill(fill);
      b.set(a);
      return b;
    };
    const growU = (a: Uint8Array) => {
      const b = new Uint8Array(n);
      b.set(a);
      return b;
    };
    this.wriggleTau = growF(this.wriggleTau);
    this.wriggleEnv = growF(this.wriggleEnv);
    this.hidden = growU(this.hidden);
    this.crossing = growU(this.crossing);
    this.dormant = growU(this.dormant);
    this.fade = growF(this.fade, 0); // fade in
    this.asym = growF(this.asym);
    this.lag = growF(this.lag);
    for (const o of extra) {
      const p = this.sparsestPoint(rng);
      o.homeU = p.x / this.cssW;
      o.homeV = p.y / this.cssH;
      const i = this.orgs.length;
      this.orgs.push(this.uploadOrganism(o));
      const [m] = createMovers([o], seed, { w: this.cssW, h: this.cssH });
      m.x = p.x;
      m.y = p.y;
      this.movers.push(m);
      this.asym[i] = 0.7 + rng() * 0.3;
      this.lag[i] = 0.03 + rng() * 0.06;
      this.screen.push(this.blankScreen(i, o));
      this.activeCount++;
    }
    this.drawOrder = this.orgs.map((_, i) => i).sort((a, b) => this.orgs[a].o.depth - this.orgs[b].o.depth);
    return extra.length;
  }

  private blankScreen(i: number, o: Organism): OrganismScreen {
    return { index: i, kind: o.kind, x: 0, y: 0, r: 0, depth: o.depth, inFocus: false, hidden: false, heading: 0, speed: 0, angle: 0, busy: false };
  }

  /** Review: active organisms on screen in the left and right halves. */
  private halfCounts() {
    let left = 0;
    let right = 0;
    for (let i = 0; i < this.movers.length; i++) {
      if (this.dormant[i]) continue;
      const m = this.movers[i];
      if (m.y < 0 || m.y > this.cssH || m.x < 0 || m.x > this.cssW) continue;
      if (m.x < this.cssW / 2) left++;
      else right++;
    }
    return { left, right };
  }

  resizeEvents() {
    return this.resizeLog.map((r) => ({ ...r }));
  }

  /**
   * Bodies are tessellated finely along their outline and triangulated with
   * an inner ring, so the midpoint bend curves the silhouette rather than
   * hinging long straight edges.
   */
  private uploadOrganism(o: Organism): OrgGpu {
    const gl = this.gl;
    const shape = shapeOf(o);
    const depthScale = 0.8 + 0.35 * o.depth;
    const data: number[] = [];
    const push = (x: number, y: number, nx: number, ny: number, t: number, edge: number, side: number, cx: number, cy: number, ph: number) =>
      data.push(x, y, nx, ny, t, edge, side, cx, cy, ph);

    let bodyExtent = 0;
    let half = 0;
    for (const raw of shape.bodies) {
      const poly = resample(raw, Math.max(1.5, o.size * 0.12));
      let cx = 0;
      let cy = 0;
      for (const [x, y] of poly) {
        cx += x;
        cy += y;
        bodyExtent = Math.max(bodyExtent, Math.hypot(x, y));
        half = Math.max(half, Math.abs(x));
      }
      cx /= poly.length;
      cy /= poly.length;
      const inner = poly.map(([x, y]) => [cx + (x - cx) * 0.5, cy + (y - cy) * 0.5] as [number, number]);
      for (let i = 0; i < poly.length; i++) {
        const j = (i + 1) % poly.length;
        const a = poly[i];
        const b = poly[j];
        const ai = inner[i];
        const bi = inner[j];
        push(cx, cy, 0, 0, -1, 0, 0, cx, cy, 0);
        push(ai[0], ai[1], 0, 0, -1, 0.5, 0, cx, cy, 0);
        push(bi[0], bi[1], 0, 0, -1, 0.5, 0, cx, cy, 0);
        push(ai[0], ai[1], 0, 0, -1, 0.5, 0, cx, cy, 0);
        push(a[0], a[1], 0, 0, -1, 1, 0, cx, cy, 0);
        push(b[0], b[1], 0, 0, -1, 1, 0, cx, cy, 0);
        push(ai[0], ai[1], 0, 0, -1, 0.5, 0, cx, cy, 0);
        push(b[0], b[1], 0, 0, -1, 1, 0, cx, cy, 0);
        push(bi[0], bi[1], 0, 0, -1, 0.5, 0, cx, cy, 0);
      }
    }
    const bodyCount = data.length / STRIDE;

    const phRng = createRng((o.shapeSeed ^ 0x51) >>> 0);
    for (const st of shape.strands) {
      const strandPhase = phRng() * Math.PI * 2; // independent appendage timing
      const pts = st.points;
      const n = pts.length;
      const minW = 1.5 / depthScale;
      const ring: number[][] = [];
      for (let i = 0; i < n; i++) {
        const prev = pts[Math.max(0, i - 1)];
        const next = pts[Math.min(n - 1, i + 1)];
        let tx = next[0] - prev[0];
        let ty = next[1] - prev[1];
        const len = Math.hypot(tx, ty) || 1;
        tx /= len;
        ty /= len;
        const nx = -ty;
        const ny = tx;
        const t = i / (n - 1);
        const hw = Math.max(minW, st.width * (1 - 0.65 * t)) / 2 + 0.35;
        const wave = st.wave * 1.3;
        ring.push([pts[i][0] + nx * hw, pts[i][1] + ny * hw, nx * wave, ny * wave, t, -1]);
        ring.push([pts[i][0] - nx * hw, pts[i][1] - ny * hw, nx * wave, ny * wave, t, 1]);
      }
      for (let i = 0; i < n - 1; i++) {
        const a = ring[i * 2];
        const b = ring[i * 2 + 1];
        const c = ring[i * 2 + 2];
        const d = ring[i * 2 + 3];
        for (const v of [a, b, c, b, d, c]) push(v[0], v[1], v[2], v[3], v[4], 0, v[5], 0, 0, strandPhase);
      }
    }
    const strandCount = data.length / STRIDE - bodyCount;

    const vao = gl.createVertexArray()!;
    const buf = gl.createBuffer()!;
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    this.bindOrgAttribs(this.progOrg);
    gl.bindVertexArray(null);
    return { o, vao, buf, bodyCount, strandCount, depthScale, extent: bodyExtent, half: Math.max(1, half) };
  }

  private bindOrgAttribs(prog: WebGLProgram) {
    const gl = this.gl;
    const stride = STRIDE * 4;
    const attr = (name: string, size: number, offset: number) => {
      const loc = gl.getAttribLocation(prog, name);
      if (loc < 0) return;
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset * 4);
    };
    attr('aPos', 2, 0);
    attr('aNormal', 2, 2);
    attr('aT', 1, 4);
    attr('aEdge', 1, 5);
    attr('aSide', 1, 6);
    attr('aCentroid', 2, 7);
    attr('aStrandPhase', 1, 9);
  }

  private buildGlow() {
    const gl = this.gl;
    const data: number[] = [];
    const n = 32;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2;
      const a1 = ((i + 1) / n) * Math.PI * 2;
      data.push(0, 0, 0, 0, -1, 0, 0, 0, 0, 0);
      data.push(Math.cos(a0), Math.sin(a0), 0, 0, -1, 1, 0, 0, 0, 0);
      data.push(Math.cos(a1), Math.sin(a1), 0, 0, -1, 1, 0, 0, 0, 0);
    }
    const vao = gl.createVertexArray()!;
    const buf = gl.createBuffer()!;
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    this.bindOrgAttribs(this.progOrg);
    gl.bindVertexArray(null);
    return { vao, buf, count: data.length / STRIDE };
  }

  /** Dynamic ribbon for the encounter link (rewritten per frame while active). */
  private buildLink() {
    const gl = this.gl;
    const count = LINK_SEGMENTS * 6;
    const data = new Float32Array(count * STRIDE);
    const vao = gl.createVertexArray()!;
    const buf = gl.createBuffer()!;
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW);
    this.bindOrgAttribs(this.progOrg);
    gl.bindVertexArray(null);
    return { vao, buf, data, count };
  }

  // ------------------------------------------------------------- drawing

  private deformFor(i: number, g: OrgGpu, m: Mover): DeformParams {
    if (this.preview && this.preview.index === i) return wriggleAt(g.o.kind, this.preview.tau, this.asym[i], this.lag[i]);
    const env = this.wriggleEnv[i];
    if (env > 0) return scaleDeform(wriggleAt(g.o.kind, this.wriggleTau[i], this.asym[i], this.lag[i]), env);
    if (m.pulse > 0.01) {
      // Slower flex/pulse (LIFE-01): gentle for every form.
      const w = Math.sin(m.beatPhase * 0.7) * m.pulse;
      if (g.o.kind === 'hairy') return { ...ZERO_DEFORM, squish: 0.07 * w };
      return { ...ZERO_DEFORM, bendUp: 0.12 * w, bendDown: 0.1 * w };
    }
    return ZERO_DEFORM;
  }

  private draw() {
    if (this.disposed || this.failed || !this.sharp || !this.q1 || !this.q2) return;
    const gl = this.gl;
    if (gl.isContextLost()) return;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const dpr = this.dpr;
    const colors = SCENE_COLORS[this.theme];
    const dark = this.theme === 'dark';

    const roamPose = this.roam ? roamPoseAt(this.roam, this.roamClock) : { x: this.anchor.x, y: this.anchor.y };
    this.lastRoamPose = roamPose;
    const realm = realmAt(this.progress, this.cssW, this.cssH, roamPose, this.anchor.r);
    this.lastRealm = realm;

    const target = realm.composite ? this.sharp.fb : null;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target);
    gl.viewport(0, 0, W, H);
    this.drawScene(realm, colors, dark, W, H, dpr);

    if (realm.composite) {
      gl.useProgram(this.progBlur);
      gl.bindVertexArray(this.emptyVao);
      this.blurPass(this.sharp, this.q1, 2.0);
      this.blurPass(this.q1, this.q2, 1.5);
      this.composite(realm, colors, W, H, dpr);
    }
    gl.bindVertexArray(null);
    this.opts.onFrame?.({
      progress: this.progress,
      realm,
      roamPose,
      organisms: this.screen,
      width: this.cssW,
      height: this.cssH,
      time: this.time,
      dt: this.lastDt,
    });
    this.lastDt = 0;
  }

  private setDeform(d: DeformParams, half: number, round: boolean) {
    this.u2(this.progOrg, 'uBend', d.bendUp, d.bendDown);
    this.u1(this.progOrg, 'uStretch', d.stretch);
    this.u1(this.progOrg, 'uRock', d.rock);
    this.u2(this.progOrg, 'uSquish', d.squish, d.pull);
    this.u1(this.progOrg, 'uHalf', half);
    this.u1(this.progOrg, 'uRound', round ? 1 : 0);
  }

  private drawScene(realm: RealmState, colors: (typeof SCENE_COLORS)['light'], dark: boolean, W: number, H: number, dpr: number) {
    const gl = this.gl;
    gl.disable(gl.BLEND);
    gl.useProgram(this.progBg);
    gl.bindVertexArray(this.emptyVao);
    this.u2(this.progBg, 'uRes', W, H);
    this.u3(this.progBg, 'uA', ...rgb01(colors.bgA));
    this.u3(this.progBg, 'uB', ...rgb01(colors.bgB));
    this.u1(this.progBg, 'uScale', 420 * dpr);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(this.progOrg);
    this.u2(this.progOrg, 'uRes', W, H);
    this.u1(this.progOrg, 'uDetail', realm.detail);
    const plane = 0.75 + 0.2 * Math.sin((Math.PI * 2 * this.time) / 26);
    const cx = this.cssW / 2;
    const cy = this.cssH / 2;
    const farFade = Math.max(0, Math.min(1, realm.spread - 1));
    const enc = this.director.current;

    for (const i of this.drawOrder) {
      const g = this.orgs[i];
      const m = this.movers[i];
      const sx = cx + (m.x - cx) * realm.spread;
      const sy = cy + (m.y - cy) * realm.spread;
      const scale = g.depthScale * realm.enlarge;
      const scr = this.screen[i];
      scr.x = sx;
      scr.y = sy;
      scr.r = g.extent * scale;
      scr.heading = m.heading;
      scr.speed = m.speed;
      scr.angle = m.angle;
      scr.hidden = this.hidden[i] === 1 || this.dormant[i] === 1;
      scr.busy = !!this.crossing[i] || (!!enc && (enc.a === i || enc.b === i)) || m.mode === 'recoil';
      scr.inFocus = !realm.composite || Math.hypot(sx - realm.cx, sy - realm.cy) < realm.r - scr.r * 0.5;
      if (this.hidden[i] === 1 || this.fade[i] < 0.01) continue;
      if (sx < -160 || sy < -160 || sx > this.cssW + 160 || sy > this.cssH + 160) continue;
      const soft = Math.min(1, Math.abs(g.o.depth - plane) * 1.3) * 0.85;
      const alpha = (0.6 + 0.4 * g.o.depth) * (1 - farFade * (1 - g.o.depth) * 0.7) * this.fade[i];
      const body = rgb01(g.o.color);
      const rim = rgb01(rimColor(g.o.color, this.theme));
      this.u2(this.progOrg, 'uCenter', sx * dpr, sy * dpr);
      this.u1(this.progOrg, 'uAngle', m.angle);
      this.u1(this.progOrg, 'uPhase', g.o.phase[0]);
      this.u1(this.progOrg, 'uSoft', soft);
      this.u1(this.progOrg, 'uAlpha', alpha);
      this.u1(this.progOrg, 'uBeatPhase', m.beatPhase);
      this.u1(this.progOrg, 'uBeatAmp', Math.min(2.2, m.beat) * (1 + this.wriggleEnv[i] * 0.8));
      this.u3(this.progOrg, 'uColor', ...body);
      this.u3(this.progOrg, 'uRim', ...rim);
      if (dark) {
        this.u1(this.progOrg, 'uMode', 2);
        this.setDeform(ZERO_DEFORM, 1, false);
        this.u1(this.progOrg, 'uScale', g.extent * scale * dpr * 1.9);
        gl.bindVertexArray(this.glow.vao);
        gl.drawArrays(gl.TRIANGLES, 0, this.glow.count);
      }
      this.setDeform(this.deformFor(i, g, m), g.half, g.o.kind === 'hairy');
      this.u1(this.progOrg, 'uScale', scale * dpr);
      gl.bindVertexArray(g.vao);
      if (g.strandCount) {
        this.u1(this.progOrg, 'uMode', 1);
        gl.drawArrays(gl.TRIANGLES, g.bodyCount, g.strandCount);
      }
      this.u1(this.progOrg, 'uMode', 0);
      gl.drawArrays(gl.TRIANGLES, 0, g.bodyCount);
    }

    if (enc && enc.phase === 'pair' && enc.link > 0.01) this.drawLink(enc.a, enc.b, enc.link, enc.bead, colors, dpr);
    gl.disable(gl.BLEND);
  }

  /** Abstract pair link with a travelling bead (illustrative, not a mechanism). */
  private drawLink(a: number, b: number, strength: number, bead: number, colors: (typeof SCENE_COLORS)['light'], dpr: number) {
    const gl = this.gl;
    const A = this.screen[a];
    const B = this.screen[b];
    const dx = B.x - A.x;
    const dy = B.y - A.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const d = this.link.data;
    const sag = Math.min(10, len * 0.12) * Math.sin(this.time * 2.2);
    const pt = (t: number): [number, number] => {
      const s = Math.sin(Math.PI * t) * sag;
      return [A.x + dx * t + nx * s, A.y + dy * t + ny * s];
    };
    const halfW = 1.1 * strength + 0.4;
    let k = 0;
    const put = (x: number, y: number, t: number, side: number) => {
      d.set([x, y, 0, 0, t, 0, side, 0, 0, 0], k);
      k += STRIDE;
    };
    for (let i = 0; i < LINK_SEGMENTS; i++) {
      const t0 = i / LINK_SEGMENTS;
      const t1 = (i + 1) / LINK_SEGMENTS;
      const [x0, y0] = pt(t0);
      const [x1, y1] = pt(t1);
      const q = [
        [x0 + nx * halfW, y0 + ny * halfW, t0, -1],
        [x0 - nx * halfW, y0 - ny * halfW, t0, 1],
        [x1 + nx * halfW, y1 + ny * halfW, t1, -1],
        [x1 - nx * halfW, y1 - ny * halfW, t1, 1],
      ];
      for (const v of [q[0], q[1], q[2], q[1], q[3], q[2]]) put(v[0], v[1], 0, v[3]); // aT 0 → no wave/taper
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.link.buf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, d);
    const linkRgb = rgb01(colors.link);
    this.setDeform(ZERO_DEFORM, 1, false);
    this.u1(this.progOrg, 'uBeatAmp', 0);
    this.u2(this.progOrg, 'uCenter', 0, 0);
    this.u1(this.progOrg, 'uAngle', 0);
    this.u1(this.progOrg, 'uScale', dpr);
    this.u1(this.progOrg, 'uSoft', 0);
    this.u1(this.progOrg, 'uAlpha', 0.75 * strength);
    this.u3(this.progOrg, 'uRim', ...linkRgb);
    this.u3(this.progOrg, 'uColor', ...linkRgb);
    this.u1(this.progOrg, 'uMode', 1);
    gl.bindVertexArray(this.link.vao);
    gl.drawArrays(gl.TRIANGLES, 0, this.link.count);
    if (bead > 0 && bead < 1) {
      const [bx, by] = pt(bead);
      this.u2(this.progOrg, 'uCenter', bx * dpr, by * dpr);
      this.u1(this.progOrg, 'uScale', 2.6 * dpr);
      this.u1(this.progOrg, 'uAlpha', 0.95 * strength);
      this.u1(this.progOrg, 'uMode', 3);
      gl.bindVertexArray(this.glow.vao);
      gl.drawArrays(gl.TRIANGLES, 0, this.glow.count);
    }
  }

  private composite(realm: RealmState, colors: (typeof SCENE_COLORS)['light'], W: number, H: number, dpr: number) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.useProgram(this.progComp);
    gl.bindVertexArray(this.emptyVao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sharp!.tex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.q2!.tex);
    this.ui(this.progComp, 'tSharp', 0);
    this.ui(this.progComp, 'tSoft', 1);
    this.u2(this.progComp, 'uRes', W, H);
    this.u2(this.progComp, 'uC', realm.cx * dpr, realm.cy * dpr);
    this.u1(this.progComp, 'uR', realm.r * dpr);
    this.u1(this.progComp, 'uRimW', realm.rimW * dpr);
    this.u1(this.progComp, 'uSheen', realm.sheen);
    this.u1(this.progComp, 'uRefract', realm.refract);
    this.u1(this.progComp, 'uOutside', realm.outside);
    this.u1(this.progComp, 'uRimA', realm.rimAlpha);
    this.u1(this.progComp, 'uHandleA', realm.handleAlpha);
    this.u1(this.progComp, 'uPassage', realm.passage);
    this.u1(this.progComp, 'uPassagePhase', realm.passagePhase);
    this.u1(this.progComp, 'uDpr', dpr);
    this.u3(this.progComp, 'uTint', ...rgb01(colors.tint));
    this.u3(this.progComp, 'uMetal', ...rgb01(colors.metal));
    this.u3(this.progComp, 'uMetalHi', ...rgb01(colors.metalHi));
    this.u3(this.progComp, 'uShadow', ...rgb01(colors.shadow));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private blurPass(src: Target, dst: Target, spread: number) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb);
    gl.viewport(0, 0, dst.w, dst.h);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, src.tex);
    this.ui(this.progBlur, 't', 0);
    this.u2(this.progBlur, 'uTexel', 1 / src.w, 1 / src.h);
    this.u1(this.progBlur, 'uSpread', spread);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // ------------------------------------------------------------- GL helpers

  private target(prev: Target | null, w: number, h: number): Target {
    const gl = this.gl;
    if (prev && prev.w === w && prev.h === h) return prev;
    if (prev) {
      gl.deleteFramebuffer(prev.fb);
      gl.deleteTexture(prev.tex);
    }
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fb, tex, w, h };
  }

  private program(vs: string, fs: string): WebGLProgram {
    const gl = this.gl;
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(s);
        gl.deleteShader(s);
        throw new Error(`shader compile: ${log}`);
      }
      return s;
    };
    const v = compile(gl.VERTEX_SHADER, vs);
    const f = compile(gl.FRAGMENT_SHADER, fs);
    const p = gl.createProgram()!;
    gl.attachShader(p, v);
    gl.attachShader(p, f);
    gl.linkProgram(p);
    gl.deleteShader(v);
    gl.deleteShader(f);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`program link: ${gl.getProgramInfoLog(p)}`);
    return p;
  }

  private loc(p: WebGLProgram, name: string) {
    let m = this.uniformCache.get(p);
    if (!m) {
      m = new Map();
      this.uniformCache.set(p, m);
    }
    if (!m.has(name)) m.set(name, this.gl.getUniformLocation(p, name));
    return m.get(name)!;
  }
  private u1(p: WebGLProgram, n: string, a: number) {
    this.gl.uniform1f(this.loc(p, n), a);
  }
  private ui(p: WebGLProgram, n: string, a: number) {
    this.gl.uniform1i(this.loc(p, n), a);
  }
  private u2(p: WebGLProgram, n: string, a: number, b: number) {
    this.gl.uniform2f(this.loc(p, n), a, b);
  }
  private u3(p: WebGLProgram, n: string, a: number, b: number, c: number) {
    this.gl.uniform3f(this.loc(p, n), a, b, c);
  }
}

/** Resample a closed polygon so no edge is longer than `maxSeg` (local px). */
function resample(poly: [number, number][], maxSeg: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / maxSeg));
    for (let k = 0; k < n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  return out;
}
