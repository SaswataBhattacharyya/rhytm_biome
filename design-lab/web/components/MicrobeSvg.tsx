import { rimColor, shapeOf, shapeToSvg, type MicrobeKind, type ThemeName } from '@rb-lab/shared';

export interface MicrobeSvgProps {
  kind: MicrobeKind;
  size: number;
  color: string;
  theme: ThemeName;
  shapeSeed: number;
  x?: number;
  y?: number;
  rotate?: number;
  opacity?: number;
}

/** One decorative organism as SVG <g>, from the shared shape model. */
export function MicrobeSvg({ kind, size, color, theme, shapeSeed, x = 0, y = 0, rotate = 0, opacity = 1 }: MicrobeSvgProps) {
  const svg = shapeToSvg(shapeOf({ kind, size, shapeSeed }));
  const rim = rimColor(color, theme);
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate})`} opacity={opacity}>
      {svg.strands.map((s, i) => (
        <path key={`s${i}`} d={s.d} fill="none" stroke={rim} strokeWidth={s.width} strokeLinecap="round" />
      ))}
      {svg.bodies.map((d, i) => (
        <path key={`b${i}`} d={d} fill={color} stroke={rim} strokeWidth={Math.max(0.8, size * 0.09)} />
      ))}
    </g>
  );
}
