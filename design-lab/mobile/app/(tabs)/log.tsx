/**
 * Log tab (Relay 05).
 *
 * Default: the connected daily check-in (DailyCheckIn) — synthetic sign-in,
 * profile-timezone dates, persisted outbox, saved/pending/conflict states.
 * Existing specimen deep links keep working: rhythmbiome-d0://log?state=conflict
 * (and ?mood=) open the D0 specimen states, which also live at /log-specimen
 * for reviewer mode.
 */
import { useLocalSearchParams } from 'expo-router';
import { LOG_STATES } from '@rb-lab/shared';
import { DailyCheckIn } from '../../src/components/DailyCheckIn';
import { SpecimenLog } from '../../src/components/SpecimenLog';

export default function LogScreen() {
  const { state } = useLocalSearchParams<{ state?: string }>();
  if (LOG_STATES.some((st) => st.id === state)) return <SpecimenLog />;
  return <DailyCheckIn />;
}
