import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CatalogProvider } from '../src/data/CatalogProvider';
import { DailyProvider } from '../src/data/DailyProvider';
import { AppThemeProvider, F, useAppTheme } from '../src/theme/ThemeProvider';

SplashScreen.preventAutoHideAsync().catch(() => {});

function Navigation() {
  const { theme, colors, ready } = useAppTheme();
  const [fontsLoaded, fontError] = useFonts({
    [F.regular]: require('../assets/fonts/HankenGrotesk-Regular.ttf'),
    [F.medium]: require('../assets/fonts/HankenGrotesk-Medium.ttf'),
    [F.semibold]: require('../assets/fonts/HankenGrotesk-SemiBold.ttf'),
    [F.bold]: require('../assets/fonts/HankenGrotesk-Bold.ttf'),
    [F.mono]: require('../assets/fonts/IBMPlexMono-Medium.ttf'),
  });
  const done = (fontsLoaded || !!fontError) && ready;

  useEffect(() => {
    if (done) SplashScreen.hideAsync().catch(() => {});
  }, [done]);

  if (!done) return null;

  const base = theme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      background: colors.canvas,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      primary: colors.textSecondary,
    },
  };

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.canvas },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="settings"
          options={{
            headerShown: true,
            title: 'Profile and display',
            headerTitleStyle: { fontFamily: F.semibold },
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.text,
          }}
        />
        <Stack.Screen
          name="sign-in"
          options={{
            headerShown: true,
            title: 'Sign in',
            headerTitleStyle: { fontFamily: F.semibold },
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.text,
          }}
        />
        {/* Reviewer route; Screen draws its own safe-area header, Android Back returns. */}
        <Stack.Screen name="log-specimen" options={{ headerShown: false }} />
        {/* Relay 07 catalogue details; each Screen draws its own back row. */}
        <Stack.Screen name="catalog/test/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="catalog/product/[slug]" options={{ headerShown: false }} />
        <Stack.Screen
          name="reports/[id]"
          options={{
            headerShown: true,
            title: 'Report',
            headerTitleStyle: { fontFamily: F.semibold },
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.text,
          }}
        />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppThemeProvider>
        <DailyProvider>
          <CatalogProvider>
            <Navigation />
          </CatalogProvider>
        </DailyProvider>
      </AppThemeProvider>
    </SafeAreaProvider>
  );
}
