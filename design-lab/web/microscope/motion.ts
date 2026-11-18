/**
 * Living-motion model for the microbial realm (planning 34, Relay 03).
 * Pure TypeScript, no DOM/WebGL — deterministic for a given seed and dt.
 *
 *  LIFE-01  bounded steering: heading, speed, angular velocity with
 *           acceleration limits and eased mode changes; occasional quick
 *           push → coast for swimmers, slower turn/tumble and pulse/flex.
 *  WRIGGLE-01  midpoint-anchored escape-wriggle timeline (bend, reverse,
 *           stretch + recoil, rock both halves, second bend, settle).
 *  LIFE-02  one rare encounter vignette: approach → touch/pair (abstract
 *           link) → separation, plus an occasional lens-cued recoil.
 *
 * Stylised illustration, not a claim about how any real microbe moves.
 */
import { createRng, MAX_EXTENT, type MicrobeKind, type Organism } from '@rb-lab/shared';

const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// ------------------------------------------------------------------ movers

export type MoverMode = 'drift' | 'push' | 'coast' | 'turn' | 'pulse' | 'steer' | 'pair' | 'recoil';

export interface Mover {
  o: Organism;
  rng: () => number;
  swimmer: boolean;
  x: number;
  y: number;
  heading: number;
  speed: number;
  angVel: number;
  /** Rendered body angle (swimmers face their heading). */
  angle: number;
  spin: number;
  mode: MoverMode;
  modeT: number;
  modeDur: number;
  nextEvent: number;
  turnDir: number;
  /** Appendage beat multiplier (1 idle, >1 during pushes). */
  beat: number;
  /** Appendage beat phase (integrated so speed changes never jump). */
  beatPhase: number;
  /** 0..1 body pulse/flex envelope (non-swimmers). */
  pulse: number;
  baseSpeed: number;
  /** Frozen: hover latch or control crossing owns this organism. */
  frozen: boolean;
  steerTo: { x: number; y: number } | null;
  /** Heading to turn toward quickly (recoil/separation) — still rate-limited. */
  aim: number | null;
  /** Lens-recoil cooldown (s). */
  recoilCooldown: number;
}

export interface WorldBounds {
  w: number;
  h: number;
}

export function createMovers(field: Organism[], seed: number, b: WorldBounds): Mover[] {
  return field.map((o, i) => {
    const rng = createRng((seed ^ (o.shapeSeed + i * 7919)) >>> 0);
    const swimmer = o.kind === 'flagellate' || o.kind === 'shortRod';
    const base = Math.hypot(o.vx, o.vy);
    return {
      o,
      rng,
      swimmer,
      x: o.homeU * b.w,
      y: o.homeV * b.h,
      heading: Math.atan2(o.vy, o.vx),
      speed: base,
      angVel: 0,
      angle: swimmer ? Math.atan2(o.vy, o.vx) : o.heading,
      spin: (rng() - 0.5) * 0.12,
      mode: 'drift',
      modeT: 0,
      modeDur: 0,
      nextEvent: 4 + rng() * 16,
      turnDir: rng() < 0.5 ? -1 : 1,
      beat: 1,
      beatPhase: rng() * TAU,
      pulse: 0,
      baseSpeed: base,
      frozen: false,
      steerTo: null,
      aim: null,
      recoilCooldown: 0,
    };
  });
}

/** Limits — the "bounded" in bounded steering. */
const ANG_ACCEL = 1.1; // rad/s²
const ANG_ACCEL_TURN = 2.4;
const MAX_ANG_VEL = 1.15; // rad/s
const MAX_ANG_VEL_AIM = 3; // rad/s — quick but still continuous startle turns
const ACCEL = 22; // px/s² ordinary
const ACCEL_PUSH = 150; // px/s² during a push
const DRAG_COAST = 1.5; // 1/s exponential speed decay while coasting
const PUSH_SPEED: [number, number] = [26, 40];
const MAX_CONCURRENT_PUSHES = 3;

export interface StepContext {
  t: number;
  dt: number;
  bounds: WorldBounds;
  activePushes: number;
}

function startMode(m: Mover, mode: MoverMode, dur: number) {
  m.mode = mode;
  m.modeT = 0;
  m.modeDur = dur;
}

function chooseEvent(m: Mover, ctx: StepContext) {
  const r = m.rng();
  if (m.swimmer) {
    if (r < 0.45 && ctx.activePushes < MAX_CONCURRENT_PUSHES) {
      startMode(m, 'push', lerp(0.35, 0.6, m.rng()));
      ctx.activePushes++;
    } else if (r < 0.8) {
      m.turnDir = m.rng() < 0.5 ? -1 : 1;
      startMode(m, 'turn', lerp(0.8, 1.5, m.rng()));
    } else startMode(m, 'pulse', lerp(1.6, 2.4, m.rng()));
  } else if (r < 0.6) startMode(m, 'pulse', lerp(1.6, 2.6, m.rng()));
  else {
    m.turnDir = m.rng() < 0.5 ? -1 : 1;
    startMode(m, 'turn', lerp(1.2, 2.2, m.rng()));
  }
  m.nextEvent = ctx.t + lerp(7, 19, m.rng());
}

export function stepMover(m: Mover, ctx: StepContext) {
  const { t, dt } = ctx;
  m.recoilCooldown = Math.max(0, m.recoilCooldown - dt);
  if (m.frozen) return;
  m.modeT += dt;

  // Mode transitions (eased: targets change, limits do the easing).
  if (m.mode === 'drift' && t >= m.nextEvent) chooseEvent(m, ctx);
  else if (m.mode === 'push' && m.modeT >= m.modeDur) startMode(m, 'coast', 2.4);
  else if ((m.mode === 'coast' || m.mode === 'turn' || m.mode === 'pulse' || m.mode === 'recoil') && m.modeT >= m.modeDur)
    startMode(m, 'drift', 0);

  // Desired angular velocity.
  const p = m.o.phase;
  let wDesired = 0.2 * Math.sin(t * 0.21 + p[0]) + 0.1 * Math.sin(t * 0.53 + p[1]);
  let alpha = ANG_ACCEL;
  if (m.mode === 'turn') {
    wDesired = m.turnDir * (m.swimmer ? 0.95 : 0.55) * Math.sin(Math.PI * clamp(m.modeT / m.modeDur, 0, 1));
    alpha = ANG_ACCEL_TURN;
  } else if (m.mode === 'push') wDesired = 0;
  else if ((m.mode === 'steer' || m.mode === 'pair') && m.steerTo) {
    const want = Math.atan2(m.steerTo.y - m.y, m.steerTo.x - m.x);
    wDesired = clamp(wrapAngle(want - m.heading) * 1.6, -MAX_ANG_VEL, MAX_ANG_VEL);
    alpha = ANG_ACCEL_TURN;
  }
  let cap = MAX_ANG_VEL;
  if (m.aim !== null) {
    const diff = wrapAngle(m.aim - m.heading);
    if (Math.abs(diff) < 0.06) m.aim = null;
    else {
      wDesired = clamp(diff * 5, -MAX_ANG_VEL_AIM, MAX_ANG_VEL_AIM);
      alpha = 14;
      cap = MAX_ANG_VEL_AIM;
    }
  }
  m.angVel += clamp(wDesired - m.angVel, -alpha * dt, alpha * dt);
  m.angVel = clamp(m.angVel, -cap, cap);
  m.heading = wrapAngle(m.heading + m.angVel * dt);

  // Desired speed.
  let vDesired = m.baseSpeed;
  let accel = ACCEL;
  if (m.mode === 'push') {
    vDesired = lerp(PUSH_SPEED[0], PUSH_SPEED[1], (m.o.shapeSeed % 97) / 97);
    accel = ACCEL_PUSH;
  } else if (m.mode === 'turn') vDesired = m.baseSpeed * 0.45;
  else if (m.mode === 'pulse') vDesired = m.baseSpeed * (1 + 0.5 * Math.sin(Math.PI * clamp(m.modeT / m.modeDur, 0, 1)));
  else if (m.mode === 'steer' && m.steerTo) {
    const d = Math.hypot(m.steerTo.x - m.x, m.steerTo.y - m.y);
    vDesired = clamp(d * 0.6, 3, 14);
  } else if (m.mode === 'pair') vDesired = 0;
  else if (m.mode === 'recoil') {
    // Turn away first, then dart: the burst waits for most of the turn.
    vDesired = 34 * smoothstep(0.2, 0.45, m.modeT) * (1 - clamp(m.modeT / m.modeDur, 0, 1));
    accel = ACCEL_PUSH;
  }
  if (m.mode === 'coast') m.speed = vDesired + (m.speed - vDesired) * Math.exp(-DRAG_COAST * dt);
  else m.speed += clamp(vDesired - m.speed, -accel * dt, accel * dt);

  m.x += Math.cos(m.heading) * m.speed * dt;
  m.y += Math.sin(m.heading) * m.speed * dt;

  // Appendage beat: faster/deeper during push and recoil, easing back while coasting.
  const beatTarget = m.mode === 'push' || m.mode === 'recoil' ? 2.6 : m.mode === 'coast' ? 1.3 : m.mode === 'pair' ? 0.6 : 1;
  m.beat += (beatTarget - m.beat) * Math.min(1, dt * 4);
  m.beatPhase += dt * (1.9 + 3.2 * (m.beat - 1));
  const pulseTarget = m.mode === 'pulse' ? Math.sin(Math.PI * clamp(m.modeT / m.modeDur, 0, 1)) : 0;
  m.pulse += (pulseTarget - m.pulse) * Math.min(1, dt * 5);

  // Body orientation: swimmers face travel (with a slight beat yaw); others rotate slowly.
  if (m.swimmer) {
    const target = m.heading + 0.06 * Math.sin(m.beatPhase * 0.5);
    m.angle += clamp(wrapAngle(target - m.angle), -2.5 * dt, 2.5 * dt);
  } else m.angle += (m.spin + m.angVel * 0.3) * dt;

  // Wrap only outside the visible field (margin > largest organism).
  const mg = MAX_EXTENT;
  const W = ctx.bounds.w + 2 * mg;
  const H = ctx.bounds.h + 2 * mg;
  m.x = ((((m.x + mg) % W) + W) % W) - mg;
  m.y = ((((m.y + mg) % H) + H) % H) - mg;
}

/** Start a lens-cued recoil away from (cx, cy). Returns false if on cooldown. */
export function triggerRecoil(m: Mover, cx: number, cy: number): boolean {
  if (m.frozen || m.recoilCooldown > 0 || m.mode === 'steer' || m.mode === 'pair') return false;
  m.aim = Math.atan2(m.y - cy, m.x - cx); // exaggerated, cartoon "startle" turn-and-dart
  startMode(m, 'recoil', 1.3);
  m.recoilCooldown = 14;
  return true;
}

// ------------------------------------------------------------------ WRIGGLE-01

export interface DeformParams {
  /** Bend angle (rad) at the free end of the +x half and of the −x half. */
  bendUp: number;
  bendDown: number;
  /** Extra reach of the +x end (fraction of half-length). */
  stretch: number;
  /** Rigid rock of both halves together (rad). */
  rock: number;
  /** Near-round forms: squash/stretch amount and one-sided pull. */
  squish: number;
  pull: number;
}

export const ZERO_DEFORM: DeformParams = { bendUp: 0, bendDown: 0, stretch: 0, rock: 0, squish: 0, pull: 0 };

const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
const easeInOut = (t: number) => t * t * (3 - 2 * t);

/** Piecewise bend curve in units of the morphology's amplitude. */
function bendCurve(t: number): number {
  if (t <= 0) return 0;
  if (t < 0.26) return easeOut(t / 0.26); // first opposing bend
  if (t < 0.6) return lerp(1, -0.85, easeInOut((t - 0.26) / 0.34)); // reverse
  if (t < 0.8) return lerp(-0.85, -0.3, easeInOut((t - 0.6) / 0.2)); // easing while one end reaches
  if (t < 1.1) return lerp(-0.3, 0, easeInOut((t - 0.8) / 0.3)); // halves rock together
  if (t < 1.35) return lerp(0, 0.6, easeOut((t - 1.1) / 0.25)); // another opposing bend
  const s = t - 1.35;
  return 0.6 * Math.cos(s * 11) * Math.exp(-s * 5.5); // settle
}
function stretchCurve(t: number): number {
  if (t < 0.62 || t > 1.0) return 0;
  if (t < 0.8) return 0.2 * easeOut((t - 0.62) / 0.18); // one end reaches farther
  if (t < 0.9) return lerp(0.2, -0.06, easeInOut((t - 0.8) / 0.1)); // recoil
  return lerp(-0.06, 0, (t - 0.9) / 0.1);
}
function rockCurve(t: number): number {
  if (t < 0.8 || t > 1.14) return 0;
  const s = (t - 0.8) / 0.34;
  return 0.24 * Math.sin(TAU * s) * (1 - s * 0.4);
}

export const WRIGGLE_DURATION = 1.9;
const FOLLOW_UP_AFTER = 3.4;
const FOLLOW_UP_EVERY = 3.6;

/** Amplitudes per morphology. Near-round forms use a gentler squish/pull. */
const BEND_AMP: Record<MicrobeKind, number> = { shortRod: 0.6, flagellate: 0.5, chain: 0.5, hairy: 0 };

/**
 * Deformation at time tau (s) since hover acquired the target.
 * `asym` (0.7..1) and `lag` (s) give each organism its own asymmetry.
 * While held, a smaller follow-up attempt plays after a pause.
 */
export function wriggleAt(kind: MicrobeKind, tau: number, asym: number, lag: number): DeformParams {
  let t = tau;
  let gain = 1;
  if (tau > FOLLOW_UP_AFTER) {
    t = (tau - FOLLOW_UP_AFTER) % FOLLOW_UP_EVERY;
    gain = 0.55;
  }
  if (t > WRIGGLE_DURATION) return ZERO_DEFORM;
  if (kind === 'hairy') {
    // Near-round: squash/stretch pulses with a one-sided pull, no bending.
    const sq = t < 1.5 ? 0.2 * Math.sin(t * 9) * Math.exp(-t * 1.5) : 0;
    const pl = 0.18 * stretchCurve(t) / 0.2;
    return { ...ZERO_DEFORM, squish: sq * gain, pull: pl * 0.6 * gain, rock: rockCurve(t) * 0.6 * gain };
  }
  const A = BEND_AMP[kind] * gain;
  return {
    bendUp: A * bendCurve(t),
    bendDown: A * asym * bendCurve(t - lag),
    stretch: stretchCurve(t) * gain,
    rock: rockCurve(t) * gain,
    squish: 0,
    pull: 0,
  };
}

export function scaleDeform(d: DeformParams, k: number): DeformParams {
  return {
    bendUp: d.bendUp * k,
    bendDown: d.bendDown * k,
    stretch: d.stretch * k,
    rock: d.rock * k,
    squish: d.squish * k,
    pull: d.pull * k,
  };
}

/**
 * CPU mirror of the vertex-shader deformation (for tests and review
 * filmstrips). `half` is the body half-length along local x.
 */
export function deformPoint(x: number, y: number, d: DeformParams, half: number, round: boolean): [number, number] {
  if (round) {
    const px = x * (1 + d.squish) + d.pull * Math.max(x, 0);
    const py = y * (1 - d.squish * 0.6);
    return [px, py];
  }
  const u = clamp(x / half, -1.6, 1.6);
  const bend = u >= 0 ? d.bendUp : d.bendDown;
  const a = bend * u * (0.55 + 0.45 * Math.abs(u));
  const sx = x * (1 + d.stretch * Math.max(u, 0));
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [c * sx - s * y, s * sx + c * y];
}

// ------------------------------------------------------------------ LIFE-02 encounter

export type EncounterPhase = 'approach' | 'pair' | 'separate';

export interface Encounter {
  a: number;
  b: number;
  phase: EncounterPhase;
  phaseT: number;
  meet: { x: number; y: number };
  /** 0..1 strength of the abstract link (pair phase only). */
  link: number;
  /** 0..1 travelling bead along the link (illustrative "transfer"). */
  bead: number;
  startedAt: number;
}

export interface EncounterLogEntry {
  t: number;
  kind: 'pair' | 'recoil' | 'interrupted';
  a: string;
  b?: string;
  morphologies: string;
}

const APPROACH_MAX = 4.5;
const PAIR_DUR = 2.2;
const SEPARATE_DUR = 1.6;

export class EncounterDirector {
  current: Encounter | null = null;
  nextAt: number;
  log: EncounterLogEntry[] = [];
  private rng: () => number;

  constructor(seed: number, firstAt = 22) {
    this.rng = createRng(seed >>> 0);
    this.nextAt = firstAt + this.rng() * 10;
  }

  /** Choose a nearby, visible, unfrozen pair and start approaching. */
  tryStart(movers: Mover[], t: number, view: WorldBounds, force = false): boolean {
    if (this.current || (!force && t < this.nextAt)) return false;
    let best: [number, number, number] | null = null;
    for (let i = 0; i < movers.length; i++) {
      const a = movers[i];
      if (a.frozen || a.o.depth < 0.35 || !inView(a, view)) continue;
      for (let j = i + 1; j < movers.length; j++) {
        const b = movers[j];
        if (b.frozen || b.o.depth < 0.35 || !inView(b, view)) continue;
        if (Math.abs(a.o.depth - b.o.depth) > 0.4) continue;
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < 60 || d > 220) continue;
        // Prefer rods/strand-bearers, which read best as a pair.
        const score = d + (a.swimmer ? 0 : 60) + (b.swimmer ? 0 : 60) + this.rng() * 40;
        if (!best || score < best[2]) best = [i, j, score];
      }
    }
    if (!best) {
      this.nextAt = t + 6;
      return false;
    }
    const [i, j] = best;
    const A = movers[i];
    const B = movers[j];
    const meet = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
    this.current = { a: i, b: j, phase: 'approach', phaseT: 0, meet, link: 0, bead: 0, startedAt: t };
    for (const m of [A, B]) {
      m.mode = 'steer';
      m.modeT = 0;
      m.modeDur = APPROACH_MAX;
      m.steerTo = meet;
    }
    return true;
  }

  step(movers: Mover[], t: number, dt: number) {
    const e = this.current;
    if (!e) return;
    const A = movers[e.a];
    const B = movers[e.b];
    // Graceful interruption: a hover/crossing takes one member → part gently.
    if (A.frozen || B.frozen) {
      this.log.push({ t, kind: 'interrupted', a: A.o.id, b: B.o.id, morphologies: `${A.o.kind}+${B.o.kind}` });
      this.release(movers, t, true);
      return;
    }
    e.phaseT += dt;
    const contact = (A.o.size + B.o.size) * 0.95;
    const d = Math.hypot(A.x - B.x, A.y - B.y);
    if (e.phase === 'approach') {
      // Each aims at the meeting point offset by half the contact distance.
      const ux = (B.x - A.x) / (d || 1);
      const uy = (B.y - A.y) / (d || 1);
      A.steerTo = { x: e.meet.x - ux * contact * 0.5, y: e.meet.y - uy * contact * 0.5 };
      B.steerTo = { x: e.meet.x + ux * contact * 0.5, y: e.meet.y + uy * contact * 0.5 };
      if (d <= contact * 1.08 || e.phaseT > APPROACH_MAX) {
        e.phase = 'pair';
        e.phaseT = 0;
        for (const m of [A, B]) {
          m.mode = 'pair';
          m.modeT = 0;
          m.modeDur = PAIR_DUR + 1;
        }
        this.log.push({ t, kind: 'pair', a: A.o.id, b: B.o.id, morphologies: `${A.o.kind}+${B.o.kind}` });
      }
    } else if (e.phase === 'pair') {
      const k = e.phaseT / PAIR_DUR;
      e.link = Math.sin(Math.PI * clamp(k, 0, 1));
      e.bead = clamp((k - 0.2) / 0.6, 0, 1);
      // Hold close: gentle spring toward contact distance.
      const ux = (B.x - A.x) / (d || 1);
      const uy = (B.y - A.y) / (d || 1);
      const err = (d - contact) * 0.5 * Math.min(1, dt * 3);
      A.x += ux * err;
      A.y += uy * err;
      B.x -= ux * err;
      B.y -= uy * err;
      if (e.phaseT >= PAIR_DUR) {
        e.phase = 'separate';
        e.phaseT = 0;
        e.link = 0;
        // Push apart: short burst away from each other, then coast.
        A.aim = Math.atan2(A.y - B.y, A.x - B.x);
        B.aim = Math.atan2(B.y - A.y, B.x - A.x);
        for (const m of [A, B]) {
          m.steerTo = null;
          m.mode = 'recoil'; // turn apart, then a short push and coast
          m.modeT = 0;
          m.modeDur = 1.2;
        }
      }
    } else if (e.phaseT >= SEPARATE_DUR) this.release(movers, t, false);
  }

  private release(movers: Mover[], t: number, interrupted: boolean) {
    const e = this.current;
    if (!e) return;
    for (const m of [movers[e.a], movers[e.b]]) {
      m.steerTo = null;
      if (m.mode === 'steer' || m.mode === 'pair') {
        m.mode = 'coast';
        m.modeT = 0;
        m.modeDur = interrupted ? 1.2 : 2.4;
      }
    }
    this.current = null;
    this.nextAt = t + 30 + this.rng() * 25; // rare
  }

  /** Review/test: start as soon as a suitable pair exists. */
  forceSoon(t: number) {
    this.nextAt = t;
  }
}

function inView(m: Mover, v: WorldBounds) {
  return m.x > 40 && m.y > 40 && m.x < v.w - 40 && m.y < v.h - 40;
}
