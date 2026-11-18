/* eslint-disable @next/next/no-img-element -- supplied SVG lockups are shown unmodified */

/**
 * Supplied lockups, unmodified (assets/RhythmBiome_Logo_System_v4/01_logo/horizontal/svg).
 * Light theme: bronze icon / teal wordmark. Dark theme: copper icon / alabaster wordmark.
 * Minimum horizontal size 140 px; 32 px height renders ≈147 px wide.
 */
export function Logo({ height = 32 }: { height?: number }) {
  const width = Math.round((height * 4595) / 1000);
  return (
    <span className="logo" style={{ width, height }}>
      <img className="logo-light" src="/brand/rhythmbiome-horizontal-light.svg" alt="Rhythm Biome" width={width} height={height} />
      <img className="logo-dark" src="/brand/rhythmbiome-horizontal-dark.svg" alt="Rhythm Biome" width={width} height={height} />
    </span>
  );
}
