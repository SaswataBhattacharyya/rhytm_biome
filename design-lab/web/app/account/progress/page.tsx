import { AccountPage } from '../../../components/AccountPage';
import { ProgressView } from '../../../components/ProgressView';

export const metadata = { title: 'Your progress — Rhythm Biome' };

export default function Page() {
  return (
    <AccountPage
      eyebrow="Your progress"
      title="Your progress"
      lede="How many days you checked in, for the dates you choose. Kept separate from lab measurements."
    >
      <ProgressView />
    </AccountPage>
  );
}
