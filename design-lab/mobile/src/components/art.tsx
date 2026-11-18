/**
 * Native original art: decorative microbes (shared shape model) and outline
 * tab/feature icons. Small, contained illustrations — never a moving
 * background behind forms or charts (brief 29, native art direction).
 */
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { kindForIllustrationRef, rimColor, shapeOf, shapeToSvg, type MicrobeKind } from '@rb-lab/shared';
import { useAppTheme } from '../theme/ThemeProvider';

function Microbe({ kind, size, color, seed, box }: { kind: MicrobeKind; size: number; color: string; seed: number; box: number }) {
  const { theme } = useAppTheme();
  const svg = shapeToSvg(shapeOf({ kind, size, shapeSeed: seed }));
  const rim = rimColor(color, theme);
  const h = box / 2;
  return (
    <Svg width={box} height={box} viewBox={`${-h} ${-h} ${box} ${box}`}>
      {theme === 'dark' ? <Circle r={size * 1.5} fill={color} opacity={0.14} /> : null}
      {svg.strands.map((st, i) => (
        <Path key={`s${i}`} d={st.d} stroke={rim} strokeWidth={st.width} strokeLinecap="round" fill="none" />
      ))}
      {svg.bodies.map((d, i) => (
        <Path key={`b${i}`} d={d} fill={color} stroke={rim} strokeWidth={Math.max(0.8, size * 0.09)} />
      ))}
    </Svg>
  );
}

/** One gently drifting organism. Static when Pause or OS reduced motion is on. */
function Drifter({
  kind,
  size,
  color,
  seed,
  x,
  y,
  box,
  period,
  angle,
}: {
  kind: MicrobeKind;
  size: number;
  color: string;
  seed: number;
  x: number;
  y: number;
  box: number;
  period: number;
  angle: number;
}) {
  const { motionOff } = useAppTheme();
  const t = useSharedValue(0);
  useEffect(() => {
    if (motionOff) {
      cancelAnimation(t);
      t.value = 0;
      return;
    }
    t.value = withRepeat(withTiming(1, { duration: period, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(t);
  }, [motionOff, period, t]);
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: (t.value - 0.5) * 8 },
      { translateY: (0.5 - t.value) * 6 },
      { rotate: `${angle + (t.value - 0.5) * 14}deg` },
    ],
  }));
  return (
    <Animated.View style={[{ position: 'absolute', left: x - box / 2, top: y - box / 2, width: box, height: box }, style]}>
      <Microbe kind={kind} size={size} color={color} seed={seed} box={box} />
    </Animated.View>
  );
}

/** Small greeting illustration: all four morphologies in a soft focus disc. */
export function MicrobeCluster({ size = 112 }: { size?: number }) {
  const { colors } = useAppTheme();
  const k = size / 112;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Decorative illustration of four stylised microbes"
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.scene, overflow: 'hidden' }}
    >
      <Drifter kind="hairy" size={11 * k} color="#8FA7C9" seed={21} x={34 * k} y={36 * k} box={44 * k} period={9000} angle={0} />
      <Drifter kind="shortRod" size={13 * k} color="#C98B6B" seed={22} x={78 * k} y={34 * k} box={44 * k} period={11000} angle={30} />
      <Drifter kind="flagellate" size={11 * k} color="#9CB98A" seed={23} x={74 * k} y={78 * k} box={70 * k} period={13000} angle={-150} />
      <Drifter kind="chain" size={4.5 * k} color="#B7A0C9" seed={24} x={36 * k} y={78 * k} box={52 * k} period={10000} angle={-14} />
    </View>
  );
}

/**
 * Single organism for empty states and other safe illustration regions
 * (34 AMBIENT-01): a gentle in-place drift, still under Pause / reduced motion.
 */
export function MicrobeSpot({ kind = 'chain', color = '#B7A0C9' }: { kind?: MicrobeKind; color?: string }) {
  const { colors } = useAppTheme();
  const size = kind === 'chain' ? 7 : 18;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Decorative microbe illustration"
      style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: colors.scene, overflow: 'hidden' }}
    >
      <Drifter kind={kind} size={size} color={color} seed={31} x={44} y={44} box={84} period={12000} angle={0} />
    </View>
  );
}

const ART_BY_KIND: Record<MicrobeKind, { size: number; color: string; seed: number; box: number }> = {
  hairy: { size: 20, color: '#8FA7C9', seed: 11, box: 96 },
  shortRod: { size: 24, color: '#C98B6B', seed: 12, box: 96 },
  flagellate: { size: 16, color: '#9CB98A', seed: 13, box: 110 },
  chain: { size: 8, color: '#B7A0C9', seed: 14, box: 96 },
};

/** Knowledge-card illustration from a supported `illustration.ref` (static). */
export function KnowledgeArt({ refName, label, size = 96 }: { refName: string; label?: string; size?: number }) {
  const { colors } = useAppTheme();
  const kind = kindForIllustrationRef(refName);
  const a11y = label
    ? { accessible: true, accessibilityRole: 'image' as const, accessibilityLabel: label }
    : { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' as const };
  return (
    <View
      {...a11y}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.scene, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
    >
      {kind ? (
        <Microbe kind={kind} size={(ART_BY_KIND[kind].size * size) / 96} color={ART_BY_KIND[kind].color} seed={ART_BY_KIND[kind].seed} box={size} />
      ) : (
        <Icon name={refName === 'note_log' ? 'log' : refName === 'note_lens' ? 'explore' : 'method'} color={colors.textSecondary} size={size * 0.45} />
      )}
    </View>
  );
}

// ------------------------------------------------------------------ icons

type IconName = 'home' | 'explore' | 'log' | 'reports' | 'progress' | 'lab' | 'self' | 'method';

export function Icon({ name, color, size = 26, filled }: { name: IconName; color: string; size?: number; filled?: boolean }) {
  const p = { stroke: color, strokeWidth: 1.8, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {name === 'home' ? (
        <>
          <Path d="M4 11 L12 4.5 L20 11 V19.5 H14.5 V14.5 H9.5 V19.5 H4 Z" {...p} fill={filled ? color : 'none'} fillOpacity={filled ? 0.18 : 0} />
        </>
      ) : null}
      {name === 'explore' ? (
        <>
          <Rect x="4" y="4" width="7" height="7" rx="2" {...p} />
          <Rect x="13" y="4" width="7" height="7" rx="2" {...p} fill={filled ? color : 'none'} fillOpacity={filled ? 0.18 : 0} />
          <Rect x="4" y="13" width="7" height="7" rx="2" {...p} />
          <Circle cx="16.5" cy="16.5" r="3.5" {...p} />
        </>
      ) : null}
      {name === 'log' ? (
        <>
          <Circle cx="12" cy="12" r="8.5" {...p} fill={filled ? color : 'none'} fillOpacity={filled ? 0.18 : 0} />
          <Path d="M12 8 V16 M8 12 H16" {...p} />
        </>
      ) : null}
      {name === 'reports' ? (
        <>
          <Path d="M6 3.5 H14 L18 7.5 V20.5 H6 Z" {...p} fill={filled ? color : 'none'} fillOpacity={filled ? 0.18 : 0} />
          <Path d="M14 3.5 V7.5 H18 M9 16.5 V13.5 M12 16.5 V11 M15 16.5 V14.5" {...p} />
        </>
      ) : null}
      {name === 'progress' ? (
        <>
          <Path d="M4 19.5 H20" {...p} />
          <Circle cx="6.5" cy="14" r="1.8" {...p} fill={filled ? color : 'none'} />
          <Circle cx="11" cy="11" r="1.8" {...p} fill={filled ? color : 'none'} />
          <Circle cx="15" cy="13" r="1.8" {...p} strokeDasharray="1.2 1.4" />
          <Circle cx="19" cy="7" r="1.8" {...p} fill={filled ? color : 'none'} />
        </>
      ) : null}
      {name === 'lab' ? <Path d="M9.5 3.5 H14.5 M10.5 3.5 V9.5 L5.5 19 A1.2 1.2 0 0 0 6.6 20.5 H17.4 A1.2 1.2 0 0 0 18.5 19 L13.5 9.5 V3.5 M8 15 H16" {...p} /> : null}
      {name === 'self' ? (
        <>
          <Circle cx="12" cy="8.5" r="3.5" {...p} />
          <Path d="M5 20 C5.8 15.8 8.6 14 12 14 C15.4 14 18.2 15.8 19 20" {...p} />
        </>
      ) : null}
      {name === 'method' ? (
        <>
          <Rect x="4.5" y="4.5" width="15" height="15" rx="3" {...p} />
          <Path d="M8 9 H16 M8 12 H16 M8 15 H12.5" {...p} />
        </>
      ) : null}
    </Svg>
  );
}
