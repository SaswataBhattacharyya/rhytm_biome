'use client';

/**
 * /experts — original directory of synthetic expert profiles (Relay 08).
 * Every card is a stable anchor (/experts#<slug>); Read more opens the full
 * profile in a dialog that returns focus and scroll. Rows share one height
 * at each breakpoint and reflow to fewer columns at larger text sizes.
 */
import Link from 'next/link';
import { useEffect } from 'react';
import { EXPERTS, type Expert } from '../../lib/trust/fixtures';
import { ReadMoreDialog } from './ReadMoreDialog';
import { ExpertCard, ExpertFull } from './TrustCards';
import { useReadMore, useTrustVisibility } from './useTrust';

export function ExpertsDirectory() {
  const { visible, withReview } = useTrustVisibility();
  const { item, open, close } = useReadMore<Expert>();
  const on = visible('experts.directory');

  useEffect(() => {
    if (!on) return;
    document.title = 'Experts — Rhythm Biome';
    const target = window.location.hash.slice(1);
    if (target) document.getElementById(target)?.scrollIntoView({ block: 'center' });
  }, [on]);

  if (!on) {
    return (
      <div className="catalog-empty" role="status">
        <h1>The Experts directory isn’t available</h1>
        <p className="lede">This section is switched off for this preview.</p>
        <Link href="/" className="btn btn-primary">
          Back to home
        </Link>
      </div>
    );
  }
  return (
    <article className="experts-page">
      <header className="experts-head">
        <p className="eyebrow">Experts</p>
        <h1>The people behind the method</h1>
        <p className="lede">Who explains, reviews and checks what you read. Profiles here are synthetic samples for layout review.</p>
        <p className="preview-label">
          <span>Synthetic preview · no real people or credentials</span>
        </p>
      </header>
      <ul className="experts-grid" aria-label="Experts">
        {EXPERTS.map((e) => (
          <li key={e.slug} id={e.slug} className="trust-item">
            <ExpertCard expert={e} headingLevel={2} onOpen={(ev) => open(e, ev.currentTarget)} />
          </li>
        ))}
      </ul>
      <p className="fineprint">
        Expert profiles describe roles and educational perspectives. They are not customer testimony and make no clinical claims.{' '}
        <Link href={withReview('/')}>Back to home</Link>
      </p>
      <ReadMoreDialog open={item !== null} onClose={close} kicker="Expert · synthetic sample" title={item?.name ?? ''}>
        {item ? <ExpertFull expert={item} /> : null}
      </ReadMoreDialog>
    </article>
  );
}
