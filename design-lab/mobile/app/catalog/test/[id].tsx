/**
 * Test detail (Relay 07). Same order as web (36): price and preview label near
 * the top, then optional description (key test.description) and the
 * specimen/eligibility facts. Android Back returns to Explore → Tests.
 */
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { DOMAIN_LABEL, formatINR, spokenINR, testDetailSections, visibleSections } from '@rb-lab/shared';
import { BackRow, PreviewLabel, PurchaseNote, ReadError } from '../../../src/components/catalog';
import { Banner, Card, Screen, Skeleton, Txt } from '../../../src/components/ui';
import { useCatalog, useCatalogRead } from '../../../src/data/CatalogProvider';

export default function TestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { hidden } = useCatalog();
  const [state, retry] = useCatalogRead((s) => s.getTest(String(id ?? '')), `test:${id}`);
  const test = state.s === 'ok' ? state.data : null;
  return (
    <Screen header={false}>
      <BackRow label="Tests" />
      {state.s === 'loading' ? (
        <View accessibilityLabel="Loading" accessibilityState={{ busy: true }} style={{ gap: 10 }}>
          <Skeleton height={34} width="70%" />
          <Skeleton height={28} width="40%" />
          <Skeleton height={80} />
        </View>
      ) : null}
      {state.s === 'error' ? <ReadError message={state.message} onRetry={retry} what="this test" /> : null}
      {state.s === 'ok' && !test ? <Banner title="This test isn’t available" body="It may have been removed or isn’t published yet." /> : null}
      {test ? (
        <>
          <View style={{ gap: 6 }}>
            <Txt variant="label" tone="secondary">
              {DOMAIN_LABEL[test.domain] ?? test.domain} test
            </Txt>
            <Txt variant="display" accessibilityRole="header">
              {test.title}
            </Txt>
            <PreviewLabel />
            <Txt variant="title" accessibilityLabel={`Price ${spokenINR(test.price_paise)}`}>
              {formatINR(test.price_paise)}
            </Txt>
            <Txt tone="muted">Specimen · {test.specimen_type}</Txt>
          </View>
          <PurchaseNote />
          {visibleSections(testDetailSections(test), hidden).map((sec) => (
            <Card key={sec.id}>
              <Txt variant="heading" accessibilityRole="header">
                {sec.title}
              </Txt>
              {sec.body ? <Txt>{sec.body}</Txt> : null}
              {sec.facts?.map((f) => (
                <View key={f.label} style={{ gap: 2 }}>
                  <Txt variant="caption" tone="muted">
                    {f.label}
                  </Txt>
                  <Txt>{f.value}</Txt>
                </View>
              ))}
            </Card>
          ))}
        </>
      ) : null}
    </Screen>
  );
}
