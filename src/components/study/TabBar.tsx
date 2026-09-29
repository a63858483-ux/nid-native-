import * as Haptics from 'expo-haptics';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedProps, useAnimatedStyle, useSharedValue, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

const APath = Animated.createAnimatedComponent(Path);
const H = 64;
const FILL = 'rgba(24,24,26,0.92)';
export type TabItem = { icon: SFSymbol; label: string };
const STUDY: TabItem[] = [
  { icon: 'house', label: 'Study' },
  { icon: 'timer', label: 'Focus' },
  { icon: 'books.vertical', label: 'Library' },
];

// The bar outline: rounded rectangle, with a smooth dip under each tab in proportion to its notch
// value (0 flat, 1 fully dipped). m folds it into a circle (0 open, 1 folded).
function barPath(W: number, count: number, n0: number, n1: number, n2: number, m: number) {
  'worklet';
  const w = W + (H - W) * m;
  const r = 24 + (H / 2 - 24) * m;
  const R = 33;
  const S = 20;
  const D = 36;
  const cw = W / count;
  let p = `M ${r} 0`;
  const ns = [n0, n1, n2];
  for (let i = 0; i < count; i++) {
    const k = ns[i] * (1 - m);
    if (k < 0.01) continue;
    const cx = cw * (i + 0.5);
    const d = D * k;
    const rr = R * (0.6 + 0.4 * k);
    p += ` L ${cx - rr - S} 0 C ${cx - rr - S * 0.35} 0 ${cx - rr} ${d * 0.2} ${cx - rr * 0.78} ${d * 0.62} C ${cx - rr * 0.5} ${d * 1.02} ${cx + rr * 0.5} ${d * 1.02} ${cx + rr * 0.78} ${d * 0.62} C ${cx + rr} ${d * 0.2} ${cx + rr + S * 0.35} 0 ${cx + rr + S} 0`;
  }
  p += ` L ${w - r} 0 Q ${w} 0 ${w} ${r} L ${w} ${H - r} Q ${w} ${H} ${w - r} ${H} L ${r} ${H} Q 0 ${H} 0 ${H - r} L 0 ${r} Q 0 0 ${r} 0 Z`;
  return p;
}

function Item({ i, cur, W, count, item, m, onPress }: { i: number; cur: number; W: number; count: number; item: TabItem; m: SharedValue<number>; onPress: () => void }) {
  const on = i === cur;
  const lift = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    lift.set(withSpring(on ? 1 : 0, { damping: 13, stiffness: 170 }));
  }, [on, lift]);
  const st = useAnimatedStyle(() => {
    const full = (W / count) * (i + 0.5);
    const cx = full + (H / 2 - full) * m.value;
    return {
      transform: [{ translateX: cx - 26 }, { translateY: -30 * lift.value * (1 - m.value) }],
      opacity: on ? 1 : 1 - m.value,
    };
  });
  const bub = useAnimatedStyle(() => ({ opacity: lift.value * (1 - m.value) }));
  return (
    <Animated.View style={[styles.item, st]} pointerEvents="box-none">
      <Pressable onPress={onPress} accessibilityLabel={item.label} accessibilityState={{ selected: on }} hitSlop={8} style={styles.hit}>
        <Animated.View style={[styles.bubble, bub]} />
        <SymbolView name={item.icon} size={23} tintColor={on ? '#fff' : 'rgba(255,255,255,0.42)'} />
      </Pressable>
    </Animated.View>
  );
}

// Study room tab bar (her first recording): the chosen tab rises into a circle and the bar dips
// under it. While a page scrolls down it folds into that one circle so it never fights the
// Library filter bar; tap the circle or scroll back up to open it again.
export function StudyTabBar({
  tab,
  onTab,
  folded,
  onUnfold,
  bottom,
  items = STUDY,
}: {
  tab: number;
  onTab: (i: number) => void;
  folded: boolean;
  onUnfold: () => void;
  bottom: number;
  items?: TabItem[];
}) {
  const count = items.length;
  const [W, setW] = useState(0);
  const n = [useSharedValue(tab === 0 ? 1 : 0), useSharedValue(tab === 1 ? 1 : 0), useSharedValue(tab === 2 ? 1 : 0)];
  const [n0, n1, n2] = n;
  const m = useSharedValue(folded ? 1 : 0);
  useEffect(() => {
    const cfg = { duration: 420, easing: Easing.out(Easing.cubic) };
    n0.set(withTiming(tab === 0 ? 1 : 0, cfg));
    n1.set(withTiming(tab === 1 ? 1 : 0, cfg));
    n2.set(withTiming(tab === 2 ? 1 : 0, cfg));
  }, [tab, n0, n1, n2]);
  useEffect(() => {
    m.set(withSpring(folded ? 1 : 0, { damping: 18, stiffness: 170 }));
  }, [folded, m]);
  const pathProps = useAnimatedProps(() => ({ d: W ? barPath(W, count, n0.value, n1.value, n2.value, m.value) : '' }));
  const box = useAnimatedStyle(() => ({ width: W ? interpolate(m.value, [0, 1], [W, H]) : '100%' }));
  return (
    <View style={[styles.wrap, { bottom }]} onLayout={(e) => setW(e.nativeEvent.layout.width)} pointerEvents="box-none">
      <Animated.View style={[styles.bar, box]}>
        {W > 0 && (
          <Svg width={W} height={H} style={StyleSheet.absoluteFill} pointerEvents="none">
            <APath animatedProps={pathProps} fill={FILL} />
          </Svg>
        )}
        {folded && <Pressable style={StyleSheet.absoluteFill} onPress={onUnfold} accessibilityLabel="Show tabs" />}
      </Animated.View>
      {W > 0 &&
        items.map((item, i) => (
          <Item
            key={i}
            i={i}
            cur={tab}
            W={W}
            count={count}
            item={item}
            m={m}
            onPress={() => {
              Haptics.selectionAsync();
              if (folded) onUnfold();
              else onTab(i);
            }}
          />
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, height: H },
  bar: { height: H, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
  item: { position: 'absolute', top: (H - 52) / 2, left: 0, width: 52, height: 52 },
  hit: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  bubble: {
    ...StyleSheet.absoluteFill,
    borderRadius: 26,
    backgroundColor: 'rgba(24,24,26,0.95)',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 6 },
  },
});
