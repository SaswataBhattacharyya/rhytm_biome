import type { components } from '../../../../packages/api-client/src/schema';

export type TestType = components['schemas']['TestType'];
export type TestDomain = TestType['domain'];
export type Media = components['schemas']['Media'];
export type Sku = components['schemas']['Sku'];
export type Product = components['schemas']['Product'];

/** Catalogue list envelope, including its continuation cursor. */
export interface CatalogList<T> {
  data: T[];
  meta: { next_cursor: string | null };
}

/** Detail responses: `{ data: item }`; unknown or unpublished → 404. */
export interface CatalogDetail<T> {
  data: T;
}
