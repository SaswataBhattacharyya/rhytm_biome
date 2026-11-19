/**
 * Android catalogue UI (Relay 07): compact Tests / Products rows for Explore,
 * a manual product gallery, the brand media fallback, the variant picker and
 * the shared preview/purchase copy. Detail screens live in
 * app/catalog/test/[id].tsx and app/catalog/product/[slug].tsx.
 */
import { router } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Image, Pressable, ScrollView, View, type ImageSourcePropType, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import {
  DOMAIN_LABEL,
  PILOT_PURCHASE_NOTE,
  PREVIEW_LABEL,
  PREVIEW_MEDIA_SCHEME,
  formatINR,
  fromPrice,
  skuLabel,
  spokenINR,
  type Media,
  type Sku,
} from '@rb-lab/shared';
import { useCatalog, useCatalogRead } from '../data/CatalogProvider';
import { useAppTheme } from '../theme/ThemeProvider';
import { Banner, Button, Logo, Skeleton, Txt } from './ui';

// ------------------------------------------------------------------ media

const PREVIEW_ASSETS: Record<string, ImageSourcePropType> = {
  'pouch-1': require('../../assets/catalog-preview/pouch-1.png'),
  'pouch-2': require('../../assets/catalog-preview/pouch-2.png'),
  'pouch-3': require('../../assets/catalog-preview/pouch-3.png'),
  'single-1': require('../../assets/catalog-preview/single-1.png'),
};

/** Preview scheme → bundled original asset; http(s) passes through; else null (fallback). */
export function mediaSource(url: string): ImageSourcePropType | null {
  if (url.startsWith(PREVIEW_MEDIA_SCHEME)) return PREVIEW_ASSETS[url.slice(PREVIEW_MEDIA_SCHEME.length)] ?? null;
  if (/^https?:\/\//.test(url)) return { uri: url };
  return null;
}

export function MediaFallback({ label, compact }: { label: string; compact?: boolean }) {
  const { colors } = useAppTheme();
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${label} — no image yet`}
      style={{
        aspectRatio: compact ? 1 : 4 / 3,
        width: compact ? 56 : '100%',
        borderRadius: compact ? 12 : 18,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {compact ? <Txt variant="caption" tone="muted">RB</Txt> : <Logo height={26} />}
    </View>
  );
}

function Thumb({ media, label }: { media: Media[]; label: string }) {
  const first = media.map((m) => ({ m, src: mediaSource(m.url) })).find((x) => x.src);
  if (!first) return <MediaFallback label={label} compact />;
  return <Image source={first.src!} accessibilityIgnoresInvertColors style={{ width: 56, height: 56, borderRadius: 12 }} accessible={false} />;
}

/** Manual gallery: swipe (paging), previous/next buttons, numbered thumbnails. No autoplay. */
export function ProductGallery({ media, title }: { media: Media[]; title: string }) {
  const { colors, reducedMotion } = useAppTheme();
  const items = media.map((m) => ({ m, src: mediaSource(m.url) })).filter((x) => x.src);
  const [w, setW] = useState(0);
  const [idx, setIdx] = useState(0);
  const ref = useRef<ScrollView>(null);
  const n = items.length;

  if (!n) return <MediaFallback label={title} />;
  if (n === 1) {
    return (
      <Image
        source={items[0].src!}
        accessible
        accessibilityLabel={items[0].m.alt_text}
        style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 18 }}
        resizeMode="cover"
      />
    );
  }
  const go = (i: number) => {
    const next = ((i % n) + n) % n;
    setIdx(next);
    ref.current?.scrollTo({ x: next * w, animated: !reducedMotion });
  };
  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (w) setIdx(Math.round(e.nativeEvent.contentOffset.x / w));
  };
  return (
    <View style={{ gap: 8 }} accessibilityLabel={`${title} images`}>
      <View onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)} style={{ borderRadius: 18, overflow: 'hidden' }}>
        <ScrollView ref={ref} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onEnd}>
          {items.map(({ m, src }, i) => (
            <Image
              key={m.id}
              source={src!}
              accessible={i === idx}
              importantForAccessibility={i === idx ? 'yes' : 'no-hide-descendants'}
              accessibilityLabel={m.alt_text}
              style={{ width: w || 1, aspectRatio: 4 / 3 }}
              resizeMode="cover"
            />
          ))}
        </ScrollView>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Button label="Previous image" kind="secondary" onPress={() => go(idx - 1)} style={{ flex: 1 }} />
        <Txt variant="caption" tone="muted" accessibilityLiveRegion="polite" style={{ minWidth: 64, textAlign: 'center' }}>
          {idx + 1} of {n}
        </Txt>
        <Button label="Next image" kind="secondary" onPress={() => go(idx + 1)} style={{ flex: 1 }} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {items.map(({ m, src }, i) => (
          <Pressable
            key={m.id}
            accessibilityRole="button"
            accessibilityLabel={`Show image ${i + 1} of ${n}`}
            accessibilityState={{ selected: i === idx }}
            onPress={() => go(i)}
            hitSlop={4}
            style={{ borderRadius: 10, borderWidth: 2, borderColor: i === idx ? colors.textSecondary : 'transparent', overflow: 'hidden' }}
          >
            <Image source={src!} style={{ width: 64, height: 48 }} accessible={false} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ------------------------------------------------------------------ copy

export function PreviewLabel() {
  const { colors } = useAppTheme();
  const { source } = useCatalog();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      <View style={{ borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.textMuted, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
        <Txt variant="caption" tone="muted">
          {PREVIEW_LABEL}
        </Txt>
      </View>
      {source.mode === 'connected' ? (
        <View style={{ borderWidth: 1.5, borderColor: colors.textMuted, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
          <Txt variant="caption" tone="muted">
            Connected catalogue ({source.label})
          </Txt>
        </View>
      ) : null}
    </View>
  );
}

export function PurchaseNote() {
  return <Banner title="Booking isn’t open yet" body={PILOT_PURCHASE_NOTE} />;
}

export function ReadError({ message, onRetry, what }: { message: string; onRetry: () => void; what: string }) {
  return (
    <Banner tone="danger" title={`Couldn’t load ${what}`} body={message}>
      <Button label="Try again" kind="secondary" onPress={onRetry} style={{ marginTop: 8 }} />
    </Banner>
  );
}

export function BackRow({ label }: { label: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Back to ${label}`}
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/explore'))}
      hitSlop={8}
      style={{ minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start' }}
    >
      <Txt variant="bodyStrong" tone="secondary">
        ‹ {label}
      </Txt>
    </Pressable>
  );
}

// ------------------------------------------------------------------ rows

function CatalogRow({
  title,
  detail,
  price,
  priceLabel,
  leading,
  onPress,
}: {
  title: string;
  detail: string;
  price: string;
  priceLabel: string;
  leading?: ReactNode;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${detail}. ${priceLabel}`}
      accessibilityHint="Opens details"
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minHeight: 64,
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      {leading}
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="bodyStrong">{title}</Txt>
        <Txt variant="caption" tone="muted">
          {detail}
        </Txt>
      </View>
      <Txt variant="data" accessible={false}>
        {price}
      </Txt>
      <Txt variant="heading" tone="muted" accessible={false} importantForAccessibility="no">
        ›
      </Txt>
    </Pressable>
  );
}

function ListLoading() {
  return (
    <View accessibilityLabel="Loading" accessibilityState={{ busy: true }} style={{ gap: 10 }}>
      <Skeleton height={64} />
      <Skeleton height={64} />
    </View>
  );
}

export function TestsSection() {
  const [state, retry] = useCatalogRead((s) => s.listTests(), 'tests');
  return (
    <View style={{ gap: 10 }}>
      <Txt tone="muted">Each kit has its own page with what it tests and who it suits.</Txt>
      <PreviewLabel />
      {state.s === 'loading' ? <ListLoading /> : null}
      {state.s === 'error' ? <ReadError message={state.message} onRetry={retry} what="tests" /> : null}
      {state.s === 'ok' && !state.data.length ? <Banner title="No tests yet" body="No tests are published yet. Check back soon." /> : null}
      {state.s === 'ok'
        ? state.data.map((t) => (
            <CatalogRow
              key={t.id}
              title={t.title}
              detail={`${DOMAIN_LABEL[t.domain] ?? t.domain} · ${t.specimen_type} sample`}
              price={formatINR(t.price_paise)}
              priceLabel={spokenINR(t.price_paise)}
              onPress={() => router.push({ pathname: '/catalog/test/[id]', params: { id: t.id } })}
            />
          ))
        : null}
    </View>
  );
}

export function ProductsSection() {
  const [state, retry] = useCatalogRead((s) => s.listProducts(), 'products');
  return (
    <View style={{ gap: 10 }}>
      <Txt tone="muted">Accessories and supplies, separate from tests.</Txt>
      <PreviewLabel />
      {state.s === 'loading' ? <ListLoading /> : null}
      {state.s === 'error' ? <ReadError message={state.message} onRetry={retry} what="products" /> : null}
      {state.s === 'ok' && !state.data.length ? <Banner title="No products yet" body="No products are published yet. Check back soon." /> : null}
      {state.s === 'ok'
        ? state.data.map((p) => {
            const fp = fromPrice(p);
            const some = p.skus.some((x) => !x.available);
            return (
              <CatalogRow
                key={p.id}
                title={p.title}
                detail={`${p.skus.length} ${p.skus.length === 1 ? 'size' : 'sizes'}${some ? ' · some unavailable' : ''}`}
                price={fp ? `${fp.several ? 'From ' : ''}${formatINR(fp.paise)}` : 'Unavailable'}
                priceLabel={fp ? `${fp.several ? 'From ' : ''}${spokenINR(fp.paise)}` : 'Unavailable'}
                leading={<Thumb media={p.media} label={p.title} />}
                onPress={() => router.push({ pathname: '/catalog/product/[slug]', params: { slug: p.slug } })}
              />
            );
          })
        : null}
    </View>
  );
}

// ------------------------------------------------------------------ variants

export function SizePicker({ skus, value, onChange }: { skus: Sku[]; value: string | null; onChange: (id: string) => void }) {
  const { colors } = useAppTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Size" style={{ gap: 8 }}>
      <Txt variant="label">Size</Txt>
      {skus.map((s) => {
        const checked = s.id === value;
        return (
          <Pressable
            key={s.id}
            accessibilityRole="radio"
            accessibilityState={{ checked, disabled: !s.available }}
            accessibilityLabel={`${skuLabel(s)} ${s.format}, ${s.available ? spokenINR(s.price_paise) : 'unavailable'}`}
            disabled={!s.available}
            onPress={() => onChange(s.id)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              minHeight: 52,
              paddingVertical: 8,
              paddingHorizontal: 14,
              borderRadius: 14,
              borderWidth: checked ? 2 : 1.5,
              borderStyle: s.available ? 'solid' : 'dashed',
              borderColor: checked ? colors.textSecondary : colors.border,
              backgroundColor: colors.surface,
            }}
          >
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: 10,
                borderWidth: 2,
                borderColor: s.available ? colors.textSecondary : colors.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {checked ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.textSecondary }} /> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Txt variant="bodyStrong" tone={s.available ? 'text' : 'muted'}>
                {skuLabel(s)} <Txt variant="caption" tone="muted">{s.format}</Txt>
              </Txt>
            </View>
            <Txt variant={s.available ? 'data' : 'caption'} tone={s.available ? 'text' : 'muted'}>
              {s.available ? formatINR(s.price_paise) : 'Unavailable'}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Selected SKU state that resets to the default when the product changes. */
export function useSelectedSku(skus: Sku[] | undefined, initial: string | null) {
  const [id, setId] = useState<string | null>(initial);
  useEffect(() => setId(initial), [initial]);
  return [skus?.find((s) => s.id === id) ?? null, setId] as const;
}
