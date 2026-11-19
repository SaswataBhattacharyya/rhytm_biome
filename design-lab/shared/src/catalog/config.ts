import { createFixtureCatalog, type CatalogScenario } from './fixture';
import { createHttpCatalog } from './http';
import type { CatalogSource } from './source';

/**
 * The fixture is the explicit default for previews. The connected adapter is
 * used only when the build opts in (web: NEXT_PUBLIC_RB_CATALOG_SOURCE=api;
 * Android: EXPO_PUBLIC_RB_CATALOG_SOURCE=api) and an API base is configured.
 */
export function selectCatalogSource(env: { source?: string; apiBase?: string; scenario?: CatalogScenario | null }): CatalogSource {
  if (env.source === 'api' && env.apiBase && !env.scenario) return createHttpCatalog({ apiBase: env.apiBase });
  return createFixtureCatalog(env.scenario ?? 'sample');
}
