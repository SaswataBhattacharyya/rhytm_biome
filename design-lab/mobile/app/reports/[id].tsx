/**
 * Report — S18 synthetic layout. Editorial, data-led structure with explicit
 * placeholders. No values, no charts with invented data, no interpretation,
 * no PDF. Measured vs self-reported sections are labelled with text + icon.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { REPORT_LAYOUT, REPORT_LAYOUT_SECTIONS, reportPalettes } from '@rb-lab/shared';
import { Icon } from '../../src/components/art';
import { Banner, Button, Card, Txt } from '../../src/components/ui';
import { useAppTheme } from '../../src/theme/ThemeProvider';

const SOURCE_LABEL = { measured: 'Lab-measured', selfReported: 'Self-reported', method: 'Method' } as const;
const SOURCE_ICON = { measured: 'lab', selfReported: 'self', method: 'method' } as const;

export default function ReportDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [pdfNote, setPdfNote] = useState(false);

  if (id !== REPORT_LAYOUT.id) {
    return (
      <View style={{ flex: 1, padding: 20, gap: 16, backgroundColor: colors.canvas }}>
        <Banner tone="danger" title="Report not available" body="This report doesn't exist or isn't yours (synthetic check)." />
        <Button label="Back to Reports" onPress={() => router.back()} />
      </View>
    );
  }

  const pal = reportPalettes.gut;
  return (
    <ScrollView style={{ backgroundColor: colors.canvas }} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
      {/* Approved report art pairing: gut yellow band; charcoal text for small-text contrast (10.7:1). */}
      <View style={{ backgroundColor: pal.background, paddingHorizontal: 20, paddingVertical: 24, gap: 6 }}>
        <View style={{ height: 3, width: 48, backgroundColor: pal.foreground, borderRadius: 2 }} />
        <Txt variant="caption" style={{ color: '#1E242B' }}>
          Gut · {REPORT_LAYOUT.dateLabel}
        </Txt>
        <Txt variant="display" style={{ color: '#1E242B' }} accessibilityRole="header">
          Report layout example
        </Txt>
        <Txt style={{ color: '#1E242B' }}>Synthetic placeholder — no real data, values or interpretation.</Txt>
      </View>

      <View style={{ padding: 20, gap: 16 }}>
        <Banner title="How to read this layout" body="Lab-measured sections and your own self-reported check-ins are always kept apart." />
        {REPORT_LAYOUT_SECTIONS.map((sec) => (
          <Card key={sec.id}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name={SOURCE_ICON[sec.source]} color={colors.textSecondary} size={20} />
              <Txt variant="label" tone="secondary">
                {SOURCE_LABEL[sec.source]}
              </Txt>
            </View>
            <Txt variant="title" accessibilityRole="header">
              {sec.title}
            </Txt>
            <View
              style={{
                minHeight: sec.id === 'diversity' || sec.id === 'composition' ? 120 : 64,
                borderRadius: 12,
                borderWidth: 1.5,
                borderStyle: 'dashed',
                borderColor: colors.border,
                padding: 14,
                justifyContent: 'center',
              }}
            >
              <Txt variant="caption" tone="muted">
                Placeholder · {sec.note}
              </Txt>
            </View>
          </Card>
        ))}
        <Button label="Download PDF" kind="secondary" onPress={() => setPdfNote(true)} />
        {pdfNote ? (
          <Banner title="Not in this specimen" body="Private PDF download of a released report arrives with the test-to-report slice (B3)." />
        ) : null}
      </View>
    </ScrollView>
  );
}
