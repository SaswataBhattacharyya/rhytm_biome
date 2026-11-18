import { DemoStub } from '../../components/DemoStub';

export const metadata = { title: 'Book a kit — Rhythm Biome D0 specimen' };

export default function Page() {
  return (
    <DemoStub
      eyebrow="Tests"
      title="Book a kit"
      body="Gut, skin and vaginal microbiome kits will be listed here with what each test measures."
      intent="The catalogue, prices and checkout belong to the commerce slice (B2) and use the shared API. Nothing can be ordered from this specimen."
    />
  );
}
