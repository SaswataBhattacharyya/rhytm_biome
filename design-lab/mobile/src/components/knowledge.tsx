/**
 * Native "Meet the microbes" list + accessible "Did you know?" sheet
 * (34 LEARN-01/02, same content shape and transport as web).
 *
 *  - Modal with onRequestClose → Android Back closes it.
 *  - accessibilityViewIsModal; named Close button; screen-reader focus moves
 *    to the title on open and back to the opener on close.
 *  - NATIVE-SHEET-01: focus requests are coordinated with the sheet's
 *    lifecycle — the title is focused only after the Modal reports onShow and
 *    the content has settled; every pending request is cancelled when the
 *    sheet closes, reopens or unmounts, and the opener of the *current* card
 *    gets focus back after the dismissal. Requests go to the host view via
 *    AccessibilityInfo.sendAccessibilityEvent (no findNodeHandle).
 *  - Decorative motion is held while open and restored to the user's own
 *    choice afterwards.
 *  - Placeholder content is labelled; missing keys show "Content coming soon".
 */
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { AccessibilityInfo, Linking, Modal, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
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

/** After the slide-out finishes, so TalkBack lands on the opener, not the closing sheet. */
const RESTORE_DELAY_MS = 350;
/** After onShow + layout of the settled content. */
const TITLE_DELAY_MS = 120;

/**
 * Schedule a screen-reader focus move. Returns a cancel function; callers
 * return it from an effect so stale requests never fire after the state
 * that asked for them has changed.
 */
function focusLater(target: () => View | Text | null | undefined, delay: number): () => void {
  const id = setTimeout(() => {
    const node = target();
    if (node) AccessibilityInfo.sendAccessibilityEvent(node as Parameters<typeof AccessibilityInfo.sendAccessibilityEvent>[0], 'focus');
  }, delay);
  return () => clearTimeout(id);
}

export function MeetMicrobes() {
  const transport = getDemoKnowledgeTransport();
  const { colors, reviewer } = useAppTheme();
  const [items, setItems] = useState<DemoKnowledgeRecord[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [openKey, setOpenKey] = useState<string | null>(null);
  /** Key of the row that opened the current (or last) card. */
  const [openerKey, setOpenerKey] = useState<string | null>(null);
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

  const open = (key: string) => {
    setOpenerKey(key);
    setOpenKey(key);
  };

  // Idempotent: Back, the backdrop and Close can all fire for one dismissal.
  const onClosed = useCallback(() => setOpenKey(null), []);

  // Restore focus to the current opener once the sheet is gone. Re-opening
  // (or unmounting) before the delay cancels the request.
  useEffect(() => {
    if (openKey !== null || openerKey === null) return;
    return focusLater(() => refs.current.get(openerKey), RESTORE_DELAY_MS);
  }, [openKey, openerKey]);

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
              onPress={() => open(r.content.key)}
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
          {reviewer ? (
            <Pressable
              ref={(node) => {
                refs.current.set(DEMO_MISSING_KEY, node);
              }}
              accessibilityRole="button"
              accessibilityLabel="Reviewer check: open a card with no content yet"
              onPress={() => open(DEMO_MISSING_KEY)}
              style={{ minHeight: 48, justifyContent: 'center', borderTopWidth: 1, borderStyle: 'dashed', borderColor: colors.border }}
            >
              <Txt variant="caption" tone="muted">
                Reviewer check (synthetic): open a card with no content yet
              </Txt>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <KnowledgeSheet cardKey={openKey} onClosed={onClosed} />
    </View>
  );
}

export function KnowledgeSheet({ cardKey, onClosed }: { cardKey: string | null; onClosed: () => void }) {
  const { colors, motionOff, holdMotion } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height: windowH } = useWindowDimensions();
  const [view, setView] = useState<View_>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);
  /** True between the Modal's onShow and the sheet closing. */
  const [shown, setShown] = useState(false);
  const titleRef = useRef<Text>(null);
  const visible = cardKey !== null;

  useEffect(() => {
    if (!visible) setShown(false);
  }, [visible]);

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

  // Move screen-reader focus to the title only when the sheet is on screen
  // (onShow) and its content has settled; a change of card, a retry or a
  // close cancels the pending request.
  useEffect(() => {
    if (!visible || !shown || 'state' in view) return;
    return focusLater(() => titleRef.current, TITLE_DELAY_MS);
  }, [visible, shown, view]);

  // Keep the sheet clear of the status bar even with large text.
  const maxHeight = Math.min(windowH * 0.88, windowH - insets.top - 24);

  return (
    <Modal
      visible={visible}
      transparent
      animationType={motionOff ? 'none' : 'slide'}
      onRequestClose={onClosed}
      onShow={() => setShown(true)}
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
            maxHeight,
            backgroundColor: colors.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            borderWidth: 1,
            borderColor: colors.border,
            paddingBottom: insets.bottom + 16,
          }}
        >
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 20, paddingTop: 12 }}>
            <Txt variant="label" tone="secondary" style={{ flexShrink: 1 }}>
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
