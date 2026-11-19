import { notFound } from 'next/navigation';
import { createHttpCatalog, isCatalogScenario, type CatalogSource } from '@rb-lab/shared';

export async function checkConnectedCatalogueRoute(
  scenario: string | string[] | undefined,
  read: (source: CatalogSource) => Promise<unknown>,
) {
  const apiBase = process.env.NEXT_PUBLIC_RB_API_BASE;
  const selectedScenario = Array.isArray(scenario) ? scenario[0] : scenario;
  if (process.env.NEXT_PUBLIC_RB_CATALOG_SOURCE !== 'api' || !apiBase || isCatalogScenario(selectedScenario)) return;

  // Only a definitive API 404 becomes a missing page. On transient failure,
  // render the usual detail shell so the browser can retry.
  const item = await read(createHttpCatalog({ apiBase, timeoutMs: 2000 })).catch(() => undefined);
  if (item === null) notFound();
}
