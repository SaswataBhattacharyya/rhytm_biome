'use client';

import { useEffect, useState } from 'react';
import { defaultSku, formatINR, productDetailSections, skuLabel, spokenINR, visibleSections } from '@rb-lab/shared';
import { BackLink, ListSkeleton, NotFound, PreviewLabel, PurchaseNote, ReadError } from './CatalogBits';
import { useCatalog, useCatalogRead } from './CatalogContext';
import { ProductGallery } from './ProductMedia';
import { ProductReviews } from '../trust/ProductReviews';

export function ProductDetail({ slug }: { slug: string }) {
  const { source, hidden, withReview } = useCatalog();
  const [state, retry] = useCatalogRead((s) => s.getProduct(slug), [slug]);
  const product = state.s === 'ok' ? state.data : null;
  const [skuId, setSkuId] = useState<string | null>(null);
  useEffect(() => {
    setSkuId(product ? defaultSku(product)?.id ?? null : null);
    if (product) document.title = `${product.title} — Rhythm Biome`;
  }, [product]);

  if (state.s === 'ok' && !product) return <NotFound what="product" href={withReview('/products')} back="See all products" />;
  const sku = product?.skus.find((s) => s.id === skuId) ?? null;
  return (
    <article className="catalog-detail" aria-busy={state.s === 'loading'}>
      <BackLink href={withReview('/products')}>All products</BackLink>
      {state.s === 'loading' ? <ListSkeleton rows={3} /> : null}
      {state.s === 'error' ? <ReadError message={state.message} onRetry={retry} what="this product" /> : null}
      {product ? (
        <div className="product-layout">
          <ProductGallery media={product.media} title={product.title} />
          <div className="product-info">
            <header className="detail-head">
              <p className="eyebrow">Product</p>
              <h1>{product.title}</h1>
              <PreviewLabel source={source} />
              <p className="detail-price" aria-live="polite" aria-label={sku?.available ? `Price ${spokenINR(sku.price_paise)} for ${skuLabel(sku)}` : 'Selected size unavailable'}>
                {sku?.available ? formatINR(sku.price_paise) : 'Unavailable'}
              </p>
            </header>
            {product.skus.length ? (
              <fieldset className="size-picker">
                <legend>Size</legend>
                {product.skus.map((s) => (
                  <label key={s.id} className="size-option" data-unavailable={!s.available || undefined}>
                    <input
                      type="radio"
                      name="sku"
                      value={s.id}
                      checked={s.id === skuId}
                      disabled={!s.available}
                      onChange={() => setSkuId(s.id)}
                      aria-describedby={!s.available ? `unavail-${s.id}` : undefined}
                    />
                    <span className="size-name">
                      {skuLabel(s)} <span className="size-format">{s.format}</span>
                    </span>
                    {s.available ? (
                      <span className="size-price">{formatINR(s.price_paise)}</span>
                    ) : (
                      <span className="size-unavailable" id={`unavail-${s.id}`}>
                        Unavailable
                      </span>
                    )}
                  </label>
                ))}
              </fieldset>
            ) : null}
            <PurchaseNote />
            {visibleSections(productDetailSections(product), hidden).map((sec) => (
              <section key={sec.id} className="detail-section" aria-labelledby={`sec-${sec.id}`} data-section={sec.key ?? sec.id}>
                <h2 id={`sec-${sec.id}`}>{sec.title}</h2>
                {sec.body ? <p>{sec.body}</p> : null}
              </section>
            ))}
          </div>
        </div>
      ) : null}
      {product ? <ProductReviews slug={product.slug} /> : null}
    </article>
  );
}
