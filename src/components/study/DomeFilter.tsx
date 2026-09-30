import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

const APath = Animated.createAnimatedComponent(Path);
const H = 46;
const LIFT = 14;

// A flat dark bar with a dome rising over the chosen label.
function domePath(w: number, cx: number) {
  'worklet';
  const y0 = LIFT;
  const r = 16;
  const R = 30;
  const S = 16;
  const a = cx - R - S;
  const b = cx + R + S;
  return `M ${r} ${y0} L ${a} ${y0} C ${a + S * 0.75} ${y0} ${cx - R * 0.98} 0 ${cx} 0 C ${cx + R * 0.98} 0 ${b - S * 0.75} ${y0} ${b} ${y0} L ${w - r} ${y0} Q ${w} ${y0} ${w} ${y0 + r} L ${w} ${y0 + H - r} Q ${w} ${y0 + H} ${w - r} ${y0 + H} L ${r} ${y0 + H} Q 0 ${y0 + H} 0 ${y0 + H - r} L 0 ${y0 + r} Q 0 ${y0} ${r} ${y0} Z`;
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const up = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    up.set(withTiming(on ? 1 : 0, { duration: 240, easing: Easing.out(Easing.cubic) }));
  }, [on, up]);
  const st = useAnimatedStyle(() => ({ transform: [{ translateY: -6 * up.value }, { scale: 1 + 0.04 * up.value }] }));
  return (
    <Pressable onPress={onPress} style={styles.chip} accessibilityRole="tab" accessibilityState={{ selected: on }}>
      <Animated.Text style={[styles.label, { color: on ? '#fff' : 'rgba(255,255,255,0.42)' }, st]}>{label}</Animated.Text>
    </Pressable>
  );
}

// Library filter (her second recording): a dark bar whose chosen label sits in a dome that slides.
export function DomeFilter({ items, value, onChange }: { items: { key: string; label: string }[]; value: string; onChange: (k: string) => void }) {
  const [w, setW] = useState(0);
  const idx = Math.max(
    0,
    items.findIndex((i) => i.key === value),
  );
  const cx = useSharedValue(-1);
  useEffect(() => {
    if (!w) return;
    const to = (w / items.length) * (idx + 0.5);
    cx.set(cx.value < 0 ? to : withTiming(to, { duration: 300, easing: Easing.out(Easing.cubic) }));
  }, [w, idx, items.length, cx]);
  const props = useAnimatedProps(() => ({ d: w && cx.value >= 0 ? domePath(w, cx.value) : '' }));
  return (
    <View style={styles.wrap} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 && (
        <Svg width={w} height={H + LIFT} style={styles.bg} pointerEvents="none">
          <APath animatedProps={props} fill="#1d1c1c" />
        </Svg>
      )}
      <View style={styles.row}>
        {items.map((it) => (
          <Chip
            key={it.key}
            label={it.label}
            on={it.key === value}
            onPress={() => {
              if (it.key === value) return;
              Haptics.selectionAsync();
              onChange(it.key);
            }}
          />
        ))}
      </View>
    </View>
  );
}

// The quiet second row under Paper: who wrote it.
export function WhoRow({ items, value, onChange, light }: { items: { key: string; label: string }[]; value: string; onChange: (k: string) => void; light?: boolean }) {
  return (
    <View style={styles.who}>
      {items.map((it) => {
        const on = it.key === value;
        return (
          <Pressable
            key={it.key}
            onPress={() => {
              Haptics.selectionAsync();
              onChange(it.key);
            }}
            hitSlop={8}>
            <Text style={[styles.whoText, on && styles.whoOn, light && styles.whoLight, light && on && styles.whoLightOn]}>{it.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: H, marginTop: LIFT, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 6 } },
  bg: { position: 'absolute', left: 0, top: -LIFT },
  row: { ...StyleSheet.absoluteFill, flexDirection: 'row' },
  chip: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 13, fontWeight: '600' },
  who: { flexDirection: 'row', justifyContent: 'center', gap: 22, marginTop: 10 },
  whoText: { fontSize: 14, fontWeight: '500', color: '#8a857c', paddingVertical: 4, borderBottomWidth: 1.5, borderBottomColor: 'transparent' },
  whoOn: { color: '#1c1b19', borderBottomColor: '#1c1b19' },
  whoLight: { color: 'rgba(255,255,255,0.6)', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 6 },
  whoLightOn: { color: '#fff', borderBottomColor: '#fff' },
});
