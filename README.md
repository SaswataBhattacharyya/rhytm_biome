# Rhythm Biome

A runnable design specimen for the website and Android app. It includes the interactive microscope, themed service navigation, illustrated knowledge cards, and synthetic Home, Log, Reports and Progress screens.

## Run locally

```sh
cd design-lab
npm ci
npm run web:dev
```

Open http://localhost:3210. For Android, start a compatible Android emulator with Expo Go for SDK 54, then run `npm run mobile:start` from `design-lab` and press **a** in the Expo terminal. Metro uses port 8090.

Run `npm run typecheck`, `npm run lint`, and `npm run web:build` to check the specimen. See [the design lab](design-lab/README.md) for review controls and [asset provenance](design-lab/ASSETS.md) for bundled artwork and fonts.

## Progress

The Relay 03 motion pass adds anchored body deformation, occasional microbe crossings near buttons, and a rare paired-motion vignette. The website build passes type checks, lint and production compilation. The Android specimen has been smoke-tested with Expo Go.

The next milestone is owner review of the design. The first functional slice will connect synthetic authenticated accounts to consent and shared daily logging. The current specimen uses fixtures and has no live account, payment, clinical report or persistence integrations.
