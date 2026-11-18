/**
 * Native D0 UI primitives. Opaque, stable surfaces; one primary action per screen.
 * Every interactive element has a role, label and ≥48dp target.
 */
import { router } from 'expo-router';
import type { ReactNode, Ref } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radii } from '@rb-lab/shared';
import { F, useAppTheme } from '../theme/ThemeProvider';

// ------------------------------------------------------------------ text

type Variant = 'display' | 'title' | 'heading' | 'body' | 'bodyStrong' | 'label' | 'caption' | 'data';

const VARIANTS: Record<Variant, TextStyle> = {
  display: { fontFamily: F.bold, fontSize: 30, lineHeight: 36 },
  title: { fontFamily: F.semibold, fontSize: 24, lineHeight: 30 },
  heading: { fontFamily: F.semibold, fontSize: 19, lineHeight: 25 },
  body: { fontFamily: F.regular, fontSize: 16, lineHeight: 24 },
  bodyStrong: { fontFamily: F.semibold, fontSize: 16, lineHeight: 24 },
  label: { fontFamily: F.medium, fontSize: 15, lineHeight: 20 },
  caption: { fontFamily: F.regular, fontSize: 14, lineHeight: 20 },
  data: { fontFamily: F.mono, fontSize: 14, lineHeight: 20 },
};

export function Txt({
  variant = 'body',
  tone = 'text',
  style,
  ref,
  ...rest
}: TextProps & {
  variant?: Variant;
  tone?: 'text' | 'secondary' | 'muted' | 'onAction' | 'warning' | 'danger' | 'success';
  /** React 19 ref-as-prop, used to move screen-reader focus to titles. */
  ref?: Ref<Text>;
}) {
  const { colors } = useAppTheme();
  const color = {
    text: colors.text,
    secondary: colors.textSecondary,
    muted: colors.textMuted,
    onAction: colors.onAction,
    warning: colors.warning,
    danger: colors.danger,
    success: colors.success,
  }[tone];
  return <Text ref={ref} {...rest} style={[VARIANTS[variant], { color }, style]} />;
}

// ------------------------------------------------------------------ buttons

export function Button({
  label,
  onPress,
  kind = 'primary',
  disabled,
  loading,
  accessibilityHint,
  style,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'quiet';
  disabled?: boolean;
  loading?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useAppTheme();
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        kind === 'primary' && { backgroundColor: colors.action },
        kind === 'secondary' && { borderColor: colors.textSecondary, borderWidth: 1.5 },
        inactive && { opacity: 0.45 },
        pressed && { transform: [{ scale: 0.98 }], opacity: 0.9 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={kind === 'primary' ? colors.onAction : colors.text} />
      ) : (
        <Txt variant="bodyStrong" tone={kind === 'primary' ? 'onAction' : 'text'}>
          {label}
        </Txt>
      )}
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  accessibilityRole = 'radio',
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  accessibilityRole?: 'radio' | 'button' | 'checkbox';
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityState={accessibilityRole === 'button' ? undefined : { checked: !!selected, selected: !!selected }}
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        s.chip,
        { borderColor: selected ? colors.textSecondary : colors.border, backgroundColor: selected ? colors.surfaceRaised : 'transparent' },
        selected && { borderWidth: 2 },
        pressed && { opacity: 0.8 },
      ]}
    >
      {selected ? <View style={[s.chipDot, { backgroundColor: colors.textSecondary }]} /> : null}
      <Txt variant="label" tone={selected ? 'text' : 'secondary'}>
        {label}
      </Txt>
    </Pressable>
  );
}

// ------------------------------------------------------------------ surfaces

export function Card({ children, style, accent }: { children: ReactNode; style?: StyleProp<ViewStyle>; accent?: string }) {
  const { colors } = useAppTheme();
  return (
    <View
      style={[
        s.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        accent ? { borderLeftWidth: 4, borderLeftColor: accent } : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Banner({ tone = 'info', title, body, children }: { tone?: 'info' | 'warning' | 'danger' | 'success'; title: string; body?: string; children?: ReactNode }) {
  const { colors } = useAppTheme();
  const accent = { info: colors.textSecondary, warning: colors.warning, danger: colors.danger, success: colors.success }[tone];
  const glyph = { info: 'i', warning: '!', danger: '×', success: '✓' }[tone];
  return (
    <View
      accessibilityRole={tone === 'danger' ? 'alert' : undefined}
      style={[s.banner, { borderColor: accent, backgroundColor: colors.surface }]}
    >
      <View style={[s.bannerGlyph, { borderColor: accent }]}>
        <Txt variant="label" style={{ color: accent }}>
          {glyph}
        </Txt>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Txt variant="bodyStrong">{title}</Txt>
        {body ? <Txt variant="caption" tone="muted">{body}</Txt> : null}
        {children}
      </View>
    </View>
  );
}

export function Skeleton({ height = 20, width = '100%' as ViewStyle['width'] }: { height?: number; width?: ViewStyle['width'] }) {
  const { colors } = useAppTheme();
  return <View style={{ height, width, borderRadius: 8, backgroundColor: colors.border }} />;
}

export function SectionTitle({ children, action }: { children: string; action?: ReactNode }) {
  return (
    <View style={s.sectionTitle}>
      <Txt variant="heading" accessibilityRole="header">
        {children}
      </Txt>
      {action}
    </View>
  );
}

// ------------------------------------------------------------------ screen scaffolding

export function Logo({ height = 32 }: { height?: number }) {
  const { theme } = useAppTheme();
  const src =
    theme === 'dark'
      ? require('../../assets/brand/rhythmbiome-horizontal-dark.png')
      : require('../../assets/brand/rhythmbiome-horizontal-light.png');
  // Supplied PNG lockups (2400×523), unmodified. 32dp height ≈ 147dp wide ≥ 140 minimum.
  return <Image source={src} accessibilityLabel="Rhythm Biome" style={{ height, width: Math.round((height * 2400) / 523) }} resizeMode="contain" />;
}

export function AppHeader() {
  const { colors } = useAppTheme();
  return (
    <View style={s.header}>
      <Logo height={32} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Profile and display settings"
        onPress={() => router.push('/settings')}
        style={({ pressed }) => [s.avatar, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }, pressed && { opacity: 0.8 }]}
      >
        <Txt variant="bodyStrong" tone="secondary">
          D
        </Txt>
      </Pressable>
    </View>
  );
}

export function Screen({ children, footer, header = true }: { children: ReactNode; footer?: ReactNode; header?: boolean }) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  // Edge-to-edge Android does not resize the window for the keyboard; pad instead
  // so the sticky footer action stays reachable above it (verify on device).
  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.canvas }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[s.screen, { paddingTop: insets.top + 8, paddingBottom: 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        {header ? <AppHeader /> : null}
        {children}
      </ScrollView>
      {footer ? (
        <View style={[s.footer, { backgroundColor: colors.canvas, borderTopColor: colors.border }]}>{footer}</View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

/**
 * D0-only reviewer control: switches the synthetic fixture state on screen.
 * Clearly labelled so it cannot be mistaken for product UI.
 */
export function StateSwitcher<T extends string>({
  states,
  value,
  onChange,
}: {
  states: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={[s.switcher, { borderColor: colors.border }]} accessibilityLabel="D0 specimen state">
      <Txt variant="caption" tone="muted">
        D0 specimen state (synthetic)
      </Txt>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {states.map((st) => (
          <Chip key={st.id} label={st.label} selected={st.id === value} onPress={() => onChange(st.id)} />
        ))}
      </ScrollView>
    </View>
  );
}

export const s = StyleSheet.create({
  screen: { paddingHorizontal: 20, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 56 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  button: { minHeight: 52, borderRadius: radii.control, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  chip: { minHeight: 48, borderRadius: radii.pill, paddingHorizontal: 16, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', gap: 8 },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  card: { borderRadius: radii.card, borderWidth: 1, padding: 20, gap: 12 },
  banner: { flexDirection: 'row', gap: 12, borderRadius: 16, borderWidth: 1.5, padding: 16 },
  bannerGlyph: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, borderTopWidth: 1 },
  switcher: { gap: 8, paddingVertical: 10, borderTopWidth: 1, borderBottomWidth: 1, borderStyle: 'dashed' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
