import { CatalogShell } from '../../components/catalog/CatalogShell';
import { ProductsList } from '../../components/catalog/ProductsList';

export const metadata = { title: 'Products — Rhythm Biome' };

export default function Page() {
  return (
    <CatalogShell>
      <ProductsList />
    </CatalogShell>
  );
}
