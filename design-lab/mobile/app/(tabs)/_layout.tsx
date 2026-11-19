import { Tabs } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { Icon } from '../../src/components/art';
import { F, useAppTheme } from '../../src/theme/ThemeProvider';

/** Canonical order (29, ADR-18): Home · Explore · Log · Reports · Progress. Visible labels. */
export default function TabsLayout() {
  const { colors } = useAppTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.textSecondary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, minHeight: 58 },
        // The five fixed-width tabs need room for every label at large text sizes.
        tabBarLabel: ({ color, children }) => (
          <Text maxFontSizeMultiplier={1.25} style={[styles.tabLabel, { color }]}>{children}</Text>
        ),
        tabBarItemStyle: { paddingTop: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: ({ color, focused }) => <Icon name="home" color={color} filled={focused} size={22} /> }}
      />
      <Tabs.Screen
        name="explore"
        options={{ title: 'Explore', tabBarIcon: ({ color, focused }) => <Icon name="explore" color={color} filled={focused} size={22} /> }}
      />
      <Tabs.Screen
        name="log"
        options={{ title: 'Log', tabBarIcon: ({ color, focused }) => <Icon name="log" color={color} filled={focused} size={26} /> }}
      />
      <Tabs.Screen
        name="reports"
        options={{ title: 'Reports', tabBarIcon: ({ color, focused }) => <Icon name="reports" color={color} filled={focused} size={22} /> }}
      />
      <Tabs.Screen
        name="progress"
        options={{ title: 'Progress', tabBarIcon: ({ color, focused }) => <Icon name="progress" color={color} filled={focused} size={22} /> }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabLabel: { fontFamily: F.medium, fontSize: 12, textAlign: 'center' },
});
