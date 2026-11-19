/**
 * Optional catalogue sections (Relay 07, plan 35 §"Hide, show and order").
 *
 * One checked-in configuration shared by web and Android. Keys are stable and
 * independent of visible labels. Renderers filter with `visibleSections()`
 * BEFORE mounting, so a hidden section leaves no heading, spacing or anchor.
 * Essential facts (title, price, specimen, eligibility, variants, preview
 * label, navigation) are not configurable here.
 *
 * Codex will later serve this through the versioned layout read; the review
 * overrides below are for previews only and never grant data access.
 */

export const CATALOG_SECTIONS = {
  'test.description': { name: 'Test detail · description', screen: 'test detail', platforms: ['web', 'android'] },
  'product.description': { name: 'Product detail · description', screen: 'product detail', platforms: ['web', 'android'] },
} as const;

export type CatalogSectionKey = keyof typeof CATALOG_SECTIONS;

/** Checked-in published defaults: true = shown. */
export const CATALOG_VISIBILITY: Readonly<Record<CatalogSectionKey, boolean>> = {
  'test.description': true,
  'product.description': true,
};

export const isCatalogSectionKey = (k: string): k is CatalogSectionKey => Object.prototype.hasOwnProperty.call(CATALOG_SECTIONS, k);

/** Parse a review override such as "test.description,product.description"; unknown keys are ignored. */
export function parseHiddenSections(raw: string | null | undefined): CatalogSectionKey[] {
  if (!raw) return [];
  return [...new Set(raw.split(',').map((s) => s.trim()).filter(isCatalogSectionKey))];
}

export function isSectionVisible(key: CatalogSectionKey, hidden: readonly CatalogSectionKey[] = [], config = CATALOG_VISIBILITY): boolean {
  return config[key] !== false && !hidden.includes(key);
}

/**
 * Filter an ordered list of renderable sections. Sections without a key are
 * essential and always kept.
 */
export function visibleSections<T extends { key?: CatalogSectionKey }>(sections: T[], hidden: readonly CatalogSectionKey[] = [], config = CATALOG_VISIBILITY): T[] {
  return sections.filter((s) => !s.key || isSectionVisible(s.key, hidden, config));
}
