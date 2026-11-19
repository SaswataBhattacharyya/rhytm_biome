import Link from 'next/link';
import { AccountPage } from '../../../components/AccountPage';

export const metadata = { title: 'Daily log — Rhythm Biome D0 specimen' };

export default function Page() {
  return (
    <AccountPage
      eyebrow="Check-ins"
      title="Daily log"
      lede="Record your mood in the Rhythm Biome Android app under Home → Check in or in the Log tab. Use the same account to see your saved check-ins in web Progress."
    >
      <div className="hero-actions">
        <Link href="/account/progress" className="btn btn-primary">
          View your progress
        </Link>
      </div>
    </AccountPage>
  );
}
