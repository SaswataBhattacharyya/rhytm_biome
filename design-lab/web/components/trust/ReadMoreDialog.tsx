'use client';

/**
 * Accessible full-copy view for trust cards (plan 36: full copy in a dialog,
 * never by expanding one card inside its row). Native modal <dialog>: focus
 * moves inside and is contained, Escape and the backdrop close it, and the
 * page behind is inert. The caller's useReadMore() returns focus to the
 * opener and restores scroll on close.
 */
import { useEffect, useId, useRef, type ReactNode } from 'react';

export function ReadMoreDialog({
  open,
  onClose,
  kicker,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  kicker: string;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="trust-dialog"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
    >
      {open ? (
        <div className="trust-dialog-inner">
          <header className="trust-dialog-head">
            <div>
              <p className="trust-kicker">{kicker}</p>
              <h2 id={titleId}>{title}</h2>
            </div>
            <button type="button" className="trust-dialog-close" aria-label="Close" onClick={() => ref.current?.close()}>
              <span aria-hidden="true">×</span>
            </button>
          </header>
          <div className="trust-dialog-body">{children}</div>
        </div>
      ) : null}
    </dialog>
  );
}
