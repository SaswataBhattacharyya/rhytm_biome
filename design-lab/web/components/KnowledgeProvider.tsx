'use client';

/**
 * "Did you know?" knowledge cards (34 LEARN-01/02).
 *
 *  - Native <dialog> + showModal(): focus is trapped and the page is inert.
 *  - Named Close button, Escape (dialog `cancel`), and browser/Android back
 *    (one history entry is pushed while open) all close it.
 *  - Focus returns to the opener when it can take focus, otherwise to the
 *    "Meet the microbes" heading.
 *  - While open, ambient motion pauses; closing restores the prior state
 *    (it never starts motion the user had paused).
 *  - Content comes from a replaceable transport (D0: placeholder fixtures).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  getDemoKnowledgeTransport,
  loadKnowledgeCard,
  PLACEHOLDER_NOTICE,
  type KnowledgeLoadResult,
  type KnowledgeTransport,
} from '@rb-lab/shared';
import { KnowledgeArt } from './KnowledgeArt';
import { usePrefs } from './PrefsProvider';

interface KnowledgeCtx {
  open: (key: string, opener?: Element | null) => void;
  isOpen: boolean;
  transport: KnowledgeTransport;
}

const Ctx = createContext<KnowledgeCtx | null>(null);

export const MEET_HEADING_ID = 'meet-microbes-title';

type View = { state: 'loading' } | KnowledgeLoadResult;

export function KnowledgeProvider({ children, transport }: { children: ReactNode; transport?: KnowledgeTransport }) {
  const tp = useMemo(() => transport ?? getDemoKnowledgeTransport(), [transport]);
  const [key, setKey] = useState<string | null>(null);
  const [view, setView] = useState<View>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const openerRef = useRef<Element | null>(null);
  const pushedRef = useRef(false);
  const openRef = useRef(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { theme } = usePrefs();

  const open = useCallback((k: string, opener?: Element | null) => {
    openerRef.current = opener ?? document.activeElement;
    setKey(k);
    setAttempt((a) => a + 1);
  }, []);

  const restoreFocus = useCallback(() => {
    const el = openerRef.current;
    openerRef.current = null;
    const focusable =
      el instanceof HTMLElement &&
      el.isConnected &&
      el.getAttribute('aria-hidden') !== 'true' &&
      (el.tabIndex >= 0 || el.matches('a[href], button, input, select, textarea, summary'));
    const target = focusable ? (el as HTMLElement) : document.getElementById(MEET_HEADING_ID);
    target?.focus({ preventScroll: !focusable });
  }, []);

  const close = useCallback(() => {
    if (!openRef.current) return;
    openRef.current = false;
    dialogRef.current?.close();
    setKey(null);
    if (pushedRef.current) {
      pushedRef.current = false;
      window.history.back();
    }
    restoreFocus();
  }, [restoreFocus]);

  // Show the modal and push one history entry so Back closes it.
  useEffect(() => {
    if (!key) return;
    const d = dialogRef.current;
    if (d && !d.open) d.showModal();
    if (!openRef.current) {
      openRef.current = true;
      try {
        window.history.pushState({ ...(window.history.state ?? {}), rbKnowledge: key }, '');
        pushedRef.current = true;
      } catch {
        pushedRef.current = false;
      }
    }
  }, [key]);

  useEffect(() => {
    const onPop = () => {
      if (!openRef.current) return;
      pushedRef.current = false; // the entry is already gone
      openRef.current = false;
      dialogRef.current?.close();
      setKey(null);
      restoreFocus();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [restoreFocus]);

  // Load content for the current key.
  useEffect(() => {
    if (!key) return;
    const ac = new AbortController();
    setView({ state: 'loading' });
    loadKnowledgeCard(tp, key, 'en', ac.signal)
      .then((res) => {
        if (!ac.signal.aborted) setView(res);
      })
      .catch(() => {
        /* aborted */
      });
    return () => ac.abort();
  }, [key, attempt, tp]);

  const ctx = useMemo(() => ({ open, isOpen: key !== null, transport: tp }), [open, key, tp]);

  return (
    <Ctx.Provider value={ctx}>
      {children}
      <dialog
        ref={dialogRef}
        className="knowledge-dialog"
        aria-labelledby="knowledge-title"
        aria-describedby="knowledge-notice"
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
        onKeyDown={(e) => {
          // Keep Tab inside the card (browsers may otherwise move focus to browser UI).
          if (e.key !== 'Tab') return;
          const nodes = Array.from(
            dialogRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? [],
          );
          if (!nodes.length) return;
          const first = nodes[0];
          const last = nodes[nodes.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }}
        onClick={(e) => {
          // Click on the backdrop (outside the card) closes.
          if (e.target === dialogRef.current) close();
        }}
      >
        <div className="knowledge-card">
          <div className="knowledge-head">
            <p className="knowledge-eyebrow">Did you know?</p>
            <button type="button" className="btn btn-quiet knowledge-close" onClick={close}>
              Close
            </button>
          </div>
          <KnowledgeBody view={view} theme={theme} onRetry={() => setAttempt((a) => a + 1)} />
        </div>
      </dialog>
    </Ctx.Provider>
  );
}

function KnowledgeBody({ view, theme, onRetry }: { view: View; theme: 'light' | 'dark'; onRetry: () => void }) {
  if ('state' in view) {
    return (
      <div className="knowledge-body" aria-busy="true">
        <h2 id="knowledge-title">Loading…</h2>
        <p id="knowledge-notice" className="knowledge-skeleton" />
        <p className="knowledge-skeleton short" />
      </div>
    );
  }
  if (view.status === 'error') {
    return (
      <div className="knowledge-body">
        <h2 id="knowledge-title">This card couldn&apos;t load</h2>
        <p id="knowledge-notice" role="alert">
          {view.message}
        </p>
        <button type="button" className="btn btn-primary" onClick={onRetry}>
          Try again
        </button>
      </div>
    );
  }
  if (view.status === 'missing') {
    return (
      <div className="knowledge-body">
        <KnowledgeArt refName="unknown" theme={theme} />
        <h2 id="knowledge-title">Content coming soon</h2>
        <p id="knowledge-notice">There is no reviewed card for this illustration yet.</p>
      </div>
    );
  }
  const c = view.record.content;
  return (
    <div className="knowledge-body">
      <KnowledgeArt refName={c.illustration.ref} theme={theme} size={112} label={c.illustration.alt} />
      <h2 id="knowledge-title">{c.title}</h2>
      {c.is_placeholder ? (
        <p id="knowledge-notice" className="knowledge-placeholder" role="note">
          {PLACEHOLDER_NOTICE}
        </p>
      ) : (
        <p id="knowledge-notice" className="sr-only">
          Reviewed content.
        </p>
      )}
      <p className="knowledge-summary">{c.summary}</p>
      {c.blocks.map((b, i) =>
        b.type === 'paragraph' ? (
          <p key={i}>{b.text}</p>
        ) : (
          <ul key={i}>
            {b.items.map((it, j) => (
              <li key={j}>{it}</li>
            ))}
          </ul>
        ),
      )}
      {c.sources.length ? (
        <div className="knowledge-sources">
          <h3>Sources</h3>
          <ul>
            {c.sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noopener noreferrer">
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function useKnowledge(): KnowledgeCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useKnowledge outside KnowledgeProvider');
  return v;
}
