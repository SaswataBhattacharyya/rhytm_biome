/**
 * Synthetic sign-in (Relay 05). States: idle · submitting · invalid · offline ·
 * unavailable · session expired · signed in. The password is held only in
 * component state while typing, cleared after every attempt, and never
 * stored or logged; tokens go to the secure-storage port.
 */
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { AccessibilityInfo, TextInput, View } from 'react-native';
import { FIXTURE_ACCOUNTS, FIXTURE_PASSWORD } from '@rb-lab/shared';
import { describeError, useDaily } from '../src/data/DailyProvider';
import { Banner, Button, Card, Txt } from '../src/components/ui';
import { F, useAppTheme } from '../src/theme/ThemeProvider';

export default function SignInScreen() {
  const daily = useDaily();
  const { colors } = useAppTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<{ kind: string; text: string } | null>(null);
  const passwordRef = useRef<TextInput>(null);

  const submit = async () => {
    if (busy || !email || !password) return;
    setBusy(true);
    setProblem(null);
    try {
      await daily.signIn(email.trim(), password);
      setPassword('');
      AccessibilityInfo.announceForAccessibility('Signed in');
      if (router.canGoBack()) router.back();
      else router.replace('/log');
    } catch (e) {
      setPassword('');
      const d = describeError(e);
      setProblem(d);
      AccessibilityInfo.announceForAccessibility(d.text);
    } finally {
      setBusy(false);
    }
  };

  const input = {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: 14,
    fontFamily: F.regular,
    fontSize: 16,
  } as const;

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas, padding: 20, gap: 16 }}>
      <Txt variant="caption" tone="muted">
        {daily.backend.mode === 'connected' ? `Connected · synthetic pilot (${daily.backend.label})` : 'Fixture preview · not connected to an account'}
      </Txt>
      {daily.session.status === 'expired' ? (
        <Banner tone="warning" title="Your session ended" body={`Sign in again${daily.session.email ? ` as ${daily.session.email}` : ''} to send anything waiting on this device.`} />
      ) : null}
      {problem ? (
        <Banner
          tone={problem.kind === 'invalid_credentials' ? 'danger' : 'warning'}
          title={problem.kind === 'invalid_credentials' ? 'Sign-in didn’t work' : problem.kind === 'network' ? 'You’re offline' : 'Try again shortly'}
          body={problem.text}
        />
      ) : null}
      <Card>
        <View style={{ gap: 6 }}>
          <Txt variant="label" nativeID="email-label">
            Email
          </Txt>
          <TextInput
            accessibilityLabel="Email"
            accessibilityLabelledBy="email-label"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="username"
            keyboardType="email-address"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            editable={!busy}
            style={input}
          />
        </View>
        <View style={{ gap: 6 }}>
          <Txt variant="label" nativeID="password-label">
            Password
          </Txt>
          <TextInput
            ref={passwordRef}
            accessibilityLabel="Password"
            accessibilityLabelledBy="password-label"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={submit}
            editable={!busy}
            style={input}
          />
        </View>
        <Button label={busy ? 'Signing in…' : 'Sign in'} onPress={submit} loading={busy} disabled={!email || !password} />
      </Card>
      <Txt variant="caption" tone="muted">
        {daily.backend.mode === 'fixture'
          ? `Fixture preview accounts: ${FIXTURE_ACCOUNTS.map((a) => a.email).join(' or ')} with the public placeholder password “${FIXTURE_PASSWORD}”. They only unlock this in-memory preview.`
          : 'Use a synthetic pilot account. Your session is kept in this device’s secure storage until you sign out.'}
      </Txt>
    </View>
  );
}
