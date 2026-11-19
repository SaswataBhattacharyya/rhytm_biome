import { NotFound } from '../../../components/catalog/CatalogBits';
import { CatalogShell } from '../../../components/catalog/CatalogShell';

export default function MissingProduct() {
  return (
    <CatalogShell>
      <NotFound what="product" href="/products" back="See all products" />
    </CatalogShell>
  );
}
