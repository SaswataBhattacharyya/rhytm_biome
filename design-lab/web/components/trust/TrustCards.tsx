'use client';

/**
 * Card and full-view renderers for experts, testimonials and reviews.
 * Cards reserve the same media and text space within a group; excerpts are
 * line-clamped with a visible ellipsis and Read more sits on a shared
 * baseline at the card foot. Read more appears only when there is more to
 * read: additional copy in the fixture, or text the clamp is hiding (which
 * can change with viewport width and text size).
 */
import type { MouseEvent } from 'react';
import { MicrobeSvg } from '../MicrobeSvg';
import { usePrefs } from '../PrefsProvider';
import { SYNTHETIC_LABEL, type Expert, type PortraitPlaceholder, type Review, type Testimonial } from '../../lib/trust/fixtures';
import { useClamped } from './useTrust';

type Open = (e: MouseEvent<HTMLButtonElement>) => void;

export function Portrait({ p, label }: { p: PortraitPlaceholder; label: string }) {
  const { theme } = usePrefs();
  return (
    <span className="trust-portrait" role="img" aria-label={`${label}: illustrated placeholder, no photo`}>
      <svg viewBox="-40 -40 80 80" focusable="false" aria-hidden="true">
        <MicrobeSvg kind={p.kind} size={p.kind === 'chain' ? 7 : 15} color={p.color} theme={theme} shapeSeed={p.seed} rotate={p.seed * 23} />
      </svg>
    </span>
  );
}

function ReadMore({ onOpen, about }: { onOpen: Open; about: string }) {
  return (
    <button type="button" className="read-more" onClick={onOpen}>
      Read more<span className="sr-only"> {about}</span>
      <span aria-hidden="true"> →</span>
    </button>
  );
}

export function ExpertCard({ expert, onOpen, headingLevel = 3 }: { expert: Expert; onOpen: Open; headingLevel?: 2 | 3 }) {
  const [bioRef, clamped] = useClamped<HTMLParagraphElement>();
  const more = Boolean(expert.fullBio?.length || expert.perspective) || clamped;
  const H = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <article className="trust-card expert-card" aria-label={expert.name}>
      <div className="trust-card-media">
        <Portrait p={expert.portrait} label={expert.name} />
        <span className="synthetic-tag">{SYNTHETIC_LABEL}</span>
      </div>
      <H className="trust-name clamp-2">{expert.name}</H>
      <p className="trust-role clamp-2">{expert.role}</p>
      <p ref={bioRef} className="trust-excerpt clamp-3">
        {expert.bio}
      </p>
      <div className="trust-card-foot">{more ? <ReadMore onOpen={onOpen} about={`about ${expert.name}`} /> : null}</div>
    </article>
  );
}

export function ExpertFull({ expert }: { expert: Expert }) {
  return (
    <div className="trust-full">
      <div className="trust-full-id">
        <Portrait p={expert.portrait} label={expert.name} />
        <div>
          <p className="trust-role">{expert.role}</p>
          <p className="synthetic-tag">{SYNTHETIC_LABEL} · not a real person</p>
        </div>
      </div>
      <p>{expert.bio}</p>
      {expert.fullBio?.map((para) => <p key={para.slice(0, 24)}>{para}</p>)}
      {expert.perspective ? (
        <figure className="trust-perspective">
          <figcaption>Educational perspective (sample, not medical advice)</figcaption>
          <blockquote>
            <p>{expert.perspective}</p>
          </blockquote>
        </figure>
      ) : null}
      <p className="trust-focus">
        <span>Areas</span> {expert.focus.join(' · ')}
      </p>
    </div>
  );
}

export function TestimonialCard({ t, onOpen }: { t: Testimonial; onOpen: Open }) {
  const [quoteRef, clamped] = useClamped<HTMLParagraphElement>();
  const more = Boolean(t.full?.length) || clamped;
  return (
    <figure className="trust-card testimonial-card">
      <span className="testimonial-mark" aria-hidden="true">
        “
      </span>
      <blockquote>
        <p ref={quoteRef} className="trust-excerpt clamp-4">
          {t.excerpt}
        </p>
      </blockquote>
      <figcaption>
        <span className="trust-attrib clamp-1">{t.attribution}</span>
        <span className="trust-context clamp-1">{t.context}</span>
      </figcaption>
      <div className="trust-card-foot">{more ? <ReadMore onOpen={onOpen} about={`of the quote from ${t.attribution}, ${t.context}`} /> : null}</div>
    </figure>
  );
}

export function TestimonialFull({ t }: { t: Testimonial }) {
  return (
    <figure className="trust-full">
      <blockquote>{(t.full ?? [t.excerpt]).map((para) => <p key={para.slice(0, 24)}>{para}</p>)}</blockquote>
      <figcaption>
        <span className="trust-attrib">{t.attribution}</span> · <span className="trust-context">{t.context}</span>
      </figcaption>
      <p className="trust-disclaimer">A personal experience, not medical advice and not a typical result. Synthetic sample.</p>
    </figure>
  );
}

const STAR = 'M8 1.2l2.1 4.3 4.7.7-3.4 3.3.8 4.7L8 12l-4.2 2.2.8-4.7L1.2 6.2l4.7-.7z';

/** Decorative star row; the rating is always also given in text by the caller. */
export function Stars({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  const row = (cls: string) => (
    <span className={cls}>
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} viewBox="0 0 16 16" width="1em" height="1em" focusable="false">
          <path d={STAR} />
        </svg>
      ))}
    </span>
  );
  return (
    <span className="stars" aria-hidden="true">
      {row('stars-base')}
      <span className="stars-fill" style={{ width: `${pct}%` }}>
        {row('stars-on')}
      </span>
    </span>
  );
}

const fmtDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export function ReviewCard({ r, onOpen }: { r: Review; onOpen: Open }) {
  const [bodyRef, clamped] = useClamped<HTMLParagraphElement>();
  return (
    <article className="trust-card review-card" aria-label={`${r.title}, ${r.rating} out of 5`}>
      <p className="review-rating">
        <Stars value={r.rating} />
        <span>{r.rating} out of 5</span>
      </p>
      <h3 className="trust-name clamp-2">{r.title}</h3>
      <p ref={bodyRef} className="trust-excerpt clamp-3">
        {r.body}
      </p>
      <p className="trust-context clamp-1">
        {r.author} · <time dateTime={r.date}>{fmtDate(r.date)}</time>
      </p>
      <div className="trust-card-foot">{clamped ? <ReadMore onOpen={onOpen} about={`of the review “${r.title}”`} /> : null}</div>
    </article>
  );
}

export function ReviewFull({ r }: { r: Review }) {
  return (
    <div className="trust-full">
      <p className="review-rating">
        <Stars value={r.rating} />
        <span>{r.rating} out of 5</span>
      </p>
      <p>{r.body}</p>
      <p className="trust-context">
        {r.author} · <time dateTime={r.date}>{fmtDate(r.date)}</time> · {SYNTHETIC_LABEL}
      </p>
    </div>
  );
}
