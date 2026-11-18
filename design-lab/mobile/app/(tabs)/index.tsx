/**
 * Home — S04. One primary next action, quick check-in, then routine, coverage,
 * active test. States: first visit · pending test action · loading · partial failure.
 * Deep link for review: rhythmbiome-d0://?state=partialFailure
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import {
  HOME_FIXTURES,
  HOME_STATES,
  MOODS,
  type DayCoverage,
  type HomeState,
} from '@rb-lab/shared';
import { MicrobeCluster } from '../../src/components/art';
import { MeetMicrobes } from '../../src/components/knowledge';
import { Banner, Button, Card, Chip, Screen, SectionTitle, Skeleton, StateSwitcher, Txt, s } from '../../src/components/ui';
import { useAppTheme } from '../../src/theme/ThemeProvider';

const isHomeState = (v: unknown): v is HomeState => HOME_STATES.some((st) => st.id === v);

export default function HomeScreen() {
  const params = useLocalSearchParams<{ state?: string }>();
  const [state, setState] = useState<HomeState>(isHomeState(params.state) ? params.state : 'pendingAction');
  const [note, setNote] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [recovered, setRecovered] = useState(false);

  useEffect(() => {
    if (isHomeState(params.state)) setState(params.state);
  }, [params.state]);

  useEffect(() => {
    setNote(null);
    setRecovered(false);
  }, [state]);

  const retry = () => {
    setRetrying(true);
    setTimeout(() => {
      setRetrying(false);
      setRecovered(true);
    }, 900);
  };

  return (
    <Screen>
      <StateSwitcher states={HOME_STATES} value={state} onChange={setState} />
      {state === 'loading' ? (
        <LoadingHome />
      ) : (
        <HomeBody
          state={state}
          note={note}
          setNote={setNote}
          retry={retry}
          retrying={retrying}
          recovered={recovered}
        />
      )}
    </Screen>
  );
}

function LoadingHome() {
  return (
    <View accessibilityLabel="Loading your home screen" accessibilityState={{ busy: true }} style={{ gap: 16 }}>
      <Skeleton height={34} width="60%" />
      <Card>
        <Skeleton height={22} width="70%" />
        <Skeleton height={16} />
        <Skeleton height={52} />
      </Card>
      <Card>
        <Skeleton height={20} width="40%" />
        <Skeleton height={48} />
      </Card>
      <Txt variant="caption" tone="muted">
        Loading (synthetic). Sections appear as soon as each one is ready.
      </Txt>
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
  const fx = HOME_FIXTURES[state];
  const next = fx.nextAction;
  const onPrimary = () => {
    if (!next) return;
    if (next.cta === 'Start check-in') router.push('/log');
    else if (next.cta === 'Explore tests') router.push('/explore');
    else setNote(next.demoNote);
  };
  const activeTest = fx.activeTest === 'error' && recovered ? HOME_FIXTURES.pendingAction.activeTest : fx.activeTest;

  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Txt variant="caption" tone="muted">
            Thu 15 Jan (example date)
          </Txt>
          <Txt variant="display" accessibilityRole="header">
            Hello, {fx.greetingName}
          </Txt>
        </View>
        <MicrobeCluster size={96} />
      </View>

      {next ? (
        <Card>
          <Txt variant="title">{next.title}</Txt>
          <Txt tone="muted">{next.body}</Txt>
          <Button label={next.cta} onPress={onPrimary} />
          {note ? <Banner title="Not in this specimen" body={note} /> : null}
        </Card>
      ) : null}

      <SectionTitle>How are you today?</SectionTitle>
      <View style={s.row}>
        {MOODS.map((m) => (
          <Chip
            key={m.id}
            label={m.label}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/log', params: { mood: m.id } })}
          />
        ))}
      </View>

      {fx.routineChips.length ? (
        <>
          <SectionTitle>Routine</SectionTitle>
          <View style={s.row}>
            {fx.routineChips.map((r) => (
              <Chip key={r.id} label={r.label} accessibilityRole="button" onPress={() => router.push('/log')} />
            ))}
          </View>
        </>
      ) : null}

      {fx.week ? (
        <>
          <SectionTitle>Last 7 days</SectionTitle>
          <WeekCoverage week={fx.week} />
        </>
      ) : (
        <StarterTasks />
      )}

      {activeTest === 'error' ? (
        <Banner tone="danger" title="Your test status couldn't load" body="Simulated failure. The rest of Home still works.">
          <Button label="Retry" kind="secondary" onPress={retry} loading={retrying} style={{ marginTop: 8 }} />
        </Banner>
      ) : activeTest ? (
        <>
          <SectionTitle>Active test</SectionTitle>
          <Card accent="#FAD15C">
            <Txt variant="heading">{activeTest.title}</Txt>
            <Txt>{activeTest.status}</Txt>
            <Txt variant="caption" tone="muted">
              {activeTest.updatedLabel}
            </Txt>
          </Card>
        </>
      ) : null}

      <MeetMicrobes />
    </>
  );
}

function WeekCoverage({ week }: { week: { day: string; coverage: DayCoverage }[] }) {
  const { colors } = useAppTheme();
  const label: Record<DayCoverage, string> = { recorded: 'Logged', partial: 'Partly logged', missing: 'Not logged' };
  return (
    <Card>
      <View
        style={{ flexDirection: 'row', justifyContent: 'space-between' }}
        accessible
        accessibilityLabel={week.map((d) => `${d.day}: ${label[d.coverage]}`).join(', ')}
      >
        {week.map((d) => (
          <View key={d.day} style={{ alignItems: 'center', gap: 6 }}>
            <View
              style={{
                width: 30,
                height: 30,
                borderRadius: 15,
                borderWidth: 2,
                borderColor: colors.textSecondary,
                borderStyle: d.coverage === 'missing' ? 'dashed' : 'solid',
                backgroundColor: d.coverage === 'recorded' ? colors.textSecondary : 'transparent',
                overflow: 'hidden',
              }}
            >
              {d.coverage === 'partial' ? <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 13, backgroundColor: colors.textSecondary }} /> : null}
            </View>
            <Txt variant="caption" tone="muted">
              {d.day}
            </Txt>
          </View>
        ))}
      </View>
      <Txt variant="caption" tone="muted">
        Filled = logged · half = partly logged · dashed = not logged. Self-reported coverage only, not a health score.
      </Txt>
    </Card>
  );
}

function StarterTasks() {
  return (
    <>
      <SectionTitle>Get started</SectionTitle>
      <Card>
        <Txt variant="bodyStrong">Try a daily check-in</Txt>
        <Txt tone="muted">Takes under a minute. Days you skip stay visibly missing.</Txt>
        <Button label="Open Log" kind="secondary" onPress={() => router.push('/log')} />
      </Card>
      <Card>
        <Txt variant="bodyStrong">See what a report contains</Txt>
        <Txt tone="muted">A synthetic layout shows the sections without real data.</Txt>
        <Button
          label="Open Reports"
          kind="secondary"
          onPress={() => router.push({ pathname: '/reports', params: { state: 'syntheticLayout' } })}
        />
      </Card>
    </>
  );
}
