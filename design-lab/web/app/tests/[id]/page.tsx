import { CatalogShell } from '../../../components/catalog/CatalogShell';
import { TestDetail } from '../../../components/catalog/TestDetail';
import { checkConnectedCatalogueRoute } from '../../../lib/catalogueRoute';

export const metadata = { title: 'Test — Rhythm Biome' };

export default async function Page({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ catalog?: string | string[] }>;
}) {
  const [{ id }, { catalog }] = await Promise.all([params, searchParams]);
  await checkConnectedCatalogueRoute(catalog, source => source.getTest(id));
  return (
    <CatalogShell>
      <TestDetail id={id} />
    </CatalogShell>
  );
}
