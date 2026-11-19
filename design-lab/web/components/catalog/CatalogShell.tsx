import type { ReactNode } from 'react';
import { AmbientAccents } from '../AmbientAccents';
import { SiteFooter } from '../SiteFooter';
import { SiteHeader } from '../SiteHeader';
import { CatalogProvider } from './CatalogContext';

/** Customer catalogue page: site header, quiet gutter microbes, footer. */
export function CatalogShell({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <div className="stub-shell">
        <AmbientAccents />
        <main id="main" tabIndex={-1} className="catalog-page">
          <CatalogProvider>{children}</CatalogProvider>
        </main>
      </div>
      <div className="lower">
        <SiteFooter />
      </div>
    </>
  );
}
