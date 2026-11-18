/**
 * Progress — D0 shows only the no-data state. No fake 0%, no derived score.
 */
import { router } from 'expo-router';
import { MicrobeSpot } from '../../src/components/art';
import { Button, Card, Screen, Txt } from '../../src/components/ui';

export default function ProgressScreen() {
  return (
    <Screen>
      <Txt variant="display" accessibilityRole="header">
        Progress
      </Txt>
      <Card style={{ alignItems: 'flex-start' }}>
        <MicrobeSpot kind="hairy" color="#7FB3AE" />
        <Txt variant="title">Nothing to show yet</Txt>
        <Txt tone="muted">
          Progress appears after you log a few days. Missing days are shown as missing, never as zero, and your
          check-ins are kept separate from lab results.
        </Txt>
        <Button label="Log today" onPress={() => router.push('/log')} />
      </Card>
      <Txt variant="caption" tone="muted">
        Real progress views arrive with the daily-value slice (B1) using logged data from the shared API.
      </Txt>
    </Screen>
  );
}
