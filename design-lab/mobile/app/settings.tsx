/**
 * Profile and display settings. Light / Dark / System and Pause motion are UI
 * preferences stored locally; they contain no health data.
 */
import Constants from 'expo-constants';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DEMO_USER, type ThemePreference } from '@rb-lab/shared';
import { Card, Chip, Txt, s } from '../src/components/ui';
import { useAppTheme } from '../src/theme/ThemeProvider';

const MODES: { id: ThemePreference; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System' },
];

export default function Settings() {
  const { pref, setPref, paused, setPaused, reducedMotion, colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={{ backgroundColor: colors.canvas }} contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: insets.bottom + 32 }}>
      <Card>
        <Txt variant="caption" tone="muted">
          Signed in as (synthetic)
        </Txt>
        <Txt variant="title">{DEMO_USER.displayName}</Txt>
        <Txt variant="data" tone="muted">
          {DEMO_USER.id}
        </Txt>
      </Card>

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
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: paused }}
          accessibilityLabel="Pause decorative motion"
          onPress={() => setPaused(!paused)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 }}
        >
          <View style={{ width: 48, height: 28, borderRadius: 14, padding: 3, backgroundColor: paused ? colors.action : colors.border }}>
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: paused ? colors.onAction : colors.surfaceRaised,
                transform: [{ translateX: paused ? 20 : 0 }],
              }}
            />
          </View>
          <Txt variant="bodyStrong">Pause decorative motion</Txt>
        </Pressable>
        <Txt variant="caption" tone="muted">
          {reducedMotion
            ? 'Your device asks for reduced motion, so illustrations stay still.'
            : 'Illustrations move gently. Turn on Pause, or reduce motion in system settings, to keep them still.'}
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
