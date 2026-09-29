import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

export const TOMATO = '#d4553f';

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

// The tomato ring: full while idle, emptying as the focus runs down.
export function FocusRing({ size, stroke, seconds, total, sub }: { size: number; stroke: number; seconds: number; total: number; sub: string }) {
  const r = (size - stroke) / 2 - 2;
  const c = 2 * Math.PI * r;
  const frac = total > 0 ? seconds / total : 1;
  const big = size > 200;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={[StyleSheet.absoluteFill, { transform: [{ rotate: '-90deg' }] }]}>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={stroke} />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={TOMATO}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c}`}
          strokeDashoffset={c * (1 - frac)}
        />
      </Svg>
      <View style={styles.center}>
        <Text style={[styles.time, { fontSize: big ? 60 : 28 }]}>{mmss(seconds)}</Text>
        <Text style={[styles.sub, { fontSize: big ? 12 : 10.5, letterSpacing: big ? 2.9 : 2.1, marginTop: big ? 8 : 4 }]}>{sub}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  time: { fontFamily: 'PlayfairDisplay_600SemiBold', color: '#fff', fontVariant: ['tabular-nums'], lineHeight: undefined },
  sub: { fontFamily: 'JosefinSans_400Regular', color: 'rgba(235,235,245,0.66)' },
});
