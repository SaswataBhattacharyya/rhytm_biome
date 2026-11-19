/**
 * Specimen Log — S19 design states (moved from app/(tabs)/log.tsx in Relay 05).
 * Still reachable with ?state= deep links and from reviewer mode; the
 * connected daily check-in lives in DailyCheckIn.tsx.
 *
 * Original notes: Quick, forgiving daily check-in.
 * States: empty · partial · entered · demo acknowledgement · offline/pending · conflict.
 *
 * Truthfulness rules (D0_FIXTURE_EXPECTATIONS):
 *  - "Not recorded" (undefined) is different from "None" (absent symptom).
 *  - Nothing is sent anywhere. Entries live in component memory only and are
 *    cleared when the app restarts. Feedback says "recorded in this demo".
 *  - Offline is simulated; no durable/encrypted outbox is claimed.
 * Deep links: rhythmbiome-d0://log?state=conflict, rhythmbiome-d0://log?mood=good
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import {
  DEMO_ROUTINE,
  DEMO_SYMPTOMS,
  DOSE_ANSWERS,
  EXAMPLE_DATES,
  LOG_CONFLICT_OTHER,
  LOG_FIXTURES,
  LOG_STATES,
  MOODS,
  SEVERITIES,
  draftCompleteness,
  type LogDraft,
  type LogState,
  type Mood,
} from '@rb-lab/shared';
import { Banner, Button, Card, Chip, Screen, SectionTitle, StateSwitcher, Txt, s } from './ui';
import { F, useAppTheme } from '../theme/ThemeProvider';

const isLogState = (v: unknown): v is LogState => LOG_STATES.some((st) => st.id === v);
const isMood = (v: unknown): v is Mood => MOODS.some((m) => m.id === v);

type Phase = 'editing' | 'acknowledged' | 'pending' | 'conflict' | 'resolved';

function phaseFor(state: LogState): Phase {
  if (state === 'acknowledged') return 'acknowledged';
  if (state === 'conflict') return 'conflict';
  return 'editing';
}

export function SpecimenLog() {
  const params = useLocalSearchParams<{ state?: string; mood?: string }>();
  const initial: LogState = isLogState(params.state) ? params.state : 'empty';
  const [state, setState] = useState<LogState>(initial);
  const [draft, setDraft] = useState<LogDraft>(LOG_FIXTURES[initial]);
  const [phase, setPhase] = useState<Phase>(phaseFor(initial));
  const [noteText, setNoteText] = useState('');
  const [resolution, setResolution] = useState<string | null>(null);

  const applyState = (st: LogState) => {
    setState(st);
    setDraft(LOG_FIXTURES[st]);
    setPhase(phaseFor(st));
    setResolution(null);
  };

  useEffect(() => {
    if (isLogState(params.state)) applyState(params.state);
  }, [params.state]);

  useEffect(() => {
    if (isMood(params.mood)) {
      setDraft((d) => ({ ...d, mood: params.mood as Mood }));
      setPhase('editing');
    }
  }, [params.mood]);

  const { recorded, total } = draftCompleteness(draft);
  const offline = state === 'offlinePending';

  const save = () => setPhase(offline ? 'pending' : 'acknowledged');

  const footer =
    phase === 'editing' ? (
      <View style={{ gap: 8 }}>
        <Txt variant="caption" tone="muted" accessibilityLiveRegion="polite">
          {recorded} of {total} recorded · unrecorded items stay missing, not zero
        </Txt>
        <Button
          label={offline ? 'Keep as pending (demo)' : 'Save check-in (demo)'}
          onPress={save}
          disabled={recorded === 0}
          accessibilityHint={recorded === 0 ? 'Record at least one item first' : 'Records this check-in in the demo only'}
        />
      </View>
    ) : undefined;

  return (
    <Screen footer={footer}>
      <StateSwitcher states={LOG_STATES} value={state} onChange={applyState} />
      <View style={{ gap: 4 }}>
        <Txt variant="display" accessibilityRole="header">
          Today&apos;s check-in
        </Txt>
        <Txt tone="muted">{EXAMPLE_DATES.todayLabel}</Txt>
      </View>

      {offline ? (
        <Banner
          tone="warning"
          title="You're offline (simulated)"
          body="This entry is held on this screen only and is not saved anywhere yet. The real app will queue it and sync when you're back online."
        />
      ) : null}

      {phase === 'acknowledged' ? <Acknowledged onEdit={() => setPhase('editing')} /> : null}
      {phase === 'pending' ? <PendingNotice onEdit={() => setPhase('editing')} /> : null}
      {phase === 'conflict' ? (
        <ConflictCard
          mine={draft}
          onKeepMine={() => {
            setResolution("Kept this device's version.");
            setPhase('resolved');
          }}
          onUseOther={() => {
            setDraft({ mood: LOG_CONFLICT_OTHER.mood, doses: LOG_CONFLICT_OTHER.doses, symptoms: LOG_CONFLICT_OTHER.symptoms });
            setResolution('Using the other version.');
            setPhase('resolved');
          }}
        />
      ) : null}
      {phase === 'resolved' ? (
        <Banner tone="success" title={resolution ?? 'Resolved'} body="Resolved in this demo only. Nothing was sent to a server.">
          <Button label="Review entry" kind="secondary" onPress={() => setPhase('editing')} style={{ marginTop: 8 }} />
        </Banner>
      ) : null}

      {phase === 'editing' ? <LogForm draft={draft} setDraft={setDraft} noteText={noteText} setNoteText={setNoteText} /> : null}
    </Screen>
  );
}

function LogForm({
  draft,
  setDraft,
  noteText,
  setNoteText,
}: {
  draft: LogDraft;
  setDraft: (fn: (d: LogDraft) => LogDraft) => void;
  noteText: string;
  setNoteText: (v: string) => void;
}) {
  const { colors } = useAppTheme();
  return (
    <>
      <SectionTitle>How are you?</SectionTitle>
      <View style={s.row} accessibilityRole="radiogroup" accessibilityLabel="Mood">
        {MOODS.map((m) => (
          <Chip
            key={m.id}
            label={m.label}
            selected={draft.mood === m.id}
            onPress={() => setDraft((d) => ({ ...d, mood: d.mood === m.id ? undefined : m.id }))}
          />
        ))}
      </View>

      <SectionTitle>Routine</SectionTitle>
      {DEMO_ROUTINE.map((r) => (
        <Card key={r.id}>
          <Txt variant="bodyStrong">{r.label}</Txt>
          <View style={s.row} accessibilityRole="radiogroup" accessibilityLabel={r.label}>
            {DOSE_ANSWERS.map((a) => (
              <Chip
                key={a.id}
                label={a.label}
                selected={draft.doses[r.id] === a.id}
                onPress={() =>
                  setDraft((d) => ({ ...d, doses: { ...d.doses, [r.id]: d.doses[r.id] === a.id ? undefined : a.id } }))
                }
              />
            ))}
          </View>
          <RecordedHint recorded={draft.doses[r.id] !== undefined} />
        </Card>
      ))}

      <SectionTitle>Symptoms</SectionTitle>
      <Txt variant="caption" tone="muted">
        Demo labels. Choose &quot;None&quot; if you didn&apos;t have it; leave blank if you&apos;d rather not say.
      </Txt>
      {DEMO_SYMPTOMS.map((sym) => (
        <Card key={sym.id}>
          <Txt variant="bodyStrong">{sym.label}</Txt>
          <View style={s.row} accessibilityRole="radiogroup" accessibilityLabel={sym.label}>
            {SEVERITIES.map((sv) => (
              <Chip
                key={sv.id}
                label={sv.label}
                selected={draft.symptoms[sym.id] === sv.id}
                onPress={() =>
                  setDraft((d) => ({
                    ...d,
                    symptoms: { ...d.symptoms, [sym.id]: d.symptoms[sym.id] === sv.id ? undefined : sv.id },
                  }))
                }
              />
            ))}
          </View>
          <RecordedHint recorded={draft.symptoms[sym.id] !== undefined} />
        </Card>
      ))}

      <SectionTitle>Optional note</SectionTitle>
      <TextInput
        value={noteText}
        onChangeText={setNoteText}
        placeholder="Anything else? (stays on this screen)"
        placeholderTextColor={colors.textMuted}
        multiline
        accessibilityLabel="Optional note. Stays on this screen in the demo."
        style={{
          minHeight: 96,
          borderRadius: 12,
          borderWidth: 1.5,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          color: colors.text,
          padding: 14,
          fontFamily: F.regular,
          fontSize: 16,
          textAlignVertical: 'top',
        }}
      />
    </>
  );
}

function RecordedHint({ recorded }: { recorded: boolean }) {
  return (
    <Txt variant="caption" tone="muted">
      {recorded ? 'Recorded · tap the selected answer again to clear' : 'Not recorded'}
    </Txt>
  );
}

function Acknowledged({ onEdit }: { onEdit: () => void }) {
  const { colors, motionOff } = useAppTheme();
  return (
    <Animated.View entering={motionOff ? undefined : FadeIn.duration(260)}>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Animated.View
            entering={motionOff ? undefined : ZoomIn.duration(320)}
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' }}
          >
            <Txt variant="title" style={{ color: colors.canvas }}>
              ✓
            </Txt>
          </Animated.View>
          <Txt variant="title" style={{ flex: 1 }} accessibilityLiveRegion="polite">
            Recorded in this demo
          </Txt>
        </View>
        <Txt tone="muted">
          Not sent to a server. This specimen keeps entries in memory only, so restarting the app clears them.
        </Txt>
        <Button label="Edit entry" kind="secondary" onPress={onEdit} />
        <Button label="View progress" kind="quiet" onPress={() => router.push('/progress')} />
      </Card>
    </Animated.View>
  );
}

function PendingNotice({ onEdit }: { onEdit: () => void }) {
  const { colors } = useAppTheme();
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1.5, borderColor: colors.warning }}>
          <Txt variant="label" tone="warning">
            Pending · not synced
          </Txt>
        </View>
      </View>
      <Txt variant="heading">Waiting for a connection</Txt>
      <Txt tone="muted">
        In this demo the entry exists only on this screen. It has not been saved on the device or sent anywhere.
      </Txt>
      <Button label="Edit entry" kind="secondary" onPress={onEdit} />
    </Card>
  );
}

function describe(d: LogDraft): string[] {
  const out: string[] = [];
  out.push(`Mood: ${d.mood ? MOODS.find((m) => m.id === d.mood)?.label : 'not recorded'}`);
  for (const r of DEMO_ROUTINE) {
    const v = d.doses[r.id];
    out.push(`${r.label}: ${v ? DOSE_ANSWERS.find((a) => a.id === v)?.label : 'not recorded'}`);
  }
  for (const sym of DEMO_SYMPTOMS) {
    const v = d.symptoms[sym.id];
    out.push(`${sym.label}: ${v ? SEVERITIES.find((x) => x.id === v)?.label : 'not recorded'}`);
  }
  return out;
}

function ConflictCard({ mine, onKeepMine, onUseOther }: { mine: LogDraft; onKeepMine: () => void; onUseOther: () => void }) {
  const { colors } = useAppTheme();
  const Col = ({ title, lines }: { title: string; lines: string[] }) => (
    <View style={{ flex: 1, minWidth: 220, gap: 6, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.border }}>
      <Txt variant="bodyStrong">{title}</Txt>
      {lines.map((l) => (
        <Txt key={l} variant="caption">
          {l}
        </Txt>
      ))}
    </View>
  );
  return (
    <Card accent={colors.warning}>
      <Txt variant="title">Two versions of today</Txt>
      <Txt tone="muted">Choose which one to keep. Nothing is merged without your choice.</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <Col title="This device" lines={describe(mine)} />
        <Col title={LOG_CONFLICT_OTHER.sourceLabel} lines={describe(LOG_CONFLICT_OTHER)} />
      </View>
      <Button label="Keep this device's version" onPress={onKeepMine} />
      <Button label="Use the other version" kind="secondary" onPress={onUseOther} />
    </Card>
  );
}
