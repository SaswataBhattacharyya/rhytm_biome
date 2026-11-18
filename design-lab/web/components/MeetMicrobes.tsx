'use client';

/**
 * "Meet the microbes" — the semantic, keyboard, screen-reader, reduced-motion
 * and non-WebGL equivalent of selecting microbes in the scene (34 LEARN-01/02).
 * A bounded list of unique cards, one tab stop each.
 */
import { useCallback, useEffect, useState } from 'react';
import { DEMO_MISSING_KEY, getDemoKnowledgeTransport, type DemoKnowledgeRecord } from '@rb-lab/shared';
import { KnowledgeArt } from './KnowledgeArt';
import { MEET_HEADING_ID, useKnowledge } from './KnowledgeProvider';
import { usePrefs } from './PrefsProvider';

type ListState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; items: DemoKnowledgeRecord[] };

export function MeetMicrobes() {
  const { open, transport } = useKnowledge();
  const { theme } = usePrefs();
  const [state, setState] = useState<ListState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const ac = new AbortController();
    setState({ status: 'loading' });
    transport
      .list({ locale: 'en', limit: 20 }, ac.signal)
      .then((page) => {
        if (!ac.signal.aborted) setState({ status: 'ready', items: page.items });
      })
      .catch((err: unknown) => {
        if (ac.signal.aborted) return;
        setState({ status: 'error', message: err instanceof Error ? err.message : 'Something went wrong.' });
      });
    return () => ac.abort();
  }, [transport, attempt]);

  const simulateError = useCallback(() => {
    getDemoKnowledgeTransport().setFailMode('errorOnce');
  }, []);

  const microbes = state.status === 'ready' ? state.items.filter((r) => r.content.kind === 'microbe_explainer') : [];
  const notes = state.status === 'ready' ? state.items.filter((r) => r.content.kind === 'knowledge_note') : [];

  return (
    <section id="meet-microbes" className="lower-section meet" aria-labelledby={MEET_HEADING_ID}>
      <h2 id={MEET_HEADING_ID} tabIndex={-1}>
        Meet the microbes
      </h2>
      <p className="fineprint meet-intro">
        The drifting illustrations are stylised and do not identify species. Choose one to open its card.
      </p>

      {state.status === 'loading' ? (
        <ul className="meet-list" aria-busy="true" aria-label="Loading cards">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="meet-item meet-skeleton" />
          ))}
        </ul>
      ) : null}

      {state.status === 'error' ? (
        <div className="notice" role="alert">
          <strong>Cards couldn&apos;t load.</strong> {state.message}{' '}
          <button type="button" className="btn btn-secondary" onClick={() => setAttempt((a) => a + 1)}>
            Try again
          </button>
        </div>
      ) : null}

      {state.status === 'ready' ? (
        <>
          <ul className="meet-list">
            {microbes.map((r) => (
              <li key={r.content.key}>
                <button type="button" className="meet-item" onClick={(e) => open(r.content.key, e.currentTarget)}>
                  <KnowledgeArt refName={r.content.illustration.ref} theme={theme} size={72} />
                  <span className="meet-text">
                    <span className="meet-title">{r.content.title}</span>
                    <span className="meet-sub">{r.content.is_placeholder ? 'Placeholder card' : 'Card'}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {notes.length ? (
            <>
              <h3 className="meet-subhead">Short notes</h3>
              <ul className="meet-list meet-notes">
                {notes.map((r) => (
                  <li key={r.content.key}>
                    <button type="button" className="meet-item" onClick={(e) => open(r.content.key, e.currentTarget)}>
                      <KnowledgeArt refName={r.content.illustration.ref} theme={theme} size={56} />
                      <span className="meet-text">
                        <span className="meet-title">{r.content.title}</span>
                        <span className="meet-sub">{r.content.is_placeholder ? 'Placeholder note' : 'Note'}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </>
      ) : null}

      <details className="reviewer-controls">
        <summary>D0 reviewer controls (synthetic)</summary>
        <div className="reviewer-row">
          <button type="button" className="btn btn-secondary" onClick={(e) => open(DEMO_MISSING_KEY, e.currentTarget)}>
            Open a card with no content yet
          </button>
          <button type="button" className="btn btn-secondary" onClick={simulateError}>
            Make the next card request fail
          </button>
        </div>
      </details>
    </section>
  );
}
