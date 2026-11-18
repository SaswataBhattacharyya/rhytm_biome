import { Tabs } from 'expo-router';
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
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, minHeight: 64 },
        tabBarLabelStyle: { fontFamily: F.medium, fontSize: 13 },
        tabBarItemStyle: { paddingTop: 4 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: ({ color, focused }) => <Icon name="home" color={color} filled={focused} /> }}
      />
      <Tabs.Screen
        name="explore"
        options={{ title: 'Explore', tabBarIcon: ({ color, focused }) => <Icon name="explore" color={color} filled={focused} /> }}
      />
      <Tabs.Screen
        name="log"
        options={{ title: 'Log', tabBarIcon: ({ color, focused }) => <Icon name="log" color={color} filled={focused} size={30} /> }}
      />
      <Tabs.Screen
        name="reports"
        options={{ title: 'Reports', tabBarIcon: ({ color, focused }) => <Icon name="reports" color={color} filled={focused} /> }}
      />
      <Tabs.Screen
        name="progress"
        options={{ title: 'Progress', tabBarIcon: ({ color, focused }) => <Icon name="progress" color={color} filled={focused} /> }}
      />
    </Tabs>
  );
}
