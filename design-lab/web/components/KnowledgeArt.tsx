import { kindForIllustrationRef, type ThemeName } from '@rb-lab/shared';
import { MicrobeSvg } from './MicrobeSvg';

const MICROBE_ART: Record<string, { size: number; color: string; seed: number; rotate: number }> = {
  hairy: { size: 22, color: '#8FA7C9', seed: 11, rotate: 0 },
  shortRod: { size: 26, color: '#C98B6B', seed: 12, rotate: -20 },
  flagellate: { size: 18, color: '#9CB98A', seed: 13, rotate: 200 },
  chain: { size: 8.5, color: '#B7A0C9', seed: 14, rotate: -10 },
};

/**
 * Illustration for a knowledge card from its supported `illustration.ref`.
 * Unknown refs render a neutral placeholder frame (no invented art).
 */
export function KnowledgeArt({ refName, theme, size = 96, label }: { refName: string; theme: ThemeName; size?: number; label?: string }) {
  const kind = kindForIllustrationRef(refName);
  const common = {
    width: size,
    height: size,
    viewBox: '-50 -50 100 100',
    className: 'knowledge-art',
    role: label ? 'img' : undefined,
    'aria-label': label,
    'aria-hidden': label ? undefined : true,
    focusable: false as const,
  };
  if (kind) {
    const a = MICROBE_ART[kind];
    return (
      <svg {...common}>
        <circle r="48" className="knowledge-art-disc" />
        <MicrobeSvg kind={kind} size={a.size} color={a.color} theme={theme} shapeSeed={a.seed} rotate={a.rotate} />
      </svg>
    );
  }
  const line = { fill: 'none', stroke: 'currentColor', strokeWidth: 3, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg {...common}>
      <circle r="48" className="knowledge-art-disc" />
      {refName === 'note_lens' ? (
        <g {...line}>
          <circle cx="-6" cy="-6" r="20" />
          <path d="M8 8 L26 26" strokeWidth={6} />
        </g>
      ) : refName === 'note_log' ? (
        <g {...line}>
          <rect x="-24" y="-20" width="48" height="44" rx="8" />
          <path d="M-24 -6 H24 M-12 -28 V-14 M12 -28 V-14 M-9 10 L-2 17 L11 3" />
        </g>
      ) : (
        <g {...line}>
          <rect x="-22" y="-22" width="44" height="44" rx="8" strokeDasharray="5 5" />
        </g>
      )}
    </svg>
  );
}
