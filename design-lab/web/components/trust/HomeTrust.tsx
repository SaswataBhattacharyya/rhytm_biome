'use client';

/**
 * Homepage trust sections (Relay 08, plan 36): Experts preview and
 * Testimonials, each independently hideable. A hidden section is not
 * mounted, so it leaves no heading, link or gap. The Experts directory link
 * depends separately on `experts.directory`.
 *
 * Expert commentary and customer testimony are separate sections with
 * separate labels; neither carries clinical claims.
 */
import Link from 'next/link';
import { EXPERTS, TESTIMONIALS, type Expert, type Testimonial } from '../../lib/trust/fixtures';
import { CardRail } from './CardRail';
import { ReadMoreDialog } from './ReadMoreDialog';
import { ExpertCard, ExpertFull, TestimonialCard, TestimonialFull } from './TrustCards';
import { useReadMore, useReveal, useTrustVisibility } from './useTrust';

export function HomeTrust() {
  const { visible, withReview } = useTrustVisibility();
  return (
    <>
      {visible('home.experts') ? <ExpertsPreview directory={visible('experts.directory')} withReview={withReview} /> : null}
      {visible('home.testimonials') ? <Testimonials /> : null}
    </>
  );
}

function ExpertsPreview({ directory, withReview }: { directory: boolean; withReview: (h: string) => string }) {
  const ref = useReveal<HTMLElement>();
  const { item, open, close } = useReadMore<Expert>();
  return (
    <section ref={ref} id="experts" className="lower-section trust-section" data-section="home.experts" aria-labelledby="experts-title">
      <div className="trust-head">
        <div>
          <h2 id="experts-title">Experts behind the method</h2>
          <p className="trust-sub">Sample profiles for layout review. Published profiles will show approved credentials.</p>
        </div>
        {directory ? (
          <Link href={withReview('/experts')} className="btn btn-secondary trust-all">
            Meet all experts <span aria-hidden="true">→</span>
          </Link>
        ) : null}
      </div>
      <CardRail label="Experts" noun="experts" count={EXPERTS.length}>
        {EXPERTS.map((e, i) => (
          <li key={e.slug} className="trust-item" style={{ ['--i' as string]: i }}>
            <ExpertCard expert={e} onOpen={(ev) => open(e, ev.currentTarget)} />
          </li>
        ))}
      </CardRail>
      <ReadMoreDialog open={item !== null} onClose={close} kicker="Expert · synthetic sample" title={item?.name ?? ''}>
        {item ? (
          <>
            <ExpertFull expert={item} />
            {directory ? (
              <p className="trust-dialog-link">
                <Link href={withReview(`/experts#${item.slug}`)}>Open in the Experts directory</Link>
              </p>
            ) : null}
          </>
        ) : null}
      </ReadMoreDialog>
    </section>
  );
}

function Testimonials() {
  const ref = useReveal<HTMLElement>();
  const { item, open, close } = useReadMore<Testimonial>();
  return (
    <section ref={ref} id="testimonials" className="lower-section trust-section" data-section="home.testimonials" aria-labelledby="testimonials-title">
      <div className="trust-head">
        <div>
          <h2 id="testimonials-title">In customers’ words</h2>
          <p className="trust-sub">Synthetic quotes for layout review. Personal experiences, not medical advice or typical results.</p>
        </div>
      </div>
      <CardRail label="Customer quotes" noun="quotes" count={TESTIMONIALS.length}>
        {TESTIMONIALS.map((t, i) => (
          <li key={t.id} className="trust-item" style={{ ['--i' as string]: i }}>
            <TestimonialCard t={t} onOpen={(ev) => open(t, ev.currentTarget)} />
          </li>
        ))}
      </CardRail>
      <ReadMoreDialog open={item !== null} onClose={close} kicker="Customer quote · synthetic sample" title={item ? item.context.replace(' · synthetic quote', '') : ''}>
        {item ? <TestimonialFull t={item} /> : null}
      </ReadMoreDialog>
    </section>
  );
}
