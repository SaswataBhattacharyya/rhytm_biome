# Rhythm Biome — D0 design specimen (`design-lab/`)

Bounded, synthetic design specimen for Relay 01 (revision 2). This is **not** the production scaffold, not a backend client, and not evidence of a working health or commerce service.

| Workspace | Path | What it is |
|---|---|---|
| `@rb-lab/shared` | `shared/src` | Tokens (exact brand/report values + D0 derived roles), D0 synthetic fixtures, seeded decorative microbe model shared by web and native |
| `@rb-lab/web` | `web/` | Next.js App Router: microscope homepage + honest destination stubs |
| `@rb-lab/mobile` | `mobile/` | Expo Router (Android): five canonical tabs; Home, Log, Reports states; report layout; settings |

## Run (all NOT RUN by Claude — Codex resolves, installs and verifies)

```bash
cd design-lab
npm install                      # generates the single specimen lockfile (Codex owns it)
npm run web:dev                  # http://localhost:3210
npm run web:build && npm run web:start
# Android development build (distinct identity com.rhythmbiome.d0specimen, Metro on 8090):
cd mobile && npx expo install --check && npx expo prebuild --platform android --clean && npx expo run:android --port 8090
```

Ports avoid the occupied reference ports 3191 / 8081 / 8082.

## Web review hooks

| Query | Effect |
|---|---|
| `/?lens=0.5` | Freezes lens progress `p` (keyframes 0 / 0.25 / 0.5 / 0.75 / 1) |
| `/?t=12` | Freezes the ambient clock at 12 s (deterministic captures) |
| `/?static=1` | Forces the static poster (same as reduced motion / no WebGL2) |
| `/?seed=42` | Alternate seeded organism set |
| `/?targets=1` | Outline the pointer-only microbe hit targets |
| `/?cross=demo` | Shorter quiet gaps between control crossings (review only; same rules) |
| `/?crossSeed=7` | Seed for crossing decisions (default 3) — reproducible sample |
| `/?encounter=1` | Start the pair encounter as soon as a suitable pair is visible |
| `window.__rbD0` | `snapshot()` (progress, total/visible/in-lens counts, composite on/off, realm state, roam pose, hover/wriggle), `trackedDiameter(i)`, `setTime(t)`, `targets()`, `exclusions()` |

## Relay 02 — microbial realm and knowledge cards (planning 34)

| Stage | Where |
|---|---|
| A — roaming lens, dense field, decorative edge skimmers | `web/microscope/layout.ts` (`authoredRoamPoints`, `roamPoseAt`), `engine.ts`, `skimmers.ts` |
| B — glide from captured pose, expand, spread | `layout.ts` `realmAt` (gather 0–0.4, expand 0.04–0.6, spread 0.28–0.95) |
| C — passage, 1.35× enlargement, translucent envelopes + nucleoid-like interiors, then **no composite pass** (p ≥ 0.86) | `layout.ts`, `shaders.ts`, `engine.ts` |
| D — floating panels, customer-page accents | `web/app/globals.css` (`.panel-float`, `.ambient`), `web/components/AmbientAccents.tsx`, native `MicrobeSpot` |
| Learn — hover wriggle, click/tap card, Meet the microbes list | `web/microscope/hitTargets.ts`, `web/components/KnowledgeProvider.tsx`, `MeetMicrobes.tsx`; native `mobile/src/components/knowledge.tsx` |
| Content | `shared/src/knowledge.ts` — ContentFields types, placeholder fixtures, replaceable fixture transport, validator |

All densities, timings and scale factors are provisional tuning for M1.

## Relay 03 — living motion polish (planning 34, Relay 03 section)

| ID | Where | Review hook |
|---|---|---|
| WRIGGLE-01 midpoint-anchored escape wriggle | `web/microscope/motion.ts` (`wriggleAt`, `deformPoint` CPU mirror), `shaders.ts` (`deform()` in `ORGANISM_VS`), engine tessellation | hover any microbe; `__rbD0.previewWriggle(index, tau)` freezes a frame |
| CROSS-01 incidental control crossings (orbits retired) | `web/microscope/crossings.ts` | `?cross=demo`, `?crossSeed=`, `__rbD0.forceCrossing()`, `__rbD0.crossLog()` |
| LIFE-01 bounded steering, push → coast, turn, pulse, independent appendages | `motion.ts` (`stepMover`), engine | `__rbD0.snapshot().modes`, `__rbD0.organisms()` |
| LIFE-02 pair encounter + lens-cued recoil | `motion.ts` (`EncounterDirector`, `triggerRecoil`), engine `drawLink` | `?encounter=1`, `__rbD0.triggerEncounter()`, `__rbD0.events()` |
| REVEAL-01 services after full glass removal | `HomeContent.tsx` (`.realm-runway`), `globals.css` | scroll; live-only runway collapses for static/reduced/no-JS |
| ROAM-MOBILE-01 navbar excursion on narrow layouts | `layout.ts` (`authoredRoamPoints` gutter route) | `?t=` sweeps |

`web/microscope/skimmers.ts` is now an empty, unused module (orbits retired); Codex may delete it.

## Native review deep links (scheme `rhythmbiome-d0`)

```bash
adb shell am start -a android.intent.action.VIEW -d "rhythmbiome-d0://?state=partialFailure"   # Home
adb shell am start -a android.intent.action.VIEW -d "rhythmbiome-d0://log?state=conflict"
adb shell am start -a android.intent.action.VIEW -d "rhythmbiome-d0://reports?state=syntheticLayout"
```

Each screen also shows a dashed **"D0 specimen state (synthetic)"** chip row for switching fixture states by hand.

## Design decisions to review

- **Plain WebGL2 instead of Three.js; no GSAP.** The scene is a fixed orthographic 2D field with a lens composite pass. Three.js would add a large dependency without using its 3D features, and the scroll value is one clamped number. Total scene code: `web/microscope/*` (≈17 KB minified in an esbuild harness; measure the real Next chunk). Easy to swap if the owner prefers Three.js.
- **Stable microbe scale by construction (LENS-02).** Organisms render in CSS-pixel orthographic space. Scroll changes only aperture radius/centre, outside blur/tint, sheen, refraction, rim and handle (`web/microscope/layout.ts`).
- **Native fonts:** static Hanken Grotesk instances (400/500/600/700) generated from the supplied variable TTF (`scripts/instance_hanken.py`), because Android cannot select weights from a variable font. Web uses the supplied variable file directly.

See `ASSETS.md` (provenance) and `CONTRACT_GAPS.md`.
