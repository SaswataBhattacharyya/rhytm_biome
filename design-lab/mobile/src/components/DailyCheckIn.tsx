/**
 * Connected daily check-in (Relay 05; recovery fixes in Relay 06).
 *
 * Dates come from the profile timezone (AccountMeta: GET /v1/me, or the
 * timezone remembered in secure storage while the profile can't be verified;
 * re-verified on reconnect, which clears the offline warning). Each save goes
 * through the persisted outbox; the account's confirmed copy of each date is
 * held by the DayReader (late responses dropped). The screen shows:
 *   saved     — the account copy, with its revision
 *   pending   — stored on this device with its idempotency key, not confirmed
 *   conflict  — 409; an explicit choice is required, and ordinary saves for
 *               that date are disabled until it is made (other dates work)
 *   blocked   — consent needed; rejected — the service refused the edit
 * A failed request is never shown as saved. "Use the account version" reads
 * the account copy (no write) and only then drops the device edit.
 *
 * Routine and symptom inputs remain specimen areas (reviewer mode).
 */
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import {
  MOODS,
  addDays,
  buildLogInput,
  formatDay,
  localDateIn,
  moodOf,
  type DailyLog,
  type DayView,
  type PilotMood,
  type QueuedCheckIn,
} from '@rb-lab/shared';
import { describeError, useDaily } from '../data/DailyProvider';
import { useAppTheme } from '../theme/ThemeProvider';
import { Banner, Button, Card, Chip, ListRow, Screen, SectionTitle, Txt, s } from './ui';

const moodLabel = (m: string | null) => MOODS.find((x) => x.id === m)?.label ?? 'No mood';
const describeLog = (log: DailyLog) =>
  `${log.status === 'complete' ? moodLabel(moodOf(log)) : 'Partial (no mood)'} · revision ${log.revision}`;

export function DailyCheckIn() {
  const daily = useDaily();
  const { session } = daily;
  if (!daily.ready) {
    return (
      <Screen>
        <Txt variant="display" accessibilityRole="header">
          Today&apos;s check-in
        </Txt>
        <Txt tone="muted" accessibilityLiveRegion="polite">
          Checking your session…
        </Txt>
      </Screen>
    );
  }
  // Keyed by account: switching accounts never carries drafts or views over.
  if (session.status === 'signedIn' && session.userId) return <SignedInLog key={session.userId} />;
  return <SignedOutLog />;
}

function BackendLine() {
  const { backend, persistent } = useDaily();
  return (
    <View style={{ gap: 6 }}>
      <Txt variant="caption" tone="muted">
        {backend.mode === 'connected' ? `Connected · synthetic pilot (${backend.label})` : 'Fixture preview · not connected to an account'}
      </Txt>
      {!persistent ? (
        <Banner
          tone="warning"
          title="Secure storage unavailable"
          body="Your session and unsent check-ins stay in memory only and won’t survive closing the app."
        />
      ) : null}
    </View>
  );
}

function SignedOutLog() {
  const { session, queue } = useDaily();
  const { reviewer } = useAppTheme();
  return (
    <Screen>
      <Txt variant="display" accessibilityRole="header">
        Today&apos;s check-in
      </Txt>
      <BackendLine />
      {session.status === 'expired' ? (
        <Banner
          tone="warning"
          title="Your session ended"
          body={
            queue.length
              ? `${queue.length} check-in${queue.length > 1 ? 's are' : ' is'} waiting on this device. Sign in again as ${session.email ?? 'the same account'} to send ${queue.length > 1 ? 'them' : 'it'}.`
              : 'Sign in again to record check-ins.'
          }
        />
      ) : null}
      <Card>
        <Txt variant="heading">Sign in to check in</Txt>
        <Txt tone="muted">Your check-ins are saved to your synthetic pilot account and appear in Progress on the web.</Txt>
        <Button label="Sign in" onPress={() => router.push('/sign-in')} />
      </Card>
      {reviewer ? (
        <ListRow title="Specimen Log states" detail="Reviewer mode · routine, symptoms and design states" onPress={() => router.push('/log-specimen')} />
      ) : null}
    </Screen>
  );
}

function SignedInLog() {
  const daily = useDaily();
  const { meta, reader, queue, dayTick, onlineTick } = daily;
  const { reviewer } = useAppTheme();
  const tz = meta.timezone;
  const [date, setDate] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ mood: PilotMood | null; baseRevision: number | null }>({ mood: null, baseRevision: null });
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const today = tz ? localDateIn(tz) : null;
  const todayDate = today?.date ?? null;
  const days = useMemo(() => (todayDate ? Array.from({ length: 7 }, (_, i) => addDays(todayDate, -i)) : []), [todayDate]);
  useEffect(() => {
    if (todayDate && !date) setDate(todayDate);
  }, [todayDate, date]);

  // Account copy of the selected date: (re)fetched on date change and after
  // reconnect. The reader drops responses for superseded requests.
  useEffect(() => {
    if (reader && date) void reader.refresh(date);
  }, [reader, date, onlineTick]);

  // dayTick is the re-render trigger for reader updates.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const view: DayView | undefined = useMemo(() => (date && reader ? reader.view(date) : undefined), [reader, date, dayTick]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const serverLog: DailyLog | null | undefined = useMemo(() => (date && reader ? reader.confirmed(date) : undefined), [reader, date, dayTick]);
  const item: QueuedCheckIn | null = date ? queue.find((q) => q.localDate === date) ?? null : null;
  const conflict = item?.state === 'conflict';
  const currentBase = item?.input.base_revision ?? serverLog?.revision ?? 0;

  // Draft follows the device edit, then the account copy — unless the user
  // has picked a mood for this date that hasn't been saved yet. Changing date
  // or a queue transition (save, keep mine, use account version) resets it.
  useEffect(() => {
    setDraft({ mood: item ? moodOf(item.input) : moodOf(serverLog ?? null), baseRevision: null });
    setActionError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, item?.id, item?.state]);
  useEffect(() => {
    setDraft((d) => (d.baseRevision !== null ? d : { mood: item ? moodOf(item.input) : moodOf(serverLog ?? null), baseRevision: null }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverLog?.revision]);

  const save = async (withMood: PilotMood | null) => {
    if (!date || !tz || conflict) return;
    setBusy(true);
    setActionError(null);
    try {
      // A background read must not advance the revision an edit started from.
      const base = draft.baseRevision ?? currentBase;
      // Edits keep the day's original timezone (API rule).
      await daily.save(date, buildLogInput({ baseRevision: base, timezone: serverLog?.timezone ?? tz, mood: withMood }));
    } catch (e) {
      setActionError(describeError(e).text);
    } finally {
      setBusy(false);
    }
  };

  const grant = async () => {
    setBusy(true);
    try {
      await daily.grantConsent();
    } catch (e) {
      setActionError(describeError(e).text);
    } finally {
      setBusy(false);
    }
  };

  const unchanged =
    !item && !!serverLog && moodOf(serverLog) === draft.mood && serverLog.status === (draft.mood ? 'complete' : 'partial');
  const footer =
    tz && date && meta.consent !== 'missing' ? (
      <View style={{ gap: 8 }}>
        {conflict ? (
          <Txt variant="caption" tone="muted" accessibilityLiveRegion="polite">
            Choose which check-in to keep for {formatDay(date)} before saving it again.
          </Txt>
        ) : null}
        <Button
          label={serverLog || item ? 'Save changes' : 'Save check-in'}
          onPress={() => save(draft.mood)}
          disabled={conflict || !draft.mood || busy || unchanged}
          loading={busy}
          accessibilityHint={conflict ? 'Unavailable until you choose a version above' : draft.mood ? 'Saves to this device first, then to your account' : 'Choose a mood first'}
        />
        <Button label="Save without mood (partial)" kind="quiet" onPress={() => save(null)} disabled={conflict || busy} />
      </View>
    ) : undefined;

  return (
    <Screen footer={footer}>
      <View style={{ gap: 4 }}>
        <Txt variant="display" accessibilityRole="header">
          {date && todayDate && date !== todayDate ? 'Check-in' : 'Today’s check-in'}
        </Txt>
        <Txt tone="muted">
          {date ? formatDay(date) : '…'}
          {tz ? ` · ${tz}` : ''}
        </Txt>
      </View>
      <BackendLine />
      <ProfileNotice />
      {today && !today.exact ? <Banner tone="warning" title="Device date in use" body="This device can’t read your profile timezone; dates may differ near midnight." /> : null}

      {meta.consent === 'missing' || item?.state === 'blocked' ? (
        <Card>
          <Txt variant="heading">Turn on synthetic daily logging</Txt>
          <Txt tone="muted">The pilot stores check-ins only after you allow synthetic daily logging (notice demo-1). You can still look around without it.</Txt>
          <Button label="Allow synthetic logging" onPress={grant} loading={busy} />
        </Card>
      ) : null}

      {days.length ? (
        <View style={{ gap: 8 }}>
          <SectionTitle>Day</SectionTitle>
          <View style={s.row} accessibilityRole="radiogroup" accessibilityLabel="Day to check in">
            {days.map((d, i) => (
              <Chip key={d} label={i === 0 ? 'Today' : i === 1 ? 'Yesterday' : formatDay(d)} selected={d === date} onPress={() => setDate(d)} />
            ))}
          </View>
        </View>
      ) : null}

      {date ? <DayStatus date={date} item={item} view={view} /> : null}

      {conflict && item ? <Reconcile item={item} /> : null}

      {item?.state === 'rejected' ? (
        <Banner tone="danger" title="Not saved" body={item.lastError?.message ?? 'The service refused this check-in.'}>
          <Button label="Discard this edit" kind="secondary" onPress={() => daily.discard(item.id)} style={{ marginTop: 8 }} />
        </Banner>
      ) : null}

      {actionError ? <Banner tone="danger" title="Couldn’t save" body={actionError} /> : null}

      <View style={{ gap: 8 }}>
        <SectionTitle>Mood</SectionTitle>
        <View style={s.row} accessibilityRole="radiogroup" accessibilityLabel="Mood">
          {MOODS.map((m) => (
            <Chip
              key={m.id}
              label={m.label}
              selected={draft.mood === m.id}
              onPress={() =>
                setDraft((d) => ({
                  mood: d.mood === m.id ? null : (m.id as PilotMood),
                  baseRevision: d.baseRevision ?? currentBase,
                }))
              }
            />
          ))}
        </View>
        <Txt variant="caption" tone="muted">
          A complete check-in has a mood. Saving without one records a partial day — never a zero.
        </Txt>
      </View>

      <Txt variant="caption" tone="muted">
        Routine and symptoms aren’t part of the pilot yet.
      </Txt>
      {reviewer ? (
        <ListRow title="Specimen Log states" detail="Reviewer mode · routine, symptoms and design states" onPress={() => router.push('/log-specimen')} />
      ) : null}
    </Screen>
  );
}

/** Profile verification state: cached-timezone warning clears once the service confirms it. */
function ProfileNotice() {
  const daily = useDaily();
  const { meta } = daily;
  const [busy, setBusy] = useState(false);
  const retry = async () => {
    setBusy(true);
    try {
      await daily.retry();
    } finally {
      setBusy(false);
    }
  };
  if (meta.tzSource === 'server') return null;
  if (meta.tzSource === 'cached') {
    return (
      <Banner tone="warning" title="Profile not verified" body="Using your last known profile timezone until the service can be reached.">
        <Button label="Check again" kind="secondary" onPress={retry} loading={busy} style={{ marginTop: 8 }} />
      </Banner>
    );
  }
  if (meta.status === 'offline' || meta.status === 'error') {
    return (
      <Banner tone="warning" title="Couldn’t load your profile" body={meta.status === 'offline' ? 'You’re offline or the service can’t be reached.' : 'Try again shortly.'}>
        <Button label="Try again" kind="secondary" onPress={retry} loading={busy} style={{ marginTop: 8 }} />
      </Banner>
    );
  }
  return (
    <Txt tone="muted" accessibilityLiveRegion="polite">
      Loading your profile…
    </Txt>
  );
}

function DayStatus({ date, item, view }: { date: string; item: QueuedCheckIn | null; view: DayView | undefined }) {
  const daily = useDaily();
  if (item?.state === 'pending') {
    const offline = item.lastError?.kind === 'network' || daily.connectivity === 'offline';
    const expired = daily.lastFlush?.kind === 'expired';
    const retrying = !offline && !expired && item.attempts > 0 && !!item.lastError;
    return (
      <View accessibilityLiveRegion="polite">
        <Banner
          tone="warning"
          title="Pending — not saved to your account yet"
          body={
            expired
              ? `${moodLabel(moodOf(item.input))} is stored on this device. Sign in again to send it.`
              : offline
                ? `${moodLabel(moodOf(item.input))} is ${daily.persistent ? 'stored securely on this device' : 'held in memory on this device'} and will be sent when you’re back online.`
                : retrying
                  ? `${moodLabel(moodOf(item.input))} is stored on this device. The service didn’t respond; it will retry.`
                  : `Sending ${moodLabel(moodOf(item.input))}…`
          }
        >
          {(offline || retrying) && !expired ? <Button label="Retry now" kind="secondary" onPress={() => daily.retry()} style={{ marginTop: 8 }} /> : null}
          {expired ? <Button label="Sign in again" kind="secondary" onPress={() => router.push('/sign-in')} style={{ marginTop: 8 }} /> : null}
        </Banner>
      </View>
    );
  }
  if (item) return null; // conflict / blocked / rejected have their own cards
  if (!view || view.s === 'loading') {
    return (
      <Txt tone="muted" accessibilityLiveRegion="polite">
        Checking your account for this day…
      </Txt>
    );
  }
  if (view.s === 'error' && view.last === undefined) {
    const why = view.kind === 'network' ? 'You’re offline or the service can’t be reached.' : 'The service didn’t respond.';
    return (
      <Banner tone="warning" title="Couldn’t check your account" body={`${why} You can still save; it will be sent when possible.`}>
        <Button label="Check again" kind="secondary" onPress={() => daily.reader?.refresh(date)} style={{ marginTop: 8 }} />
      </Banner>
    );
  }
  const log = view.s === 'ok' ? view.log : view.last ?? null;
  if (!log) {
    return (
      <Txt tone="muted" accessibilityLiveRegion="polite">
        No check-in for this day yet.
      </Txt>
    );
  }
  return (
    <View accessibilityLiveRegion="polite">
      <Banner tone="success" title="Saved to your account" body={`${describeLog(log)}${log.retrospective ? ' · added later' : ''}`} />
    </View>
  );
}

function Reconcile({ item }: { item: QueuedCheckIn }) {
  const daily = useDaily();
  const [busy, setBusy] = useState<'mine' | 'theirs' | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const theirs = item.server;
  const why =
    item.lastError?.code === 'IDEMPOTENCY_CONFLICT'
      ? 'This change clashed with an earlier request.'
      : 'This day was changed somewhere else after you started editing.';
  const keepMine = async () => {
    setBusy('mine');
    setFailed(null);
    try {
      await daily.keepMine(item.id);
    } catch (e) {
      setFailed(describeError(e).text);
    } finally {
      setBusy(null);
    }
  };
  const useTheirs = async () => {
    setBusy('theirs');
    setFailed(null);
    try {
      await daily.useAccountVersion(item.id);
    } catch (e) {
      setFailed(`Couldn’t load the account version. ${describeError(e).text} Your edit is still here.`);
    } finally {
      setBusy(null);
    }
  };
  return (
    <Card accent="#FAD15C">
      <Txt variant="heading" accessibilityRole="header">
        Choose which check-in to keep
      </Txt>
      <Txt tone="muted">{why} Nothing has been overwritten.</Txt>
      <View style={{ gap: 4 }}>
        <Txt variant="bodyStrong">Your edit (on this device)</Txt>
        <Txt>{moodLabel(moodOf(item.input))}</Txt>
      </View>
      <View style={{ gap: 4 }}>
        <Txt variant="bodyStrong">On your account</Txt>
        <Txt>{theirs ? describeLog(theirs) : 'Not loaded yet — choosing it loads the latest copy first.'}</Txt>
      </View>
      {failed ? <Banner tone="danger" title="Still waiting for your choice" body={failed} /> : null}
      <Button
        label="Keep my edit"
        loading={busy === 'mine'}
        disabled={!!busy}
        accessibilityHint="Applies your edit on top of the account version"
        onPress={keepMine}
      />
      <Button
        label={failed ? 'Try the account version again' : 'Use the account version'}
        kind="secondary"
        loading={busy === 'theirs'}
        disabled={!!busy}
        accessibilityHint="Loads the account version and discards your edit on this device"
        onPress={useTheirs}
      />
    </Card>
  );
}
