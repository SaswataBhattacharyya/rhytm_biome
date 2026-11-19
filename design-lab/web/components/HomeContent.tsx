/**
 * Public homepage specimen (brief 29 "Public homepage composition").
 * Copy is illustrative and pending brand/scientific review: no outcomes,
 * testimonials, statistics or prices.
 */
import Link from 'next/link';
import { COMPOSITE_OFF_AT, TRANSITION_VIEWPORTS } from '../microscope/layout';
import { KnowledgeProvider } from './KnowledgeProvider';
import { DriftLane } from './LowerAmbient';
import { MeetMicrobes } from './MeetMicrobes';
import { MicroscopeStage } from './MicroscopeStage';
import { PanelArt } from './PanelArt';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';

const PANELS = [
  {
    href: '/tests',
    art: 'kit' as const,
    title: 'Book a kit',
    body: 'Compare gut, skin and vaginal microbiome tests and choose one that fits your question.',
    accent: 'var(--accent-gut)',
  },
  {
    href: '/account/reports',
    art: 'reports' as const,
    title: 'Your reports',
    body: 'Sign in to read reviewed reports, including method and limitations.',
    accent: 'var(--accent-skin)',
  },
  {
    href: '/account/log',
    art: 'log' as const,
    title: 'Daily log',
    body: 'Check in on Android and see your saved days in web Progress.',
    accent: 'var(--accent-vaginal)',
  },
  {
    href: '/account/progress',
    art: 'progress' as const,
    title: 'Your progress',
    body: 'See your own check-ins over time, kept separate from lab measurements.',
    accent: 'var(--accent-progress)',
  },
];

/**
 * REVEAL-01: in the live scene, services start entering only after the glass
 * has been fully removed (composite off at p = COMPOSITE_OFF_AT). The runway is
 * ordinary page flow (no pinning) and collapses to zero for reduced motion,
 * no-WebGL and no-JS, so service links are immediately reachable there.
 * Large-viewport units keep the guarantee when mobile browser bars collapse.
 */
const RUNWAY = `calc(${((1 + COMPOSITE_OFF_AT * TRANSITION_VIEWPORTS + 0.03) * 100).toFixed(1)}lvh - 100svh)`;

const STEPS = [
  { title: 'Choose a kit', body: 'Pick the test that matches your question.' },
  { title: 'Answer a few questions', body: 'Required information helps the lab interpret your sample.' },
  { title: 'Collect and return', body: 'Follow the approved instructions included with your kit.' },
  { title: 'Read a reviewed report', body: 'Results are released only after review.' },
];

const FAQ = [
  {
    q: 'What is a microbiome test?',
    a: 'Illustrative answer pending scientific review. The final copy will explain what is measured and what is not.',
  },
  {
    q: 'Is the daily log the same as a lab result?',
    a: 'No. Your check-ins are self-reported and always shown separately from lab measurements.',
  },
  {
    q: 'Who can see my report?',
    a: 'Illustrative answer pending privacy review. Reports are private to your account.',
  },
];

export function HomeContent() {
  return (
    <KnowledgeProvider>
      <SiteHeader />
      <div id="scene-zone" className="scene-zone">
        <MicroscopeStage />
        <main id="main" tabIndex={-1}>
          <section className="hero" aria-labelledby="hero-title">
            <div className="hero-copy">
              <p className="eyebrow">Microbiome testing</p>
              <h1 id="hero-title">See the life you live with.</h1>
              <p className="lede">
                Rhythm Biome kits and daily check-ins help you understand your microbiome over time.
              </p>
              <div className="hero-actions">
                <Link href="/tests" className="btn btn-primary btn-large">
                  Book a kit
                </Link>
                <Link href="/#how-it-works" className="btn btn-secondary btn-large">
                  How it works
                </Link>
              </div>
              <p className="hero-meet">
                <a href="#meet-microbes">Meet the microbes</a> drifting in the lens — select one to open its card.
              </p>
            </div>
            <div className="lens-anchor" data-lens-anchor aria-hidden="true" />
          </section>

          <div className="realm-runway" aria-hidden="true" style={{ ['--realm-runway' as string]: RUNWAY }} />

          <section className="services" aria-labelledby="services-title">
            <div className="services-head">
              <h2 id="services-title">Start where you are</h2>
            </div>
            <ul className="panel-grid">
              {PANELS.map((p, i) => (
                <li key={p.href} className="panel-float" style={{ ['--float-delay' as string]: `${-i * 1.7}s` }}>
                  <Link href={p.href} className="panel" style={{ ['--panel-accent' as string]: p.accent }}>
                    <PanelArt kind={p.art} />
                    <span className="panel-text">
                      <span className="panel-title">{p.title}</span>
                      <span className="panel-body">{p.body}</span>
                    </span>
                    <span className="panel-arrow" aria-hidden="true">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </main>
      </div>

      <div className="lower">
        <DriftLane index={0} />
        <MeetMicrobes />
        <DriftLane index={1} />
        <section id="how-it-works" className="lower-section" aria-labelledby="how-title">
          <h2 id="how-title">How testing works</h2>
          <ol className="steps">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <span className="step-num" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="step-title">{s.title}</span>
                <span className="step-body">{s.body}</span>
              </li>
            ))}
          </ol>
          <p className="fineprint">Statuses in the product follow the lab protocol, not this illustration.</p>
        </section>

        <DriftLane index={2} />
        <section className="lower-section" aria-labelledby="discover-title">
          <h2 id="discover-title">Three areas at launch</h2>
          <ul className="category-row">
            <li className="category" data-cat="gut">
              <span className="category-swatch" aria-hidden="true" />
              Gut
            </li>
            <li className="category" data-cat="skin">
              <span className="category-swatch" aria-hidden="true" />
              Skin
            </li>
            <li className="category" data-cat="vaginal">
              <span className="category-swatch" aria-hidden="true" />
              Vaginal
            </li>
          </ul>
          <p className="fineprint">Catalogue details arrive with the commerce slice. No prices are shown in this specimen.</p>
        </section>

        <DriftLane index={3} />
        <section id="faq" className="lower-section" aria-labelledby="faq-title">
          <h2 id="faq-title">Science and FAQ</h2>
          <div className="faq">
            {FAQ.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>
        <DriftLane index={4} />
        <SiteFooter />
      </div>
    </KnowledgeProvider>
  );
}
