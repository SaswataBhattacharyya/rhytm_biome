import { CatalogShell } from '../../../components/catalog/CatalogShell';
import { ProductDetail } from '../../../components/catalog/ProductDetail';
import { checkConnectedCatalogueRoute } from '../../../lib/catalogueRoute';

export const metadata = { title: 'Product — Rhythm Biome' };

export default async function Page({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ catalog?: string | string[] }>;
}) {
  const [{ slug }, { catalog }] = await Promise.all([params, searchParams]);
  await checkConnectedCatalogueRoute(catalog, source => source.getProduct(slug));
  return (
    <CatalogShell>
      <ProductDetail slug={slug} />
    </CatalogShell>
  );
}
