'use client';

import Link from 'next/link';
import { PREVIEW_LABEL, PILOT_PURCHASE_NOTE, type CatalogSource } from '@rb-lab/shared';

export function PreviewLabel({ source }: { source: CatalogSource | null }) {
  return (
    <p className="preview-label">
      <span>{PREVIEW_LABEL}</span>
      {source && source.mode === 'connected' ? <span className="preview-source">Connected catalogue ({source.label})</span> : null}
    </p>
  );
}

export function PurchaseNote() {
  return (
    <p className="catalog-note" role="note">
      {PILOT_PURCHASE_NOTE}
    </p>
  );
}

export function ReadError({ message, onRetry, what }: { message: string; onRetry: () => void; what: string }) {
  return (
    <div className="daily-banner" data-tone="danger" role="alert">
      <span>
        Couldn’t load {what}. {message}
      </span>
      <button type="button" className="btn btn-secondary btn-small" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

export function NotFound({ what, href, back }: { what: string; href: string; back: string }) {
  return (
    <div className="catalog-empty" role="status">
      <h1>This {what} isn’t available</h1>
      <p className="lede">It may have been removed or isn’t published yet.</p>
      <Link href={href} className="btn btn-primary">
        {back}
      </Link>
    </div>
  );
}

export function BackLink({ href, children }: { href: string; children: string }) {
  return (
    <Link href={href} className="catalog-back">
      <span aria-hidden="true">←</span> {children}
    </Link>
  );
}

export function ListSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div className="catalog-skeleton" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton-row" />
      ))}
    </div>
  );
}
