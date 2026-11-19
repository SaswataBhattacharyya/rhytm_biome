import { NotFound } from '../../../components/catalog/CatalogBits';
import { CatalogShell } from '../../../components/catalog/CatalogShell';

export default function MissingTest() {
  return (
    <CatalogShell>
      <NotFound what="test" href="/tests" back="See all tests" />
    </CatalogShell>
  );
}
