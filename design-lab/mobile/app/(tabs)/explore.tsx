/**
 * Explore — outside D0 scope. Present so the canonical five tabs have no hole
 * (UI-02); explains its limitation and preserves navigation.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Banner, Button, Card, Chip, Screen, Txt, s } from '../../src/components/ui';

const SEGMENTS = ['Tests', 'Products', 'Packages'] as const;

export default function ExploreScreen() {
  const [seg, setSeg] = useState<(typeof SEGMENTS)[number]>('Tests');
  return (
    <Screen>
      <Txt variant="display" accessibilityRole="header">
        Explore
      </Txt>
      <View style={s.row} accessibilityRole="radiogroup" accessibilityLabel="Catalogue section">
        {SEGMENTS.map((x) => (
          <Chip key={x} label={x} selected={seg === x} onPress={() => setSeg(x)} />
        ))}
      </View>
      <Banner
        title="Catalogue is a later slice"
        body={`${seg} come from the published catalogue in the commerce slice (B2). This specimen shows no products, tests or prices.`}
      />
      <Card>
        <Txt variant="bodyStrong">Meanwhile in this specimen</Txt>
        <Button label="Try today's check-in" onPress={() => router.push('/log')} />
        <Button label="See the report layout" kind="secondary" onPress={() => router.push({ pathname: '/reports', params: { state: 'syntheticLayout' } })} />
      </Card>
    </Screen>
  );
}
