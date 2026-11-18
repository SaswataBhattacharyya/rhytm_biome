/**
 * Original small outline illustrations for the four service panels.
 * currentColor = line colour; --panel-accent = fill accent.
 */
type ArtKind = 'kit' | 'reports' | 'log' | 'progress';

export function PanelArt({ kind }: { kind: ArtKind }) {
  const common = {
    width: 72,
    height: 72,
    viewBox: '0 0 72 72',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: false,
    className: 'panel-art',
  };
  switch (kind) {
    case 'kit':
      return (
        <svg {...common}>
          <path d="M14 28 L36 18 L58 28 L58 52 L36 62 L14 52 Z" />
          <path d="M14 28 L36 38 L58 28 M36 38 V62" />
          <circle cx="47" cy="45" r="5" fill="var(--panel-accent)" />
          <path d="M47 38.5v-2.5 M53.5 45h2.5 M47 51.5v2.5 M40.5 45H38 M51.6 40.4l1.8-1.8 M51.6 49.6l1.8 1.8 M42.4 49.6l-1.8 1.8 M42.4 40.4l-1.8-1.8" strokeWidth="1.4" />
        </svg>
      );
    case 'reports':
      return (
        <svg {...common}>
          <path d="M20 12 H44 L54 22 V60 H20 Z" />
          <path d="M44 12 V22 H54" />
          <rect x="27" y="40" width="5" height="12" rx="1.5" fill="var(--panel-accent)" />
          <rect x="35" y="34" width="5" height="18" rx="1.5" />
          <rect x="43" y="44" width="5" height="8" rx="1.5" />
          <path d="M27 28 H40" />
        </svg>
      );
    case 'log':
      return (
        <svg {...common}>
          <rect x="14" y="18" width="44" height="40" rx="8" />
          <path d="M14 30 H58 M26 12 V22 M46 12 V22" />
          <circle cx="36" cy="44" r="8" fill="var(--panel-accent)" />
          <path d="M32 44 L35 47 L40.5 41" />
        </svg>
      );
    case 'progress':
      return (
        <svg {...common}>
          <path d="M12 58 H60" />
          <circle cx="18" cy="46" r="3.5" fill="var(--panel-accent)" />
          <circle cx="30" cy="40" r="3.5" fill="var(--panel-accent)" />
          <circle cx="42" cy="44" r="3.5" strokeDasharray="2 2.4" />
          <circle cx="54" cy="30" r="3.5" fill="var(--panel-accent)" />
          <path d="M21 44.5 L27 41.5 M45 41.5 L51.5 32.5" strokeWidth="1.4" />
        </svg>
      );
  }
}
