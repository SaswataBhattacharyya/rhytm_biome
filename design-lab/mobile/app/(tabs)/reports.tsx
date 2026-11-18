/**
 * Reports — S17. States: no reports · processing/review · unavailable/error · synthetic layout.
 * Drafts/in-review items never expose a result link. No clinical interpretation.
 * Deep link: rhythmbiome-d0://reports?state=processing
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { REPORT_LAYOUT, REPORT_PROCESSING, REPORTS_STATES, reportPalettes, type ReportCard, type ReportsState } from '@rb-lab/shared';
import { Icon, MicrobeSpot } from '../../src/components/art';
import { Banner, Button, Card, Screen, Skeleton, StateSwitcher, Txt } from '../../src/components/ui';
import { useAppTheme } from '../../src/theme/ThemeProvider';

const isState = (v: unknown): v is ReportsState => REPORTS_STATES.some((st) => st.id === v);

export default function ReportsScreen() {
  const params = useLocalSearchParams<{ state?: string }>();
  const [state, setState] = useState<ReportsState>(isState(params.state) ? params.state : 'none');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isState(params.state)) setState(params.state);
  }, [params.state]);

  const retry = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setState('processing');
    }, 900);
  };

  return (
    <Screen>
      <StateSwitcher states={REPORTS_STATES} value={state} onChange={setState} />
      <Txt variant="display" accessibilityRole="header">
        Reports
      </Txt>
      {loading ? (
        <Card>
          <Skeleton height={22} width="60%" />
          <Skeleton height={16} />
        </Card>
      ) : null}
      {!loading && state === 'none' ? (
        <Card style={{ alignItems: 'flex-start' }}>
          <MicrobeSpot />
          <Txt variant="title">No reports yet</Txt>
          <Txt tone="muted">After your sample is analysed and reviewed, your report appears here.</Txt>
          <Button label="Explore tests" onPress={() => router.push('/explore')} />
        </Card>
      ) : null}
      {!loading && state === 'processing' ? (
        <>
          <ReportRow card={REPORT_PROCESSING} />
          <Txt variant="caption" tone="muted">
            Results appear only after lab review. There is no preview of an unreleased result.
          </Txt>
        </>
      ) : null}
      {!loading && state === 'unavailable' ? (
        <Banner tone="danger" title="Reports couldn't load" body="Simulated error. Your reports are not affected.">
          <Button label="Retry" kind="secondary" onPress={retry} style={{ marginTop: 8 }} />
        </Banner>
      ) : null}
      {!loading && state === 'syntheticLayout' ? (
        <>
          <Banner title="Synthetic layout" body="Shows how a released report is organised. It contains no real data or interpretation." />
          <ReportRow card={REPORT_LAYOUT} />
        </>
      ) : null}
    </Screen>
  );
}

function ReportRow({ card }: { card: ReportCard }) {
  const { colors } = useAppTheme();
  const pal = reportPalettes[card.category];
  const content = (
    <Card accent={pal.background}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: pal.background, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="reports" color="#1E242B" size={24} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt variant="heading">{card.title}</Txt>
          <Txt variant="caption" tone="muted">
            {card.dateLabel}
          </Txt>
        </View>
        {card.released ? (
          <Txt variant="heading" tone="secondary" accessibilityElementsHidden>
            →
          </Txt>
        ) : null}
      </View>
      <View
        style={{
          alignSelf: 'flex-start',
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 999,
          borderWidth: 1.5,
          borderColor: card.released ? colors.textSecondary : colors.warning,
        }}
      >
        <Txt variant="label" tone={card.released ? 'secondary' : 'warning'}>
          {card.statusLabel}
        </Txt>
      </View>
    </Card>
  );
  if (!card.released) return <View accessible accessibilityLabel={`${card.title}. ${card.statusLabel}. ${card.dateLabel}`}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${card.title}. ${card.statusLabel}. Opens the layout.`}
      onPress={() => router.push({ pathname: '/reports/[id]', params: { id: card.id } })}
      style={({ pressed }) => [pressed && { opacity: 0.85 }]}
    >
      {content}
    </Pressable>
  );
}
