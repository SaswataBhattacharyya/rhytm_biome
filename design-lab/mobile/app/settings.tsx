/**
 * Profile and display settings. Light / Dark / System and Pause motion are UI
 * preferences stored locally; they contain no health data.
 */
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CATALOG_SCENARIOS, CATALOG_SECTIONS, type CatalogSectionKey, type ThemePreference } from '@rb-lab/shared';
import { useCatalog } from '../src/data/CatalogProvider';
import { useDaily } from '../src/data/DailyProvider';
import { Button, Card, Chip, Txt, s } from '../src/components/ui';
import { useAppTheme } from '../src/theme/ThemeProvider';

const MODES: { id: ThemePreference; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System' },
];

export default function Settings() {
  const { pref, setPref, paused, setPaused, reducedMotion, reviewer, setReviewer, colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={{ backgroundColor: colors.canvas }} contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: insets.bottom + 32 }}>
      <AccountCard />

      <Card>
        <Txt variant="heading" accessibilityRole="header">
          Theme
        </Txt>
        <View style={s.row} accessibilityRole="radiogroup" accessibilityLabel="Theme">
          {MODES.map((m) => (
            <Chip key={m.id} label={m.label} selected={pref === m.id} onPress={() => setPref(m.id)} />
          ))}
        </View>
      </Card>

      <Card>
        <Txt variant="heading" accessibilityRole="header">
          Motion
        </Txt>
        <Switch label="Pause decorative motion" checked={paused} onToggle={() => setPaused(!paused)} />
        <Txt variant="caption" tone="muted">
          {reducedMotion
            ? 'Your device asks for reduced motion, so illustrations stay still.'
            : 'Illustrations move gently. Turn on Pause, or reduce motion in system settings, to keep them still.'}
        </Txt>
      </Card>

      <Card>
        <Txt variant="heading" accessibilityRole="header">
          Reviewer tools
        </Txt>
        <Switch label="Reviewer mode" checked={reviewer} onToggle={() => setReviewer(!reviewer)} />
        {reviewer ? <CatalogReviewTools /> : null}
        <Txt variant="caption" tone="muted">
          Shows synthetic state switchers on Home, Log and Reports, the deliberate empty-card check in Explore, and catalogue fixture scenarios and section switches. For design
          review only; also available with the link rhythmbiome-d0://?reviewer=1.
        </Txt>
      </Card>

      <Card>
        <Txt variant="heading" accessibilityRole="header">
          About this build
        </Txt>
        <Txt variant="caption" tone="muted">
          Rhythm Biome D0 design specimen · synthetic data only · nothing is sent to a server.
        </Txt>
        <Txt variant="data" tone="muted">
          {Constants.expoConfig?.android?.package ?? 'com.rhythmbiome.d0specimen'} · v{Constants.expoConfig?.version ?? '0.0.1'}
        </Txt>
      </Card>
    </ScrollView>
  );
}

/** Accessible on/off switch row (≥48dp). */
function Switch({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      onPress={onToggle}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 }}
    >
      <View style={{ width: 48, height: 28, borderRadius: 14, padding: 3, backgroundColor: checked ? colors.action : colors.border }}>
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: checked ? colors.onAction : colors.surfaceRaised,
            transform: [{ translateX: checked ? 20 : 0 }],
          }}
        />
      </View>
      <Txt variant="bodyStrong" style={{ flexShrink: 1 }}>
        {label}
      </Txt>
    </Pressable>
  );
}

/** Relay 05: synthetic account, connection mode and sign-out (wipes this account's local data). */
function AccountCard() {
  const daily = useDaily();
  const [busy, setBusy] = useState(false);
  const { session, queue, backend, persistent } = daily;
  const signedIn = session.status === 'signedIn';
  const doSignOut = async () => {
    setBusy(true);
    try {
      await daily.signOut();
    } finally {
      setBusy(false);
    }
  };
  const confirmSignOut = () => {
    if (!queue.length) {
      void doSignOut();
      return;
    }
    const n = queue.length;
    Alert.alert(
      'Sign out and delete unsent check-ins?',
      `${n} check-in${n > 1 ? 's haven’t' : ' hasn’t'} reached your account yet. Signing out deletes ${n > 1 ? 'them' : 'it'} from this device.`,
      [
        { text: 'Stay signed in', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: () => void doSignOut() },
      ],
    );
  };
  return (
    <Card>
      <Txt variant="heading" accessibilityRole="header">
        Account
      </Txt>
      <Txt variant="caption" tone="muted">
        {backend.mode === 'connected' ? `Connected · synthetic pilot (${backend.label})` : 'Fixture preview · not connected to an account'}
        {persistent ? '' : ' · secure storage unavailable'}
      </Txt>
      {signedIn ? (
        <>
          <Txt variant="bodyStrong">{session.email}</Txt>
          {queue.length ? (
            <Txt variant="caption" tone="muted">
              {queue.length} check-in{queue.length > 1 ? 's' : ''} waiting on this device
            </Txt>
          ) : null}
          <Button label="Sign out" kind="secondary" onPress={confirmSignOut} loading={busy} />
        </>
      ) : (
        <>
          <Txt tone="muted">
            {session.status === 'expired' ? `Session ended for ${session.email ?? 'your account'}.` : 'Not signed in.'}
          </Txt>
          <Button label="Sign in" onPress={() => router.push('/sign-in')} />
          {session.status === 'expired' ? (
            <Button label="Forget this account on this device" kind="quiet" onPress={confirmSignOut} loading={busy} />
          ) : null}
        </>
      )}
    </Card>
  );
}

/** Relay 07 reviewer-only catalogue controls (session only; not in ordinary navigation). */
function CatalogReviewTools() {
  const { scenario, setScenario, hidden, toggleHidden } = useCatalog();
  return (
    <View style={{ gap: 10 }}>
      <Txt variant="label">Catalogue fixture scenario</Txt>
      <View style={s.row} accessibilityRole="radiogroup" accessibilityLabel="Catalogue fixture scenario">
        {CATALOG_SCENARIOS.map((x) => (
          <Chip key={x} label={x} selected={(scenario ?? 'sample') === x} onPress={() => setScenario(x === 'sample' ? null : x)} />
        ))}
      </View>
      <Txt variant="label">Hide optional catalogue sections</Txt>
      {(Object.keys(CATALOG_SECTIONS) as CatalogSectionKey[]).map((k) => (
        <Switch key={k} label={`Hide ${CATALOG_SECTIONS[k].name} (${k})`} checked={hidden.includes(k)} onToggle={() => toggleHidden(k)} />
      ))}
    </View>
  );
}
