/**
 * Shared detail structure so web and Android present the same order (36):
 * scope/description → specimen and eligibility → kit contents → collection
 * steps → turnaround → sample report/FAQ. Only sections with fixture data
 * are produced; optional ones carry a visibility key.
 */
import type { CatalogSectionKey } from './visibility';
import type { Product, Sku, TestType } from './types';

export interface DetailSection {
  id: string;
  key?: CatalogSectionKey;
  title: string;
  body?: string;
  facts?: { label: string; value: string }[];
}

export function testDetailSections(t: TestType): DetailSection[] {
  const out: DetailSection[] = [];
  if (t.description.trim()) out.push({ id: 'about', key: 'test.description', title: 'About this test', body: t.description });
  out.push({
    id: 'specimen',
    title: 'Specimen and eligibility',
    facts: [
      { label: 'Specimen', value: t.specimen_type },
      { label: 'Eligibility', value: t.eligibility_summary },
    ],
  });
  // Kit contents, collection steps, turnaround and sample report/FAQ are not
  // in the TestType contract yet (gap recorded in the result).
  return out;
}

export function productDetailSections(p: Product): DetailSection[] {
  return p.description.trim() ? [{ id: 'about', key: 'product.description', title: 'About this product', body: p.description }] : [];
}

/** Default size: the first available variant, else the first variant. */
export function defaultSku(p: Product): Sku | null {
  return p.skus.find((s) => s.available) ?? p.skus[0] ?? null;
}

/** Lowest available price, for list rows ("From ₹199"). */
export function fromPrice(p: Product): { paise: number; several: boolean } | null {
  const avail = p.skus.filter((s) => s.available);
  if (!avail.length) return null;
  const min = Math.min(...avail.map((s) => s.price_paise));
  return { paise: min, several: new Set(avail.map((s) => s.price_paise)).size > 1 };
}

export const skuLabel = (s: Sku) => (s.format && s.size_label ? `${s.size_label}` : s.size_label || s.format || s.sku_code);
