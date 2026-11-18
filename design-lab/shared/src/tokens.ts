/**
 * Rhythm Biome D0 design tokens.
 *
 * Sources (exact values, do not edit here without updating the source):
 *  - master palette: assets/RhythmBiome_Logo_System_v4/README.txt
 *  - report palettes: assets/report-color-tokens.json
 *  - UI roles: Rhythm_Biome_Codex_Planning_Pack_v0.4/design-tokens.proposed.json (proposal)
 *
 * Values marked DERIVED are D0 proposals made for this specimen and need owner review.
 */

export const master = {
  teal: '#0F3D3E',
  charcoal: '#1E242B',
  sage: '#7A9A8E',
  copper: '#B87333',
  bronze: '#94592A',
  alabaster: '#F8F9F8',
} as const;

export const reportPalettes = {
  gut: { background: '#FAD15C', foreground: '#B87333' },
  skin: { background: '#9FB38F', foreground: '#0F3D3E' },
  vaginal: { background: '#B39ACD', foreground: '#5B3F75' },
  infants: { background: '#D5A18E', foreground: '#9E2A62' },
  pets: { background: '#87B9D4', foreground: '#94592A' },
  protein: { background: '#E7A66C', foreground: '#1E242B' },
} as const;

/** Public launch categories only (29: gut/skin/vaginal). */
export type PublicCategory = 'gut' | 'skin' | 'vaginal';

export type ThemeName = 'light' | 'dark';
export type ThemePreference = ThemeName | 'system';

export interface ThemeRoles {
  canvas: string;
  surface: string;
  surfaceRaised: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  action: string;
  onAction: string;
  focus: string;
  /** Status hues are paired with text/icons; never colour alone. */
  info: string;
  warning: string;
  danger: string;
  success: string;
  /** Microscope scene (web) / illustration backdrops (native). */
  scene: string;
  sceneDeep: string;
}

export const themes: Record<ThemeName, ThemeRoles> = {
  light: {
    canvas: '#F8F9F8', // proposed
    surface: '#FFFFFF', // proposed
    surfaceRaised: '#FFFFFF',
    text: '#1E242B', // proposed
    textSecondary: '#0F3D3E', // proposed
    textMuted: '#4A5560', // DERIVED: charcoal/alabaster mix, 7.61:1 on #FFFFFF (computed)
    border: '#D9DFDC', // DERIVED
    action: '#0F3D3E', // proposed
    onAction: '#F8F9F8', // proposed
    focus: '#94592A', // proposed
    info: '#0F3D3E',
    warning: '#7A4A12', // DERIVED: darkened copper family for text-safe warnings
    danger: '#9B2C2C', // DERIVED
    success: '#2F5D50', // DERIVED: darkened sage
    scene: '#F2E9E5', // proposed heroWheat
    sceneDeep: '#E6D6CB', // DERIVED wheat shadow
  },
  dark: {
    canvas: '#1E242B', // proposed
    surface: '#0F3D3E', // proposed
    surfaceRaised: '#14494A', // DERIVED
    text: '#F8F9F8', // proposed
    textSecondary: '#D8E1DE', // proposed
    textMuted: '#AEBDB8', // DERIVED, 8.02:1 on #1E242B, 6.13:1 on #0F3D3E (computed)
    border: '#2E4A4B', // DERIVED
    action: '#F8F9F8', // proposed
    onAction: '#0F3D3E', // proposed
    focus: '#FAD15C', // proposed
    info: '#D8E1DE',
    warning: '#F2C46B', // DERIVED
    danger: '#F2A1A1', // DERIVED
    success: '#A9CBBE', // DERIVED
    scene: '#16282D', // DERIVED deep teal/charcoal field
    sceneDeep: '#101D21', // DERIVED
  },
};

export const spacing = [4, 8, 12, 16, 24, 32, 48, 64, 96] as const;
export const radii = { control: 12, card: 24, pill: 999 } as const;
export const motionMs = { press: 100, state: 180, panel: 260, celebrationMax: 650 } as const;

export const fonts = {
  ui: 'Hanken Grotesk',
  data: 'IBM Plex Mono',
} as const;
