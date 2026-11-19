/**
 * Explore (Relay 07): one section at a time — Learn (the full knowledge
 * library), Tests or Products — chosen with a compact selector. Home links
 * here with ?section=learn | catalogue | tests | products. Details open as
 * their own screens; Android Back returns to the section you came from.
 */
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { ProductsSection, TestsSection } from '../../src/components/catalog';
import { MeetMicrobes } from '../../src/components/knowledge';
import { Chip, Screen, Txt, s } from '../../src/components/ui';

const SECTIONS = [
  { id: 'learn', label: 'Learn' },
  { id: 'tests', label: 'Tests' },
  { id: 'products', label: 'Products' },
] as const;
type SectionId = (typeof SECTIONS)[number]['id'];

const fromParam = (v: string | undefined): SectionId | null =>
  v === 'catalogue' || v === 'tests' ? 'tests' : v === 'products' ? 'products' : v === 'learn' ? 'learn' : null;

export default function ExploreScreen() {
  const { section } = useLocalSearchParams<{ section?: string }>();
  const [sel, setSel] = useState<SectionId>(fromParam(section) ?? 'learn');
  useEffect(() => {
    const p = fromParam(section);
    if (p) setSel(p);
  }, [section]);
  return (
    <Screen>
      <Txt variant="display" accessibilityRole="header">
        Explore
      </Txt>
      <View style={s.row} accessibilityRole="radiogroup" accessibilityLabel="Explore section">
        {SECTIONS.map((x) => (
          <Chip key={x.id} label={x.label} selected={sel === x.id} onPress={() => setSel(x.id)} />
        ))}
      </View>
      {sel === 'learn' ? <MeetMicrobes /> : sel === 'tests' ? <TestsSection /> : <ProductsSection />}
    </Screen>
  );
}
