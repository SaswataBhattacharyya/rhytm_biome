# Rhythm Biome

Rhythm Biome’s website, Android app and shared API pilot. The pilot uses synthetic data.

## Run locally

```sh
cd design-lab
npm ci
npm run web:dev
```

Open http://localhost:3210. For Android, start a compatible Android emulator with Expo Go for SDK 54, then run `npm run mobile:start` from `design-lab` and press **a** in the Expo terminal. Metro uses port 8090.

Run `npm run typecheck`, `npm run lint`, and `npm run web:build` to check the specimen. See [the design lab](design-lab/README.md) for review controls and [asset provenance](design-lab/ASSETS.md) for bundled artwork and fonts.

## Progress

- The website has the interactive microscope, illustrated knowledge cards, and Tests and Products catalogues with individual detail pages.
- Android has a compact Home, catalogue browsing and daily check-ins with offline retry and conflict resolution. Web Progress shows check-ins saved through the same synthetic account.
- The shared API supports synthetic sign-in, daily check-ins, progress and published catalogue reads. The [API guide](apps/api/README.md) covers local setup, migrations and catalogue seeding.
- The next slice adds test-kit images on catalogue cards and detail pages, plus Add to cart on web and Android as part of sandbox checkout.
