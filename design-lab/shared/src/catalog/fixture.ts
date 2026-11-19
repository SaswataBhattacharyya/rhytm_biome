/**
 * Fixture catalogue (preview only). Reads the Codex-supplied synthetic
 * fixture (catalog-fixture.json: one test, one product with an available and
 * an unavailable size, no media) and offers explicit review scenarios:
 *
 *   sample   the supplied fixture as-is (default)
 *   gallery  sample + two ORIGINAL labelled synthetic products: a three-image
 *            gallery and a single image (media served from preview assets)
 *   empty    published lists are empty
 *   slow     every read takes 2.5 s (loading states)
 *   error    every read fails (retry stays failing)
 *   flaky    the first read of each resource fails, the retry succeeds
 *
 * Scenarios are selected by review controls only, never by ordinary navigation.
 */
import supplied from '../catalog-fixture.json';
import { CatalogError, type CatalogSource } from './source';
import type { Product, TestType } from './types';

export const CATALOG_SCENARIOS = ['sample', 'gallery', 'empty', 'slow', 'error', 'flaky'] as const;
export type CatalogScenario = (typeof CATALOG_SCENARIOS)[number];
export const isCatalogScenario = (v: unknown): v is CatalogScenario => typeof v === 'string' && (CATALOG_SCENARIOS as readonly string[]).includes(v);

/** Preview media use this scheme; each platform resolves it to its own bundled asset. */
export const PREVIEW_MEDIA_SCHEME = 'rb-preview:';

/** Original synthetic preview products (gallery scenario only). */
export const GALLERY_PREVIEW_PRODUCTS: Product[] = [
  {
    id: 'c0000000-0000-4000-8000-000000000001',
    slug: 'preview-gallery-pouch',
    title: 'Gallery preview pouch (synthetic)',
    description: 'A synthetic listing with three labelled preview illustrations, used to review the product gallery.',
    version: 1,
    media: [1, 2, 3].map((n) => ({
      id: `c0000000-0000-4000-8000-00000000010${n}`,
      url: `${PREVIEW_MEDIA_SCHEME}pouch-${n}`,
      width: 800,
      height: 600,
      alt_text: `Synthetic preview illustration ${n} of 3: abstract pouch shape in Rhythm Biome colours`,
    })),
    skus: [
      { id: 'c0000000-0000-4000-8000-000000000201', sku_code: 'PREVIEW-GALLERY-S', format: 'Pouch', size_label: 'Small', price_paise: 29900, currency: 'INR', available: true },
      { id: 'c0000000-0000-4000-8000-000000000202', sku_code: 'PREVIEW-GALLERY-M', format: 'Pouch', size_label: 'Medium', price_paise: 34900, currency: 'INR', available: true },
    ],
  },
  {
    id: 'c0000000-0000-4000-8000-000000000002',
    slug: 'preview-single-image',
    title: 'Single-image preview (synthetic)',
    description: 'A synthetic listing with one labelled preview illustration, so no gallery controls are shown.',
    version: 1,
    media: [
      {
        id: 'c0000000-0000-4000-8000-000000000111',
        url: `${PREVIEW_MEDIA_SCHEME}single-1`,
        width: 800,
        height: 600,
        alt_text: 'Synthetic preview illustration: abstract card shape in Rhythm Biome colours',
      },
    ],
    skus: [{ id: 'c0000000-0000-4000-8000-000000000211', sku_code: 'PREVIEW-SINGLE-1', format: 'Card', size_label: 'One size', price_paise: 9900, currency: 'INR', available: true }],
  },
];

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export function createFixtureCatalog(scenario: CatalogScenario = 'sample'): CatalogSource {
  const tests = (supplied as { tests: TestType[] }).tests;
  const products = [...(supplied as { products: Product[] }).products, ...(scenario === 'gallery' ? GALLERY_PREVIEW_PRODUCTS : [])];
  const failedOnce = new Set<string>();
  const delay = scenario === 'slow' ? 2500 : 120;

  async function read<T>(resource: string, value: () => T): Promise<T> {
    await new Promise((r) => setTimeout(r, delay));
    if (scenario === 'error') throw new CatalogError('network', 'Couldn’t reach the catalogue.');
    if (scenario === 'flaky' && !failedOnce.has(resource)) {
      failedOnce.add(resource);
      throw new CatalogError('network', 'Couldn’t reach the catalogue.');
    }
    return clone(value());
  }

  return {
    mode: 'fixture',
    label: scenario === 'sample' ? 'synthetic fixture' : `synthetic fixture · ${scenario}`,
    listTests: () => read('tests', () => (scenario === 'empty' ? [] : tests)),
    getTest: (id) => read(`test:${id}`, () => (scenario === 'empty' ? null : tests.find((t) => t.id === id) ?? null)),
    listProducts: () => read('products', () => (scenario === 'empty' ? [] : products)),
    getProduct: (slug) => read(`product:${slug}`, () => (scenario === 'empty' ? null : products.find((p) => p.slug === slug) ?? null)),
  };
}
