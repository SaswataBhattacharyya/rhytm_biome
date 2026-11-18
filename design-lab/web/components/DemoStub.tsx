import Link from 'next/link';
import { AmbientAccents } from './AmbientAccents';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';

/**
 * Destination page for specimen links. Explains the demo limitation honestly
 * and preserves navigation intent. No scene code (WEB-ISO); only the
 * lightweight gutter accents (AMBIENT-01).
 */
export function DemoStub({
  eyebrow,
  title,
  body,
  intent,
}: {
  eyebrow: string;
  title: string;
  body: string;
  /** What happens in the real product after sign-in / integration. */
  intent: string;
}) {
  return (
    <>
      <SiteHeader />
      <div className="stub-shell">
        <AmbientAccents />
        <main id="main" tabIndex={-1} className="stub">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="lede">{body}</p>
          <div className="notice" role="note">
            <strong>Design specimen limitation.</strong> {intent}
          </div>
          <div className="hero-actions">
            <Link href="/" className="btn btn-primary">
              Back to the homepage
            </Link>
            <Link href="/#how-it-works" className="btn btn-secondary">
              How it works
            </Link>
          </div>
        </main>
      </div>
      <div className="lower">
        <SiteFooter />
      </div>
    </>
  );
}
