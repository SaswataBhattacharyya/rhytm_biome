'use client';

import Link from 'next/link';
import { formatINR, fromPrice, spokenINR } from '@rb-lab/shared';
import { ListSkeleton, PreviewLabel, ReadError } from './CatalogBits';
import { useCatalog, useCatalogRead } from './CatalogContext';
import { CardMedia } from './ProductMedia';

export function ProductsList() {
  const { source, withReview } = useCatalog();
  const [state, retry] = useCatalogRead((s) => s.listProducts(), []);
  return (
    <section aria-labelledby="products-title" className="catalog-section">
      <p className="eyebrow">Products</p>
      <h1 id="products-title">Products</h1>
      <p className="lede">Accessories and supplies, separate from tests. Each has its own page with sizes and prices.</p>
      <PreviewLabel source={source} />
      <div aria-live="polite">
        {state.s === 'loading' ? <ListSkeleton rows={3} /> : null}
        {state.s === 'error' ? <ReadError message={state.message} onRetry={retry} what="products" /> : null}
        {state.s === 'ok' && state.data.length === 0 ? (
          <p className="catalog-empty-text" role="status">
            No products are published yet. Check back soon.
          </p>
        ) : null}
        {state.s === 'ok' && state.data.length ? (
          <ul className="product-grid" aria-label="Products">
            {state.data.map((p) => {
              const fp = fromPrice(p);
              return (
                <li key={p.id}>
                  <Link href={withReview(`/products/${encodeURIComponent(p.slug)}`)} className="product-card">
                    <CardMedia media={p.media} title={p.title} />
                    <span className="card-body">
                      <span className="row-title">{p.title}</span>
                      <span className="row-sub">
                        {p.skus.length} {p.skus.length === 1 ? 'size' : 'sizes'}
                        {p.skus.some((s) => !s.available) ? ' · some unavailable' : ''}
                      </span>
                      <span className="row-price" aria-label={fp ? `${fp.several ? 'From ' : ''}${spokenINR(fp.paise)}` : 'Unavailable'}>
                        {fp ? `${fp.several ? 'From ' : ''}${formatINR(fp.paise)}` : 'Unavailable'}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
      <p className="catalog-crosslink">
        Looking for a kit? <Link href={withReview('/tests')}>Browse tests</Link>
      </p>
    </section>
  );
}
