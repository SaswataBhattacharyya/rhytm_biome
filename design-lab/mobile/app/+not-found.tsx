import { router } from 'expo-router';
import { View } from 'react-native';
import { Banner, Button } from '../src/components/ui';
import { useAppTheme } from '../src/theme/ThemeProvider';

export default function NotFound() {
  const { colors } = useAppTheme();
  return (
    <View style={{ flex: 1, padding: 20, paddingTop: 80, gap: 16, backgroundColor: colors.canvas }}>
      <Banner title="Page not found" body="This screen isn't part of the D0 specimen." />
      <Button label="Go to Home" onPress={() => router.replace('/')} />
    </View>
  );
}
