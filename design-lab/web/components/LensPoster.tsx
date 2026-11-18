'use client';

/**
 * Static poster for reduced motion, explicit ?static=1, unsupported WebGL2 or
 * context loss (MOTION-01). No scene download, no animation, every action intact.
 */
import { useMemo } from 'react';
import { createField, MICROBE_KINDS, type MicrobeKind, type ThemeName } from '@rb-lab/shared';
import { MicrobeSvg } from './MicrobeSvg';

const LENS_ORGANISMS = [
  { kind: MICROBE_KINDS[0], size: 13, color: '#8FA7C9', x: -38, y: -30, rotate: 0, shapeSeed: 11 },
  { kind: MICROBE_KINDS[1], size: 15, color: '#C98B6B', x: 34, y: -40, rotate: 28, shapeSeed: 12 },
  { kind: MICROBE_KINDS[2], size: 13, color: '#9CB98A', x: 40, y: 34, rotate: -150, shapeSeed: 13 },
  { kind: MICROBE_KINDS[3], size: 5, color: '#B7A0C9', x: -30, y: 40, rotate: -18, shapeSeed: 14 },
];

/** Blurred background field behind the hero copy. */
export function PosterField({ theme }: { theme: ThemeName }) {
  const field = useMemo(() => createField({ seed: 7, count: 12, width: 1440, height: 900 }), []);
  return (
    <svg className="poster-field" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <filter id="poster-blur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>
      <g filter="url(#poster-blur)" opacity={0.55}>
        {field.map((o) => (
          <MicrobeSvg
            key={o.id}
            kind={o.kind}
            size={o.size}
            color={o.color}
            theme={theme}
            shapeSeed={o.shapeSeed}
            x={o.homeU * 1440}
            y={o.homeV * 900}
            rotate={(o.heading * 180) / Math.PI}
          />
        ))}
      </g>
    </svg>
  );
}

/**
 * Magnifier with all four morphologies in focus. Fills the .lens-anchor box.
 * Organisms are pointer-selectable (no wriggle); keyboard and screen-reader
 * users use the "Meet the microbes" list, so these stay aria-hidden.
 */
export function LensPoster({ theme, onSelect }: { theme: ThemeName; onSelect?: (kind: MicrobeKind, el: Element) => void }) {
  const dark = theme === 'dark';
  const metal = dark ? '#3E5A5B' : '#7C4E28';
  const metalHi = dark ? '#B9CFC7' : '#D9A46E';
  const inner = dark ? '#16282D' : '#F2E9E5';
  return (
    <svg className="lens-poster" viewBox="-100 -100 200 200" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id="lens-clip">
          <circle r="92" />
        </clipPath>
        <linearGradient id="lens-rim" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={metalHi} />
          <stop offset="1" stopColor={metal} />
        </linearGradient>
        <radialGradient id="lens-sheen" cx="0.32" cy="0.28" r="0.4">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.32" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        {dark ? (
          <filter id="lens-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        ) : null}
      </defs>
      <rect x="86" y="-11" width="78" height="22" rx="8" fill={metal} transform="rotate(45)" pointerEvents="none" />
      <circle r="92" fill={inner} />
      <g clipPath="url(#lens-clip)" filter={dark ? 'url(#lens-glow)' : undefined}>
        {LENS_ORGANISMS.map((o) => (
          <g
            key={o.shapeSeed}
            className={onSelect ? 'poster-target' : undefined}
            onClick={onSelect ? (e) => onSelect(o.kind, e.currentTarget) : undefined}
          >
            <circle cx={o.x} cy={o.y} r={Math.max(16, o.size * 1.6)} fill="transparent" />
            <MicrobeSvg {...o} theme={theme} />
          </g>
        ))}
      </g>
      <circle r="92" fill="url(#lens-sheen)" pointerEvents="none" />
      <circle r="96" fill="none" stroke="url(#lens-rim)" strokeWidth="8" pointerEvents="none" />
    </svg>
  );
}
