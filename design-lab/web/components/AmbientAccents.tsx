'use client';

/**
 * Lightweight ambient organisms for customer pages other than the homepage
 * (34 stage D / AMBIENT-01). Pure SVG + CSS transforms in the page gutters:
 * no WebGL, no lens, never behind the reading column, forms, charts or
 * payment controls. Hidden on narrow screens; frozen by Pause and reduced motion.
 */
import { MicrobeSvg } from './MicrobeSvg';
import { usePrefs } from './PrefsProvider';

const ACCENTS = [
  { kind: 'hairy' as const, size: 13, color: '#8FA7C9', seed: 41, side: 'left', top: '22%', dur: 19, delay: 0 },
  { kind: 'chain' as const, size: 5, color: '#B7A0C9', seed: 42, side: 'left', top: '64%', dur: 23, delay: -6 },
  { kind: 'shortRod' as const, size: 15, color: '#C98B6B', seed: 43, side: 'right', top: '30%', dur: 21, delay: -3 },
  { kind: 'flagellate' as const, size: 12, color: '#9CB98A', seed: 44, side: 'right', top: '72%', dur: 25, delay: -11 },
];

export function AmbientAccents() {
  const { theme } = usePrefs();
  return (
    <div className="ambient" aria-hidden="true">
      {ACCENTS.map((a) => (
        <span
          key={a.seed}
          className={`ambient-organism ambient-${a.side}`}
          style={{ top: a.top, animationDuration: `${a.dur}s`, animationDelay: `${a.delay}s` }}
        >
          <svg width="96" height="96" viewBox="-48 -48 96 96" focusable="false">
            <MicrobeSvg kind={a.kind} size={a.size} color={a.color} theme={theme} shapeSeed={a.seed} rotate={a.seed * 17} opacity={0.75} />
          </svg>
        </span>
      ))}
    </div>
  );
}
