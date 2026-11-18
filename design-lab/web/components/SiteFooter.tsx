import Link from 'next/link';
import { Logo } from './Logo';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <Logo height={28} />
        <nav aria-label="Footer">
          <ul>
            <li>
              <Link href="/tests">Tests</Link>
            </li>
            <li>
              <Link href="/products">Products</Link>
            </li>
            <li>
              <Link href="/#faq">Support and FAQ</Link>
            </li>
            <li>
              <Link href="/sign-in">Sign in</Link>
            </li>
          </ul>
        </nav>
        <p className="specimen-note">
          D0 design specimen · synthetic content only · no ordering, accounts or health data.
        </p>
      </div>
    </footer>
  );
}
