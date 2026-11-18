/**
 * Native "Meet the microbes" list + accessible "Did you know?" sheet
 * (34 LEARN-01/02, same content shape and transport as web).
 *
 *  - Modal with onRequestClose → Android Back closes it.
 *  - accessibilityViewIsModal; named Close button; screen-reader focus moves
 *    to the title on open and back to the opener on close.
 *  - Decorative motion is held while open and restored to the user's own
 *    choice afterwards.
 *  - Placeholder content is labelled; missing keys show "Content coming soon".
 */
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { AccessibilityInfo, findNodeHandle, Linking, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  DEMO_MISSING_KEY,
  getDemoKnowledgeTransport,
  loadKnowledgeCard,
  PLACEHOLDER_NOTICE,
  type DemoKnowledgeRecord,
  type KnowledgeLoadResult,
} from '@rb-lab/shared';
import { useAppTheme } from '../theme/ThemeProvider';
import { KnowledgeArt } from './art';
import { Banner, Button, Card, SectionTitle, Skeleton, Txt } from './ui';

type View_ = { state: 'loading' } | KnowledgeLoadResult;

export function MeetMicrobes() {
  const transport = getDemoKnowledgeTransport();
  const { colors } = useAppTheme();
  const [items, setItems] = useState<DemoKnowledgeRecord[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const openerRef = useRef<View | null>(null);
  const refs = useRef(new Map<string, View | null>());

  useEffect(() => {
    let alive = true;
    setItems(null);
    setListError(null);
    transport
      .list({ locale: 'en', limit: 20 })
      .then((page) => alive && setItems(page.items))
      .catch((e: unknown) => alive && setListError(e instanceof Error ? e.message : 'Something went wrong.'));
    return () => {
      alive = false;
    };
  }, [transport, attempt]);

  const open = (key: string, ref: View | null) => {
    openerRef.current = ref;
    setOpenKey(key);
  };

  const onClosed = useCallback(() => {
    setOpenKey(null);
    const node = openerRef.current ? findNodeHandle(openerRef.current) : null;
    if (node) setTimeout(() => AccessibilityInfo.setAccessibilityFocus(node), 250);
  }, []);

  return (
    <View style={{ gap: 12 }}>
      <SectionTitle>Meet the microbes</SectionTitle>
      <Txt variant="caption" tone="muted">
        Stylised illustrations; they don&apos;t identify species. Tap one to open its card.
      </Txt>
      {!items && !listError ? (
        <Card>
          <Skeleton height={56} />
          <Skeleton height={56} />
        </Card>
      ) : null}
      {listError ? (
        <Banner tone="danger" title="Cards couldn't load" body={listError}>
          <Button label="Try again" kind="secondary" onPress={() => setAttempt((a) => a + 1)} style={{ marginTop: 8 }} />
        </Banner>
      ) : null}
      {items ? (
        <View style={{ gap: 10 }}>
          {items.map((r) => (
            <Pressable
              key={r.content.key}
              ref={(node) => {
                refs.current.set(r.content.key, node);
              }}
              accessibilityRole="button"
              accessibilityLabel={`${r.content.title}. ${r.content.kind === 'knowledge_note' ? 'Note' : 'Microbe card'}${r.content.is_placeholder ? ', placeholder' : ''}`}
              accessibilityHint="Opens the card"
              onPress={() => open(r.content.key, refs.current.get(r.content.key) ?? null)}
              style={({ pressed }) => [
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  minHeight: 72,
                  padding: 12,
                  borderRadius: 18,
                  borderWidth: 1.5,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                },
                pressed && { opacity: 0.85 },
              ]}
            >
              <KnowledgeArt refName={r.content.illustration.ref} size={56} />
              <View style={{ flex: 1, gap: 2 }}>
                <Txt variant="bodyStrong">{r.content.title}</Txt>
                <Txt variant="caption" tone="muted">
                  {r.content.kind === 'knowledge_note' ? 'Short note' : 'Microbe card'}
                  {r.content.is_placeholder ? ' · placeholder' : ''}
                </Txt>
              </View>
            </Pressable>
          ))}
          <Pressable
            ref={(node) => {
              refs.current.set(DEMO_MISSING_KEY, node);
            }}
            accessibilityRole="button"
            accessibilityLabel="D0 check: open a card with no content yet"
            onPress={() => open(DEMO_MISSING_KEY, refs.current.get(DEMO_MISSING_KEY) ?? null)}
            style={{ minHeight: 48, justifyContent: 'center', borderTopWidth: 1, borderStyle: 'dashed', borderColor: colors.border }}
          >
            <Txt variant="caption" tone="muted">
              D0 check (synthetic): open a card with no content yet
            </Txt>
          </Pressable>
        </View>
      ) : null}
      <KnowledgeSheet cardKey={openKey} onClosed={onClosed} />
    </View>
  );
}

export function KnowledgeSheet({ cardKey, onClosed }: { cardKey: string | null; onClosed: () => void }) {
  const { colors, motionOff, holdMotion } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<View_>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const titleRef = useRef<Text>(null);
  const visible = cardKey !== null;

  // Hold decorative motion while the sheet is open; release restores the prior state.
  useEffect(() => {
    if (!visible) return;
    return holdMotion();
  }, [visible, holdMotion]);

  useEffect(() => {
    if (!cardKey) return;
    let alive = true;
    setView({ state: 'loading' });
    loadKnowledgeCard(getDemoKnowledgeTransport(), cardKey, 'en').then((res) => alive && setView(res));
    return () => {
      alive = false;
    };
  }, [cardKey, attempt]);

  // Move screen-reader focus to the title once content settles.
  useEffect(() => {
    if (!visible || 'state' in view) return;
    const node = titleRef.current ? findNodeHandle(titleRef.current) : null;
    if (node) setTimeout(() => AccessibilityInfo.setAccessibilityFocus(node), 150);
  }, [visible, view]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType={motionOff ? 'none' : 'slide'}
      onRequestClose={onClosed}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          accessible={false}
          importantForAccessibility="no"
          onPress={onClosed}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(15,20,24,0.5)' }}
        />
        <View
          accessibilityViewIsModal
          style={{
            maxHeight: '88%',
            backgroundColor: colors.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            borderWidth: 1,
            borderColor: colors.border,
            paddingBottom: insets.bottom + 16,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12 }}>
            <Txt variant="label" tone="secondary">
              Did you know?
            </Txt>
            <Button label="Close" kind="quiet" onPress={onClosed} accessibilityHint="Closes the card" />
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8, gap: 12 }}>
            <SheetBody view={view} titleRef={titleRef} onRetry={() => setAttempt((a) => a + 1)} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function SheetBody({ view, titleRef, onRetry }: { view: View_; titleRef: RefObject<Text | null>; onRetry: () => void }) {
  if ('state' in view) {
    return (
      <View accessibilityLabel="Loading card" accessibilityState={{ busy: true }} style={{ gap: 12 }}>
        <Skeleton height={96} width={96} />
        <Skeleton height={26} width="70%" />
        <Skeleton height={16} />
      </View>
    );
  }
  if (view.status === 'error') {
    return (
      <View style={{ gap: 12 }}>
        <Txt ref={titleRef} variant="title" accessibilityRole="header">
          This card couldn&apos;t load
        </Txt>
        <Txt tone="muted">{view.message}</Txt>
        <Button label="Try again" onPress={onRetry} />
      </View>
    );
  }
  if (view.status === 'missing') {
    return (
      <View style={{ gap: 12 }}>
        <KnowledgeArt refName="unknown" />
        <Txt ref={titleRef} variant="title" accessibilityRole="header">
          Content coming soon
        </Txt>
        <Txt tone="muted">There is no reviewed card for this illustration yet.</Txt>
      </View>
    );
  }
  const c = view.record.content;
  return (
    <View style={{ gap: 12 }}>
      <KnowledgeArt refName={c.illustration.ref} label={c.illustration.alt} size={104} />
      <Txt ref={titleRef} variant="title" accessibilityRole="header">
        {c.title}
      </Txt>
      {c.is_placeholder ? <Banner tone="warning" title={PLACEHOLDER_NOTICE} /> : null}
      <Txt tone="secondary">{c.summary}</Txt>
      {c.blocks.map((b, i) =>
        b.type === 'paragraph' ? (
          <Txt key={i}>{b.text}</Txt>
        ) : (
          <View key={i} style={{ gap: 4 }}>
            {b.items.map((it, j) => (
              <Txt key={j}>{`•  ${it}`}</Txt>
            ))}
          </View>
        ),
      )}
      {c.sources.length ? (
        <View style={{ gap: 6 }}>
          <Txt variant="bodyStrong" accessibilityRole="header">
            Sources
          </Txt>
          {c.sources.map((s) => (
            <Pressable key={s.url} accessibilityRole="link" onPress={() => Linking.openURL(s.url)} style={{ minHeight: 44, justifyContent: 'center' }}>
              <Txt tone="secondary" style={{ textDecorationLine: 'underline' }}>
                {s.title}
              </Txt>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
