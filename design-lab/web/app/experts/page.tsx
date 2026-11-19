import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CatalogShell } from '../../components/catalog/CatalogShell';
import { ExpertsDirectory } from '../../components/trust/ExpertsDirectory';
import { TRUST_VISIBILITY } from '../../lib/trust/visibility';

export const metadata: Metadata = { title: 'Experts — Rhythm Biome' };

/** Directly reachable Experts directory; the `experts.directory` capability removes the route. */
export default function Page() {
  if (!TRUST_VISIBILITY['experts.directory']) notFound();
  return (
    <CatalogShell>
      <ExpertsDirectory />
    </CatalogShell>
  );
}
