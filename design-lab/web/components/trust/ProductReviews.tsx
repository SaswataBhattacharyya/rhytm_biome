'use client';

/**
 * Read-only Ratings and reviews on product detail (Relay 08, plan 36,
 * key `product.ratings_reviews`). With reviews: a labelled sample average
 * (stars + text) and count, short previews and a full reading view. With
 * none: a designed empty state and no aggregate at all.
 *
 * Reviews come from a web-local synthetic fixture keyed by product slug, so
 * the section renders the same over the fixture and connected catalogues.
 * Real averages and counts must come from the server (contract gap).
 */
import { reviewsFor, summarize, SYNTHETIC_LABEL, type Review } from '../../lib/trust/fixtures';
import { MicrobeSvg } from '../MicrobeSvg';
import { usePrefs } from '../PrefsProvider';
import { ReadMoreDialog } from './ReadMoreDialog';
import { ReviewCard, ReviewFull, Stars } from './TrustCards';
import { useReadMore, useReveal, useTrustVisibility } from './useTrust';

const PREVIEW_COUNT = 3;
type Item = { kind: 'one'; review: Review } | { kind: 'all' };

export function ProductReviews({ slug }: { slug: string }) {
  const { visible } = useTrustVisibility();
  if (!visible('product.ratings_reviews')) return null;
  return <ReviewsSection slug={slug} />;
}

function ReviewsSection({ slug }: { slug: string }) {
  const ref = useReveal<HTMLElement>();
  const reviews = reviewsFor(slug);
  const summary = summarize(reviews);
  const { item, open, close } = useReadMore<Item>();
  const label = summary ? `Sample rating ${summary.average.toFixed(1)} out of 5 from ${summary.count} sample reviews` : '';

  return (
    <section ref={ref} className="reviews trust-section" data-section="product.ratings_reviews" aria-labelledby="reviews-title">
      <div className="reviews-head">
        <h2 id="reviews-title">Ratings and reviews</h2>
        <span className="synthetic-tag">{SYNTHETIC_LABEL}</span>
      </div>
      {summary ? (
        <>
          <div className="reviews-summary" role="group" aria-label={label}>
            <p className="reviews-avg">
              <span className="reviews-avg-num">{summary.average.toFixed(1)}</span>
              <span className="reviews-avg-of"> out of 5</span>
            </p>
            <div className="reviews-avg-meta">
              <Stars value={summary.average} />
              <p className="reviews-count">
                {summary.count} sample {summary.count === 1 ? 'review' : 'reviews'}
              </p>
            </div>
          </div>
          <p className="reviews-note">Sample average computed from the synthetic reviews below; not a real rating.</p>
          <ul className="reviews-grid" aria-label="Review previews">
            {reviews.slice(0, PREVIEW_COUNT).map((r, i) => (
              <li key={r.id} className="trust-item" style={{ ['--i' as string]: i }}>
                <ReviewCard r={r} onOpen={(ev) => open({ kind: 'one', review: r }, ev.currentTarget)} />
              </li>
            ))}
          </ul>
          {reviews.length > PREVIEW_COUNT ? (
            <button type="button" className="btn btn-secondary reviews-all" onClick={(ev) => open({ kind: 'all' }, ev.currentTarget)}>
              Read all {reviews.length} sample reviews
            </button>
          ) : null}
          <ReadMoreDialog
            open={item !== null}
            onClose={close}
            kicker={item?.kind === 'all' ? `${label}` : 'Review · synthetic sample'}
            title={item?.kind === 'one' ? item.review.title : 'All sample reviews'}
          >
            {item?.kind === 'one' ? <ReviewFull r={item.review} /> : null}
            {item?.kind === 'all' ? (
              <ol className="reviews-all-list">
                {reviews.map((r) => (
                  <li key={r.id}>
                    <h3>{r.title}</h3>
                    <ReviewFull r={r} />
                  </li>
                ))}
              </ol>
            ) : null}
          </ReadMoreDialog>
        </>
      ) : (
        <EmptyReviews />
      )}
    </section>
  );
}

function EmptyReviews() {
  const { theme } = usePrefs();
  return (
    <div className="reviews-empty" role="status">
      <svg className="reviews-empty-art" viewBox="-40 -40 80 80" aria-hidden="true" focusable="false">
        <circle r="34" className="reviews-empty-disc" />
        <MicrobeSvg kind="flagellate" size={13} color="#9CB98A" theme={theme} shapeSeed={58} rotate={-20} />
      </svg>
      <div>
        <p className="reviews-empty-title">No reviews yet</p>
        <p className="reviews-empty-body">Reviews will appear here once customers who bought this item share them. There is no rating to show until then.</p>
      </div>
    </div>
  );
}
