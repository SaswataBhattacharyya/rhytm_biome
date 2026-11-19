/**
 * Trust-section visibility for the Relay 08 web preview (plan 36,
 * "Experts, testimonials and ratings").
 *
 * Web-local by scope: Codex will register these keys in the shared Admin Hub
 * section registry when the publishing contract is connected. Keys are stable
 * and independent of visible labels. Renderers decide BEFORE mounting, so a
 * hidden section leaves no heading, link or spacing of its own.
 *
 * `experts.directory` is the Experts capability: when it is off, the /experts
 * route is not available and every link to it is removed, independently of
 * whether the homepage preview (`home.experts`) is shown.
 */

export const TRUST_SECTIONS = {
  'home.experts': { name: 'Homepage · Experts preview', screen: 'home', platforms: ['web'] },
  'experts.directory': { name: 'Experts directory and links', screen: 'experts', platforms: ['web'] },
  'home.testimonials': { name: 'Homepage · Testimonials', screen: 'home', platforms: ['web'] },
  'product.ratings_reviews': { name: 'Product detail · Ratings and reviews', screen: 'product detail', platforms: ['web'] },
} as const;

export type TrustSectionKey = keyof typeof TRUST_SECTIONS;

/** Checked-in preview defaults: true = shown. */
export const TRUST_VISIBILITY: Readonly<Record<TrustSectionKey, boolean>> = {
  'home.experts': true,
  'experts.directory': true,
  'home.testimonials': true,
  'product.ratings_reviews': true,
};

export const isTrustSectionKey = (k: string): k is TrustSectionKey => Object.prototype.hasOwnProperty.call(TRUST_SECTIONS, k);

/**
 * Parse the review-only `?hide=` override. It shares the parameter with the
 * catalogue keys (e.g. `?hide=product.description,home.testimonials`); keys
 * that are not trust keys are ignored here.
 */
export function parseHiddenTrust(raw: string | null | undefined): TrustSectionKey[] {
  if (!raw) return [];
  return [...new Set(raw.split(',').map((s) => s.trim()).filter(isTrustSectionKey))];
}

export function isTrustVisible(key: TrustSectionKey, hidden: readonly TrustSectionKey[] = [], config = TRUST_VISIBILITY): boolean {
  return config[key] !== false && !hidden.includes(key);
}
