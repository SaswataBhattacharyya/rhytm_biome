import { CatalogShell } from '../../components/catalog/CatalogShell';
import { TestsList } from '../../components/catalog/TestsList';

export const metadata = { title: 'Tests — Rhythm Biome' };

export default function Page() {
  return (
    <CatalogShell>
      <TestsList />
    </CatalogShell>
  );
}
