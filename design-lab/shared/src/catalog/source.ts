/**
 * One typed data-source interface for catalogue reads (Relay 07). Screens
 * depend only on CatalogSource, so Codex can swap the fixture for the
 * connected adapter without touching UI code.
 */
import type { Product, TestType } from './types';

export type CatalogSourceMode = 'fixture' | 'connected';

export type CatalogErrorKind = 'network' | 'unavailable';

export class CatalogError extends Error {
  readonly kind: CatalogErrorKind;
  readonly status: number;
  constructor(kind: CatalogErrorKind, message: string, status = 0) {
    super(message);
    this.name = 'CatalogError';
    this.kind = kind;
    this.status = status;
  }
}

export interface CatalogSource {
  readonly mode: CatalogSourceMode;
  /** Short, non-secret label for review badges. */
  readonly label: string;
  listTests(): Promise<TestType[]>;
  /** null when unknown or unpublished (404). */
  getTest(id: string): Promise<TestType | null>;
  listProducts(): Promise<Product[]>;
  /** null when unknown or unpublished (404). */
  getProduct(slug: string): Promise<Product | null>;
}

/** Copy shown in browse and detail flows while the catalogue is a sandbox preview. */
export const PREVIEW_LABEL = 'Preview · sample items and prices';
export const PILOT_PURCHASE_NOTE =
  'Booking and checkout aren’t open in this pilot yet. They’ll be added in a later sandbox step, after catalogue review, using test payments only.';
