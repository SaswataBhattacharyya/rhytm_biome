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

## Relay 04 — fullscreen coverage, lower motion, compact Android Home

| ID | Where | Review hook |
|---|---|---|
| FIELD-RESIZE-01 field follows the viewport | `engine.ts` (`refit`, `sleep`, `wake`, `addOrganisms`); `MicroscopeStage.tsx` releases a crossing before resize | resize the window or toggle fullscreen; `__rbD0.snapshot().halves` / `.total` / `.capacity`, `__rbD0.resizeEvents()` |
| AMBIENT-LOWER-01 sparse motion below the services | `web/components/LowerAmbient.tsx` (`DriftLane`), `.drift*` in `globals.css` | scroll past the service cards; Pause / reduced motion |
| NATIVE-HOME-01 compact Home + Explore library + reviewer mode | `mobile/app/(tabs)/index.tsx`, `explore.tsx`, `settings.tsx`, `src/components/ui.tsx` (`ListRow`, gated `StateSwitcher`), `ThemeProvider.tsx` (`reviewer`) | Profile → Reviewer tools, or `rhythmbiome-d0://?reviewer=1` |
| NATIVE-SHEET-01 sheet focus lifecycle + status-bar scrim | `mobile/src/components/knowledge.tsx` (`focusLater`, `onShow`), `ui.tsx` (`Screen` scrim) | open a card, Back, rapid open/close with TalkBack |

## Relay 07 — catalogue (Tests and Products)

| Area | Where |
|---|---|
| Shared read model, source interface, fixture scenarios, connected adapter, section visibility, INR formatting, detail order | `shared/src/catalog/*` (reads the Codex-owned `shared/src/catalog-fixture.json`) |
| Web lists and details | `web/app/tests`, `web/app/tests/[id]`, `web/app/products`, `web/app/products/[slug]`; `web/components/catalog/*` |
| Web hover preview + manual gallery | `web/components/catalog/ProductMedia.tsx` |
| Android Explore (Learn · Tests · Products) and details | `mobile/app/(tabs)/explore.tsx`, `mobile/app/catalog/test/[id].tsx`, `mobile/app/catalog/product/[slug].tsx`, `mobile/src/components/catalog.tsx`, `mobile/src/data/CatalogProvider.tsx` |
| Original synthetic preview images | `web/public/catalog-preview/*.png`, `mobile/assets/catalog-preview/*.png` |

The fixture is the default source. Connect the API with `NEXT_PUBLIC_RB_CATALOG_SOURCE=api` (web) or `EXPO_PUBLIC_RB_CATALOG_SOURCE=api` (Android) plus the API base.

Review controls (not linked from navigation):

- Web: `?catalog=sample|gallery|empty|slow|error|flaky` and `?hide=test.description,product.description` on any catalogue URL; the params carry over between catalogue pages.
- Android: Profile and display → Reviewer tools → Reviewer mode → catalogue fixture scenario and "Hide …" switches.

Section keys: `test.description` (Test detail · description), `product.description` (Product detail · description). Defaults live in `shared/src/catalog/visibility.ts`.

## Relay 05 — synthetic sign-in, Android check-in, web Progress (M2)

| Area | Where |
|---|---|
| Shared pilot client (contract types, HTTP + fixture adapters, session, per-account outbox) | `shared/src/daily/*` |
| Web session (memory only), sign-in, Progress | `web/components/DailySession.tsx`, `SignInForm.tsx`, `ProgressView.tsx`, `AccountPage.tsx`; `web/app/sign-in`, `web/app/account/progress` |
| Android secure-storage port, provider, sign-in, connected Log, account card | `mobile/src/data/secureStore.ts`, `DailyProvider.tsx`; `mobile/app/sign-in.tsx`; `mobile/src/components/DailyCheckIn.tsx`; `mobile/app/settings.tsx` |
| Specimen Log states (moved, still reachable) | `mobile/src/components/SpecimenLog.tsx`, `/log?state=…`, `/log-specimen` (reviewer) |

Connected mode needs both base URLs; otherwise every client runs the in-memory **fixture preview** (badged in the UI; accounts `ada.fixture@example.test` / `ben.fixture@example.test`, public placeholder password `fixture-preview`).

```bash
# web (.env.local in design-lab/web — Codex-owned config)
NEXT_PUBLIC_RB_API_BASE=http://127.0.0.1:3211
NEXT_PUBLIC_RB_AUTH_BASE=http://127.0.0.1:55433
# Android (Expo) + loopback forwarding
EXPO_PUBLIC_RB_API_BASE=http://127.0.0.1:3211
EXPO_PUBLIC_RB_AUTH_BASE=http://127.0.0.1:55433
adb reverse tcp:3211 tcp:3211 && adb reverse tcp:55433 tcp:55433
```

`?backend=fixture` on the web forces the fixture. In fixture mode `window.__rbFixture` exposes the preview backend (seed logs, simulate offline/expiry) for review.

## Native review deep links (scheme `rhythmbiome-d0`)

```bash
adb shell am start -a android.intent.action.VIEW -d "rhythmbiome-d0://?state=partialFailure"   # Home
adb shell am start -a android.intent.action.VIEW -d "rhythmbiome-d0://log?state=conflict"
adb shell am start -a android.intent.action.VIEW -d "rhythmbiome-d0://reports?state=syntheticLayout"
```

In **reviewer mode** (off by default) Home, Log and Reports show a dashed **"Reviewer mode · synthetic state"** chip row, and Explore shows the empty-card check. Turn it on in Profile and display → Reviewer tools, or:

```bash
adb shell am start -a android.intent.action.VIEW -d "rhythmbiome-d0://?reviewer=1"   # ?reviewer=0 turns it off
```

`?state=` deep links keep working without reviewer mode.

## Design decisions to review

- **Plain WebGL2 instead of Three.js; no GSAP.** The scene is a fixed orthographic 2D field with a lens composite pass. Three.js would add a large dependency without using its 3D features, and the scroll value is one clamped number. Total scene code: `web/microscope/*` (≈17 KB minified in an esbuild harness; measure the real Next chunk). Easy to swap if the owner prefers Three.js.
- **Stable microbe scale by construction (LENS-02).** Organisms render in CSS-pixel orthographic space. Scroll changes only aperture radius/centre, outside blur/tint, sheen, refraction, rim and handle (`web/microscope/layout.ts`).
- **Native fonts:** static Hanken Grotesk instances (400/500/600/700) generated from the supplied variable TTF (`scripts/instance_hanken.py`), because Android cannot select weights from a variable font. Web uses the supplied variable file directly.

See `ASSETS.md` (provenance) and `CONTRACT_GAPS.md`.


## Relay 07 catalogue walkthrough

Run the [API migration and seed](../apps/api/README.md#synthetic-catalogue), then start the two clients with the existing local Auth/API base settings. Add `NEXT_PUBLIC_RB_CATALOG_SOURCE=api` before the web build and `EXPO_PUBLIC_RB_CATALOG_SOURCE=api` before starting Metro. The sample catalogue can be browsed without an account. Visit [Tests](http://localhost:3210/tests), [Products](http://localhost:3210/products) or Android **Explore**. Use the [connected walkthrough](../relay/07_CODEX_REVIEW.md#owner-review) to review the synthetic gallery and detail screens.
