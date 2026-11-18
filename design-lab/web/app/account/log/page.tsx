import { DemoStub } from '../../../components/DemoStub';

export const metadata = { title: 'Daily log — Rhythm Biome D0 specimen' };

export default function Page() {
  return (
    <DemoStub
      eyebrow="Daily log"
      title="Daily log"
      body="A quick check-in for mood, routine and symptoms. Days you skip stay visibly missing, never counted as zero."
      intent="This would ask you to sign in and then resume your log. The native Log specimen demonstrates the entry states."
    />
  );
}
