import { useEffect, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, G, LinearGradient, Path, Stop, Text as SvgText, TextPath } from 'react-native-svg';

import { usePalette } from '@/lib/colors';
import { fmtSec } from '@/lib/voice';

export type Zone = 'cancel' | 'text' | null;

// Dome geometry in screen points: a circle of radius 1.5 × width whose cap rises 130pt
// from the bottom; the two pills are arcs of the same circle, 18pt above it.
export const DOME_CAP = 130;
export function domeGeometry(W: number, H: number) {
  return { R: 1.5 * W, cx: W / 2, cy: H - DOME_CAP + 1.5 * W };
}
// Which pill (if any) a touch at (x, y) is on.
export function zoneAt(x: number, y: number, W: number, H: number): Zone {
  const { R, cx, cy } = domeGeometry(W, H);
  const dist = Math.hypot(x - cx, cy - y);
  const ang = (Math.atan2(x - cx, cy - y) * 180) / Math.PI;
  if (dist < R + 4 || dist > R + 120) return null;
  return ang < -3 ? 'cancel' : ang > 3 ? 'text' : null;
}

function arc(cx: number, cy: number, r: number, a0: number, a1: number) {
  const p = (deg: number) => {
    const a = (deg * Math.PI) / 180;
    return `${(cx + r * Math.sin(a)).toFixed(1)} ${(cy - r * Math.cos(a)).toFixed(1)}`;
  };
  return `M${p(a0)} A${r} ${r} 0 0 1 ${p(a1)}`;
}

export function RecordOverlay({ zone, seconds, level, myColor }: { zone: Zone; seconds: number; level: number; myColor: string }) {
  const { width: W, height: H } = useWindowDimensions();
  const pal = usePalette();
  const { R, cx, cy } = domeGeometry(W, H);
  const rc = R + 40;
  const left = arc(cx, cy, rc, -21, -4.2);
  const right = arc(cx, cy, rc, 4.2, 21);
  const blue = myColor === 'glass' ? pal.blue : myColor;
  const liveBg = zone === 'cancel' ? '#FF453A' : zone === 'text' ? '#FFFFFF' : blue;
  const liveInk = zone === 'text' ? '#111' : '#fff';
  const hint = zone === 'cancel' ? 'Release to cancel' : zone === 'text' ? 'Release to convert to text' : 'Release to send';

  return (
    <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(140)} style={[StyleSheet.absoluteFill, styles.dim]} pointerEvents="none">
      <View style={[styles.live, { top: H * 0.4, backgroundColor: liveBg }]}>
        <Dot color={zone === 'text' ? blue : '#fff'} />
        <Bars level={level} color={liveInk} />
        <Text style={[styles.timer, { color: liveInk }]}>{fmtSec(seconds)}</Text>
      </View>
      <Text style={[styles.hint, { bottom: DOME_CAP + 80 }]}>{hint}</Text>
      <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="dome" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#a9a9ab" />
            <Stop offset="0.12" stopColor="#cbcbcd" />
          </LinearGradient>
          <Path id="pl" d={left} />
          <Path id="pr" d={right} />
        </Defs>
        <Path d={left} fill="none" stroke={zone === 'cancel' ? '#FF453A' : 'rgba(255,255,255,0.13)'} strokeWidth={zone === 'cancel' ? 50 : 44} strokeLinecap="round" />
        <Path d={right} fill="none" stroke={zone === 'text' ? '#FFFFFF' : 'rgba(255,255,255,0.13)'} strokeWidth={zone === 'text' ? 50 : 44} strokeLinecap="round" />
        <SvgText fill="rgba(255,255,255,0.9)" fontSize={15} dy={5}>
          <TextPath href="#pl" startOffset="50%" textAnchor="middle">
            Cancel
          </TextPath>
        </SvgText>
        <SvgText fill={zone === 'text' ? '#111' : 'rgba(255,255,255,0.9)'} fontSize={15} dy={5}>
          <TextPath href="#pr" startOffset="50%" textAnchor="middle">
            Convert to Text
          </TextPath>
        </SvgText>
        <Circle cx={cx} cy={cy} r={R} fill="url(#dome)" opacity={zone ? 0.82 : 1} />
        <G x={cx - 14} y={H - DOME_CAP + 40}>
          <Path
            d="M14 4a4 4 0 0 1 4 4v7a4 4 0 0 1-8 0V8a4 4 0 0 1 4-4zM7 14a7 7 0 0 0 14 0M14 21v4"
            scale={1.15}
            fill="none"
            stroke="#2a2a2c"
            strokeWidth={1.8}
            strokeLinecap="round"
          />
        </G>
      </Svg>
    </Animated.View>
  );
}

function Dot({ color }: { color: string }) {
  const o = useSharedValue(1);
  useEffect(() => {
    o.set(withRepeat(withTiming(0.25, { duration: 500, easing: Easing.inOut(Easing.quad) }), -1, true));
  }, [o]);
  const st = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[styles.dot, { backgroundColor: color }, st]} />;
}

// Live level bars: the newest level enters on the right and the rest slide left.
function Bars({ level, color }: { level: number; color: string }) {
  const hist = useHistory(level, 22);
  return (
    <View style={styles.bars}>
      {hist.map((v, i) => (
        <View key={i} style={[styles.bar, { height: `${Math.round(15 + v * 85)}%`, backgroundColor: color }]} />
      ))}
    </View>
  );
}
function useHistory(level: number, n: number) {
  const [prev, setPrev] = useState<{ level: number; hist: number[] }>(() => ({ level, hist: new Array(n).fill(0) }));
  if (prev.level !== level) {
    const hist = [...prev.hist.slice(1), level];
    setPrev({ level, hist });
    return hist;
  }
  return prev.hist;
}

const styles = StyleSheet.create({
  dim: { backgroundColor: 'rgba(46,46,48,0.9)' },
  live: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 22,
    minWidth: 180,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  dot: { width: 9, height: 9, borderRadius: 4.5 },
  bars: { flex: 1, height: 26, flexDirection: 'row', alignItems: 'center', gap: 2 },
  bar: { width: 3, borderRadius: 1.5 },
  timer: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  hint: { position: 'absolute', left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,0.55)', fontSize: 13 },
});
