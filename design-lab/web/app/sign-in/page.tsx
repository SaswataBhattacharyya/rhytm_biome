import { AccountPage } from '../../components/AccountPage';
import { SignInForm } from '../../components/SignInForm';

export const metadata = { title: 'Sign in — Rhythm Biome' };

export default function Page() {
  return (
    <AccountPage eyebrow="Account" title="Sign in" lede="Sign in with a synthetic pilot account to see your check-in progress.">
      <SignInForm />
    </AccountPage>
  );
}
