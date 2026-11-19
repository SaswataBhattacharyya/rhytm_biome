/**
 * Product detail (Relay 07): manual gallery or brand fallback, price for the
 * selected available size, readable unavailable size, purchase note, optional
 * description (key product.description). Android Back returns to Explore →
 * Products.
 */
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { defaultSku, formatINR, productDetailSections, skuLabel, spokenINR, visibleSections } from '@rb-lab/shared';
import { BackRow, PreviewLabel, ProductGallery, PurchaseNote, ReadError, SizePicker, useSelectedSku } from '../../../src/components/catalog';
import { Banner, Card, Screen, Skeleton, Txt } from '../../../src/components/ui';
import { useCatalog, useCatalogRead } from '../../../src/data/CatalogProvider';

export default function ProductDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { hidden } = useCatalog();
  const [state, retry] = useCatalogRead((s) => s.getProduct(String(slug ?? '')), `product:${slug}`);
  const product = state.s === 'ok' ? state.data : null;
  const [sku, setSku] = useSelectedSku(product?.skus, product ? defaultSku(product)?.id ?? null : null);
  return (
    <Screen header={false}>
      <BackRow label="Products" />
      {state.s === 'loading' ? (
        <View accessibilityLabel="Loading" accessibilityState={{ busy: true }} style={{ gap: 10 }}>
          <Skeleton height={220} />
          <Skeleton height={34} width="70%" />
        </View>
      ) : null}
      {state.s === 'error' ? <ReadError message={state.message} onRetry={retry} what="this product" /> : null}
      {state.s === 'ok' && !product ? <Banner title="This product isn’t available" body="It may have been removed or isn’t published yet." /> : null}
      {product ? (
        <>
          <ProductGallery media={product.media} title={product.title} />
          <View style={{ gap: 6 }}>
            <Txt variant="label" tone="secondary">
              Product
            </Txt>
            <Txt variant="display" accessibilityRole="header">
              {product.title}
            </Txt>
            <PreviewLabel />
            <Txt
              variant="title"
              accessibilityLiveRegion="polite"
              accessibilityLabel={sku?.available ? `Price ${spokenINR(sku.price_paise)} for ${skuLabel(sku)}` : 'Selected size unavailable'}
            >
              {sku?.available ? formatINR(sku.price_paise) : 'Unavailable'}
            </Txt>
          </View>
          {product.skus.length ? <SizePicker skus={product.skus} value={sku?.id ?? null} onChange={setSku} /> : null}
          <PurchaseNote />
          {visibleSections(productDetailSections(product), hidden).map((sec) => (
            <Card key={sec.id}>
              <Txt variant="heading" accessibilityRole="header">
                {sec.title}
              </Txt>
              {sec.body ? <Txt>{sec.body}</Txt> : null}
            </Card>
          ))}
        </>
      ) : null}
    </Screen>
  );
}
