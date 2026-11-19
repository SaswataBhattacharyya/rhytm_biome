# D0 asset provenance

All brand files are **unmodified copies** of the owner-supplied sources (checked by SHA-256 in Claude's session on 18 Nov 2026). The logo is not recreated and fonts are not substituted. No reference-app (Clovia/Duolingo) artwork, code or fonts are used. No report PDFs were read or used.

## Copied supplied files

| Specimen path | Source (workspace-relative) | SHA-256 match |
|---|---|---|
| `web/app/fonts/HankenGrotesk-Variable.ttf` | `assets/fonts/hanken-grotesk/HankenGrotesk-Variable.ttf` | identical (813b3f8fa096…) |
| `web/app/fonts/IBMPlexMono-Regular.ttf` | `assets/fonts/ibm-plex-mono/IBMPlexMono-Regular.ttf` | identical (6a3412f058c7…) |
| `web/app/fonts/IBMPlexMono-Medium.ttf` | `assets/fonts/ibm-plex-mono/IBMPlexMono-Medium.ttf` | identical (a9b4c49bb299…) |
| `web/app/fonts/OFL-HankenGrotesk.txt` | `assets/fonts/hanken-grotesk/OFL.txt` | identical (e02ccb89a868…) |
| `web/app/fonts/OFL-IBMPlexMono.txt` | `assets/fonts/ibm-plex-mono/OFL.txt` | identical (7e6b2818edbd…) |
| `web/public/brand/rhythmbiome-horizontal-light.svg` | `assets/RhythmBiome_Logo_System_v4/01_logo/horizontal/svg/rhythmbiome-horizontal-light.svg` | identical (bf2ca4cc96b5…) |
| `web/public/brand/rhythmbiome-horizontal-dark.svg` | `assets/RhythmBiome_Logo_System_v4/01_logo/horizontal/svg/rhythmbiome-horizontal-dark.svg` | identical (765ef957bac6…) |
| `web/app/icon.svg` | `assets/RhythmBiome_Logo_System_v4/02_icon/favicon/favicon.svg` | identical (be0a0675d843…) |
| `web/app/apple-icon.png` | `assets/RhythmBiome_Logo_System_v4/02_icon/favicon/favicon-180.png` | identical (6dc95008b71a…) |
| `web/app/favicon.ico` | `assets/RhythmBiome_Logo_System_v4/02_icon/favicon/favicon.ico` | identical (b2b402d77b25…) |
| `mobile/assets/brand/rhythmbiome-horizontal-light.png` | `assets/RhythmBiome_Logo_System_v4/01_logo/horizontal/png/rhythmbiome-horizontal-light.png` | identical (9eab39dfcc70…) |
| `mobile/assets/brand/rhythmbiome-horizontal-dark.png` | `assets/RhythmBiome_Logo_System_v4/01_logo/horizontal/png/rhythmbiome-horizontal-dark.png` | identical (2e87d0ed58ae…) |
| `mobile/assets/brand/rhythmbiome-app-icon.png` | `assets/RhythmBiome_Logo_System_v4/02_icon/app-and-avatar/rhythmbiome-app-icon.png` | identical (d5dce458c3c7…) |
| `mobile/assets/brand/rhythmbiome-app-icon-light.png` | `assets/RhythmBiome_Logo_System_v4/02_icon/app-and-avatar/rhythmbiome-app-icon-light.png` | identical (90300bb49f74…) |
| `mobile/assets/brand/rhythmbiome-icon-simplified-white.png` | `assets/RhythmBiome_Logo_System_v4/02_icon/simplified/png/rhythmbiome-icon-simplified-white.png` | identical (de6d2ed06da9…) |
| `mobile/assets/fonts/IBMPlexMono-Medium.ttf` | `assets/fonts/ibm-plex-mono/IBMPlexMono-Medium.ttf` | identical (a9b4c49bb299…) |
| `mobile/assets/fonts/OFL-HankenGrotesk.txt` | `assets/fonts/hanken-grotesk/OFL.txt` | identical (e02ccb89a868…) |
| `mobile/assets/fonts/OFL-IBMPlexMono.txt` | `assets/fonts/ibm-plex-mono/OFL.txt` | identical (7e6b2818edbd…) |

## Derived from supplied files

| Specimen path | Derived from | How |
|---|---|---|
| `mobile/assets/fonts/HankenGrotesk-{Regular,Medium,SemiBold,Bold}.ttf` | `assets/fonts/hanken-grotesk/HankenGrotesk-Variable.ttf` | Static `wght` instances 400/500/600/700 via `scripts/instance_hanken.py` (fontTools 4.67.0). Same design; SIL OFL 1.1, no Reserved Font Name. Needed because Android cannot pick weights from a variable TTF. Codex may regenerate to confirm. |

## Original to this specimen (Claude-authored, 18 Nov 2026)

| Item | Path |
|---|---|
| Four decorative microbe morphologies, seeded shapes/paths/palette | `shared/src/microbes.ts` (rendered by `web/microscope/*`, `web/components/MicrobeSvg.tsx`, `mobile/src/components/art.tsx`) |
| Lens/magnifier composite (rim, handle, sheen, refraction) | `web/microscope/shaders.ts`, `web/components/LensPoster.tsx` |
| Service panel illustrations | `web/components/PanelArt.tsx` |
| Tab and section outline icons | `mobile/src/components/art.tsx` (`Icon`) |
| Relay 02: translucent envelope, inner membrane line, nucleoid-like loops and granules (procedural, illustrative — not anatomy) | `web/microscope/shaders.ts` (`ORGANISM_FS`) |
| Relay 02: edge skimmers, passage ripple | `web/microscope/skimmers.ts`, `shaders.ts` (`COMPOSITE_FS`) |
| Relay 02: knowledge-card illustrations (`hairy_sphere`, `short_rod`, `twin_strand_rod`, `cell_chain`, `note_lens`, `note_log`) | `web/components/KnowledgeArt.tsx`, `mobile/src/components/art.tsx` (`KnowledgeArt`) |
| Relay 02: ambient gutter organisms | `web/components/AmbientAccents.tsx` |
| Relay 03: escape-wriggle deformation, push/coast/turn/pulse motion, pair encounter link (abstract, illustrative — not a depiction of conjugation or any real mechanism), control crossings | `web/microscope/motion.ts`, `shaders.ts`, `engine.ts`, `crossings.ts` |
| Relay 04: lower-homepage drift organisms (generated from the shared shape model, low opacity) and the compact native Home rows | `web/components/LowerAmbient.tsx`, `mobile/app/(tabs)/index.tsx` |
| Relay 07: catalogue preview illustrations `pouch-1..3.png`, `single-1.png` — abstract shapes in the Rhythm Biome palette, each labelled "SYNTHETIC PREVIEW · n of m", generated for this project (PIL, IBM Plex Mono label). Used only by the `gallery` fixture scenario. | `web/public/catalog-preview/`, `mobile/assets/catalog-preview/` |

Decorative microbe colours follow the owner's non-brand exception (brief 29). They are not status colours or species identifications.

## Evidence files

`evidence/claude-session/` holds screenshots and a recording from Claude's cloud session. They were rendered from these source components in an esbuild + headless-Chrome harness with a `next/link` stub — **not** from a Next.js build. They are design-review material, not build verification.
