'use client';

import Link from 'next/link';
import { DOMAIN_LABEL, formatINR, spokenINR } from '@rb-lab/shared';
import { ListSkeleton, PreviewLabel, ReadError } from './CatalogBits';
import { useCatalog, useCatalogRead } from './CatalogContext';

export function TestsList() {
  const { source, withReview } = useCatalog();
  const [state, retry] = useCatalogRead((s) => s.listTests(), []);
  return (
    <section aria-labelledby="tests-title" className="catalog-section">
      <p className="eyebrow">Tests</p>
      <h1 id="tests-title">Microbiome tests</h1>
      <p className="lede">Each kit has its own page with what it tests and who it suits.</p>
      <PreviewLabel source={source} />
      <div aria-live="polite">
        {state.s === 'loading' ? <ListSkeleton /> : null}
        {state.s === 'error' ? <ReadError message={state.message} onRetry={retry} what="tests" /> : null}
        {state.s === 'ok' && state.data.length === 0 ? (
          <p className="catalog-empty-text" role="status">
            No tests are published yet. Check back soon.
          </p>
        ) : null}
        {state.s === 'ok' && state.data.length ? (
          <ul className="catalog-rows" aria-label="Tests">
            {state.data.map((t) => (
              <li key={t.id}>
                <Link href={withReview(`/tests/${encodeURIComponent(t.id)}`)} className="catalog-row">
                  <span className="row-main">
                    <span className="row-title">{t.title}</span>
                    <span className="row-sub">
                      {DOMAIN_LABEL[t.domain] ?? t.domain} · {t.specimen_type} sample
                    </span>
                  </span>
                  <span className="row-price" aria-label={spokenINR(t.price_paise)}>
                    {formatINR(t.price_paise)}
                  </span>
                  <span className="row-chevron" aria-hidden="true">
                    ›
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <p className="catalog-crosslink">
        Looking for accessories? <Link href={withReview('/products')}>Browse products</Link>
      </p>
    </section>
  );
}
