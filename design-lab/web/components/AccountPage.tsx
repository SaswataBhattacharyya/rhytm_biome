import type { ReactNode } from 'react';
import { AmbientAccents } from './AmbientAccents';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';

/** Shell for signed-in pages: same header, gutter accents and footer as the stubs. */
export function AccountPage({ eyebrow, title, lede, children }: { eyebrow: string; title: string; lede: string; children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <div className="stub-shell">
        <AmbientAccents />
        <main id="main" tabIndex={-1} className="stub account-page">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="lede">{lede}</p>
          {children}
        </main>
      </div>
      <div className="lower">
        <SiteFooter />
      </div>
    </>
  );
}
