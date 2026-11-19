'use client';

/**
 * AMBIENT-LOWER-01 — sparse, low-contrast life below the services.
 *
 * Each lane is a zero-height marker placed between lower-homepage sections.
 * Its single organism travels across the page inside the empty band above
 * the next heading (the section's top padding), so it never passes behind
 * headings, body text, knowledge cards, step cards or FAQ controls at any
 * width. No WebGL and no second lens: pure SVG + CSS transforms, reusing
 * the light ambient treatment. Pause freezes it; reduced motion parks it at
 * a fixed resting place. The last lane, above the footer, is the quietest.
 */
import type { MicrobeKind } from '@rb-lab/shared';
import { MicrobeSvg } from './MicrobeSvg';
import { usePrefs } from './PrefsProvider';

interface Lane {
  kind: MicrobeKind;
  size: number;
  color: string;
  seed: number;
  /** Seconds to cross the page. */
  dur: number;
  /** Negative delay spreads the lanes so the page is never in lock-step. */
  delay: number;
  reverse: boolean;
  /** Resting position (share of width) for reduced motion. */
  rest: number;
  /** 0..1 strength; the footer lane fades out. */
  strength: number;
}

const LANES: Lane[] = [
  { kind: 'flagellate', size: 11, color: '#9CB98A', seed: 61, dur: 96, delay: -30, reverse: false, rest: 0.84, strength: 1 },
  { kind: 'chain', size: 4.5, color: '#B7A0C9', seed: 62, dur: 128, delay: -71, reverse: true, rest: 0.08, strength: 0.9 },
  { kind: 'shortRod', size: 12, color: '#C98B6B', seed: 63, dur: 110, delay: -12, reverse: false, rest: 0.7, strength: 0.85 },
  { kind: 'hairy', size: 10, color: '#8FA7C9', seed: 64, dur: 140, delay: -95, reverse: true, rest: 0.18, strength: 0.75 },
  { kind: 'shortRod', size: 9, color: '#A7B5C8', seed: 65, dur: 150, delay: -48, reverse: false, rest: 0.9, strength: 0.4 },
];

export const LOWER_LANE_COUNT = LANES.length;

export function DriftLane({ index }: { index: number }) {
  const { theme } = usePrefs();
  const lane = LANES[index % LANES.length];
  return (
    <div className="drift-lane" aria-hidden="true">
      <span
        className="drift"
        style={{
          animationDuration: `${lane.dur}s`,
          animationDelay: `${lane.delay}s`,
          animationDirection: lane.reverse ? 'reverse' : 'normal',
          ['--rest' as string]: lane.rest,
          ['--strength' as string]: lane.strength,
        }}
      >
        <span className="drift-body" style={{ animationDelay: `${-lane.seed % 9}s` }}>
          <svg width="56" height="44" viewBox="-28 -22 56 44" focusable="false">
            <MicrobeSvg
              kind={lane.kind}
              size={lane.size}
              color={lane.color}
              theme={theme}
              shapeSeed={lane.seed}
              rotate={lane.reverse ? 180 : 0}
            />
          </svg>
        </span>
      </span>
    </div>
  );
}
