import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { HOME_FIXTURES, HOME_STATES, type HomeState } from '@rb-lab/shared';
import { Icon, KnowledgeArt, MicrobeCluster } from '../../src/components/art';
import { Banner, Button, Card, Screen, Skeleton, StateSwitcher, Txt } from '../../src/components/ui';
import { useAppTheme } from '../../src/theme/ThemeProvider';

const isHomeState = (v: unknown): v is HomeState => HOME_STATES.some((st) => st.id === v);

export default function HomeScreen() {
  const params = useLocalSearchParams<{ state?: string }>();
  const [state, setState] = useState<HomeState>(isHomeState(params.state) ? params.state : 'pendingAction');
  const [note, setNote] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [recovered, setRecovered] = useState(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isHomeState(params.state)) setState(params.state);
  }, [params.state]);

  useEffect(() => {
    if (retryTimer.current) clearTimeout(retryTimer.current);
    setRetrying(false);
    setNote(null);
    setRecovered(false);
  }, [state]);

  useEffect(
    () => () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
    },
    [],
  );

  const retry = () => {
    setRetrying(true);
    retryTimer.current = setTimeout(() => {
      setRetrying(false);
      setRecovered(true);
    }, 900);
  };

  return (
    <Screen contentStyle={s.screen}>
      <StateSwitcher states={HOME_STATES} value={state} onChange={setState} />
      {state === 'loading' ? (
        <LoadingHome />
      ) : (
        <HomeBody state={state} note={note} setNote={setNote} retry={retry} retrying={retrying} recovered={recovered} />
      )}
    </Screen>
  );
}

function LoadingHome() {
  return (
    <View accessibilityLabel="Loading your home screen" accessibilityState={{ busy: true }} style={s.loading}>
      <Skeleton height={26} width="55%" />
      <Skeleton height={126} />
      <Skeleton height={64} />
      <Skeleton height={48} />
    </View>
  );
}

function HomeBody({
  state,
  note,
  setNote,
  retry,
  retrying,
  recovered,
}: {
  state: Exclude<HomeState, 'loading'>;
  note: string | null;
  setNote: (v: string | null) => void;
  retry: () => void;
  retrying: boolean;
  recovered: boolean;
}) {
  const { colors } = useAppTheme();
  const { width, fontScale } = useWindowDimensions();
  const stackShortcuts = width < 320 || fontScale > 1.25;
  const fx = HOME_FIXTURES[state];
  const next = fx.nextAction;
  const mainIsCheckIn = next?.cta === 'Start check-in';
  const onPrimary = () => {
    if (!next) return;
    if (mainIsCheckIn) router.push('/log');
    else if (next.cta === 'Explore tests') router.push({ pathname: '/explore', params: { section: 'catalogue' } });
    else setNote(next.demoNote);
  };
  const activeTest = fx.activeTest === 'error' && recovered ? HOME_FIXTURES.pendingAction.activeTest : fx.activeTest;
  const logged = fx.week ? fx.week.filter((d) => d.coverage !== 'missing').length : 0;

  return (
    <>
      <View style={s.greeting}>
        <Txt variant="title" accessibilityRole="header" style={s.greetingTitle}>
          Hello, {fx.greetingName}
        </Txt>
        <View accessible={false} importantForAccessibility="no-hide-descendants">
          <MicrobeCluster size={42} />
        </View>
      </View>

      {next ? (
        <Card style={s.primaryCard}>
          <View style={s.copy}>
            <Txt variant="heading" style={s.cardTitle}>{next.title}</Txt>
            <Txt variant="caption" tone="muted">{next.body}</Txt>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={next.cta}
            onPress={onPrimary}
            style={({ pressed }) => [
              s.primaryAction,
              { backgroundColor: colors.action },
              pressed && s.pressed,
            ]}
          >
            <Txt variant="bodyStrong" tone="onAction" style={s.shortcutTitle}>{next.cta}</Txt>
            <Chevron onAction />
          </Pressable>
          {note ? <Banner title="Preview only" body={note} /> : null}
          {activeTest && activeTest !== 'error' ? (
            <View style={[s.testStatus, { borderColor: colors.border }]}>
              <View style={[s.testDot, { backgroundColor: colors.warning }]} />
              <View style={s.copy}>
                <Txt variant="label" style={s.shortcutTitle}>{activeTest.title}</Txt>
                <Txt variant="caption" tone="muted">{activeTest.status}</Txt>
              </View>
            </View>
          ) : null}
        </Card>
      ) : null}

      {activeTest === 'error' ? (
        <Banner tone="danger" title="Your test status couldn't load" body="Simulated failure. The rest of Home still works.">
          <Button label="Retry" kind="secondary" onPress={retry} loading={retrying} style={s.retry} />
        </Banner>
      ) : null}

      <View style={[s.shortcuts, stackShortcuts && s.shortcutsStacked]}>
        {!mainIsCheckIn ? (
          <HomeShortcut
            title="Check in"
            detail="Mood & routine"
            icon={<Icon name="log" color={colors.textSecondary} size={20} />}
            onPress={() => router.push('/log')}
          />
        ) : null}

        {fx.week ? (
          <HomeShortcut
            title="Progress"
            detail={`${logged} of 7 days logged`}
            icon={<Icon name="progress" color={colors.textSecondary} size={20} />}
            onPress={() => router.push('/progress')}
          />
        ) : (
          <HomeShortcut
            title="Sample report"
            detail="Preview a report"
            icon={<Icon name="reports" color={colors.textSecondary} size={20} />}
            onPress={() => router.push({ pathname: '/reports', params: { state: 'syntheticLayout' } })}
          />
        )}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Meet the microbes"
        onPress={() => router.push({ pathname: '/explore', params: { section: 'learn' } })}
        style={({ pressed }) => [s.library, { borderColor: colors.border }, pressed && s.pressed]}
      >
        <KnowledgeArt refName="short_rod" size={34} />
        <View style={s.libraryCopy}>
          <Txt variant="bodyStrong" style={s.shortcutTitle}>Meet the microbes</Txt>
          <Txt variant="caption" tone="muted">Illustrated cards and short notes</Txt>
        </View>
        <Chevron />
      </Pressable>
    </>
  );
}

function HomeShortcut({ title, detail, icon, onPress }: { title: string; detail: string; icon: ReactNode; onPress: () => void }) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${detail}`}
      onPress={onPress}
      style={({ pressed }) => [s.shortcut, { borderColor: colors.border }, pressed && s.pressed]}
    >
      <View style={s.shortcutHeading}>
        {icon}
        <Txt variant="bodyStrong" style={s.shortcutTitle}>{title}</Txt>
      </View>
      <Txt variant="caption" tone="muted">{detail}</Txt>
    </Pressable>
  );
}

function Chevron({ onAction = false }: { onAction?: boolean }) {
  return (
    <Txt variant="heading" tone={onAction ? 'onAction' : 'muted'} accessible={false} importantForAccessibility="no">
      ›
    </Txt>
  );
}

const s = StyleSheet.create({
  screen: { gap: 12 },
  loading: { gap: 12 },
  greeting: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  greetingTitle: { flex: 1, includeFontPadding: false },
  primaryCard: { padding: 14, gap: 8 },
  copy: { flexShrink: 1, gap: 2 },
  cardTitle: { includeFontPadding: false },
  primaryAction: { alignSelf: 'flex-start', minHeight: 48, paddingHorizontal: 12, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  pressed: { opacity: 0.78 },
  testStatus: { borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 8, paddingTop: 8 },
  testDot: { width: 6, height: 6, marginTop: 7, borderRadius: 3 },
  retry: { alignSelf: 'flex-start', minHeight: 48, marginTop: 6 },
  shortcuts: { flexDirection: 'row', gap: 8 },
  shortcutsStacked: { flexDirection: 'column' },
  shortcut: { flexGrow: 1, flexBasis: 0, minHeight: 62, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 10, justifyContent: 'center', gap: 2 },
  shortcutHeading: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  shortcutTitle: { flexShrink: 1, fontSize: 15, lineHeight: 20, includeFontPadding: false },
  library: { borderTopWidth: StyleSheet.hairlineWidth, minHeight: 54, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  libraryCopy: { flex: 1, gap: 2 },
});
