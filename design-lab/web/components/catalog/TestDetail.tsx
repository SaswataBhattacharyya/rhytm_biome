'use client';

import { useEffect } from 'react';
import { DOMAIN_LABEL, formatINR, spokenINR, testDetailSections, visibleSections } from '@rb-lab/shared';
import { BackLink, ListSkeleton, NotFound, PreviewLabel, PurchaseNote, ReadError } from './CatalogBits';
import { useCatalog, useCatalogRead } from './CatalogContext';

export function TestDetail({ id }: { id: string }) {
  const { source, hidden, withReview } = useCatalog();
  const [state, retry] = useCatalogRead((s) => s.getTest(id), [id]);
  const test = state.s === 'ok' ? state.data : null;
  useEffect(() => {
    if (test) document.title = `${test.title} — Rhythm Biome`;
  }, [test]);

  if (state.s === 'ok' && !test) return <NotFound what="test" href={withReview('/tests')} back="See all tests" />;
  return (
    <article className="catalog-detail" aria-busy={state.s === 'loading'}>
      <BackLink href={withReview('/tests')}>All tests</BackLink>
      {state.s === 'loading' ? <ListSkeleton rows={3} /> : null}
      {state.s === 'error' ? <ReadError message={state.message} onRetry={retry} what="this test" /> : null}
      {test ? (
        <>
          <header className="detail-head">
            <p className="eyebrow">{DOMAIN_LABEL[test.domain] ?? test.domain} test</p>
            <h1>{test.title}</h1>
            <PreviewLabel source={source} />
            <p className="detail-price" aria-label={`Price ${spokenINR(test.price_paise)}`}>
              {formatINR(test.price_paise)}
            </p>
            <p className="detail-fact">
              <span>Specimen</span> {test.specimen_type}
            </p>
            <PurchaseNote />
          </header>
          {visibleSections(testDetailSections(test), hidden).map((sec) => (
            <section key={sec.id} className="detail-section" aria-labelledby={`sec-${sec.id}`} data-section={sec.key ?? sec.id}>
              <h2 id={`sec-${sec.id}`}>{sec.title}</h2>
              {sec.body ? <p>{sec.body}</p> : null}
              {sec.facts ? (
                <dl className="detail-facts">
                  {sec.facts.map((f) => (
                    <div key={f.label}>
                      <dt>{f.label}</dt>
                      <dd>{f.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </section>
          ))}
        </>
      ) : null}
    </article>
  );
}
