import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, runOnJS, useAnimatedReaction, useAnimatedStyle, useSharedValue, withDecay, withTiming, type SharedValue } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { d8, MONTHS } from '@/lib/days';

// Her sketch (2026-09-30): the days strung on a necklace that hangs in a smile under our heads.
// Drag it sideways and the beads slide along the curve; the one at the bottom is the chosen day.
// Only today is red and larger.
const H = 150;
const LOW = 110; // the lowest point of the chain
const STEP = 0.085; // radians between two beads
const WINDOW = 14;

export type BeadInfo = { has: boolean; marked: boolean };

function Bead({
  i,
  day,
  pos,
  W,
  R,
  today,
  chosen,
  info,
  onPress,
}: {
  i: number;
  day: string;
  pos: SharedValue<number>;
  W: number;
  R: number;
  today: boolean;
  chosen: boolean;
  info: BeadInfo;
  onPress: () => void;
}) {
  const st = useAnimatedStyle(() => {
    const th = (i - pos.value) * STEP;
    const x = W / 2 + R * Math.sin(th);
    const y = LOW - R + R * Math.cos(th);
    return { transform: [{ translateX: x }, { translateY: y }, { rotate: `${-th}rad` }], opacity: Math.max(0.15, 1 - Math.abs(i - pos.value) * 0.07) };
  });
  const d = d8(day);
  const first = d.getUTCDate() === 1;
  const size = today ? 16 : info.has ? 10 : 8;
  return (
    <Animated.View style={[styles.bead, st]}>
      <Pressable onPress={onPress} hitSlop={12} style={styles.hit}>
        {chosen && !today && <View style={styles.halo} />}
        <View style={[styles.dot, { width: size, height: size, borderRadius: size / 2 }, today && styles.today, info.marked && !today && styles.marked]} />
      </Pressable>
      <Text style={[styles.lbl, today && styles.lblToday, chosen && styles.lblOn, first && styles.lblFirst]}>{first ? MONTHS[d.getUTCMonth()].slice(0, 3) : d.getUTCDate()}</Text>
    </Animated.View>
  );
}

export function Necklace({
  days,
  index,
  today,
  infoOf,
  onIndex,
  goRef,
}: {
  days: string[];
  index: number;
  today: string;
  infoOf: (day: string) => BeadInfo;
  onIndex: (i: number) => void;
  goRef: { current: ((i: number) => void) | null };
}) {
  const [W, setW] = useState(0);
  const R = W * 1.25;
  const pos = useSharedValue(index);
  const start = useSharedValue(index);
  const [center, setCenter] = useState(index);
  const last = days.length - 1;

  useEffect(() => {
    goRef.current = (i: number) => {
      pos.set(withTiming(Math.max(0, Math.min(last, i)), { duration: 420, easing: Easing.out(Easing.cubic) }));
    };
  }, [goRef, pos, last]);

  const tick = (i: number) => {
    setCenter(i);
    onIndex(i);
    Haptics.selectionAsync();
  };
  useAnimatedReaction(
    () => Math.round(pos.value),
    (i, prev) => {
      if (prev !== null && i !== prev) runOnJS(tick)(i);
    },
  );

  const pan = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .failOffsetY([-14, 14])
    .onBegin(() => {
      start.set(pos.get());
    })
    .onUpdate((e) => {
      if (!R) return;
      pos.set(Math.max(0, Math.min(last, start.get() - e.translationX / (R * STEP))));
    })
    .onEnd((e) => {
      if (!R) return;
      pos.set(
        withDecay({ velocity: -e.velocityX / (R * STEP), deceleration: 0.994, clamp: [0, last] }, (done) => {
          if (done) pos.set(withTiming(Math.round(pos.get()), { duration: 200, easing: Easing.out(Easing.cubic) }));
        }),
      );
    });

  const a = R ? Math.asin(Math.min(1, (W / 2 + 20) / R)) : 0;
  const cy = LOW - R;
  const chain = R ? `M ${W / 2 - R * Math.sin(a)} ${cy + R * Math.cos(a)} A ${R} ${R} 0 0 0 ${W / 2 + R * Math.sin(a)} ${cy + R * Math.cos(a)}` : '';
  const lo = Math.max(0, center - WINDOW);
  const hi = Math.min(last, center + WINDOW);

  return (
    <GestureDetector gesture={pan}>
      <View style={styles.wrap} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        {W > 0 && (
          <>
            <Svg width={W} height={H} style={StyleSheet.absoluteFill} pointerEvents="none">
              <Path d={chain} stroke="#1c1c1e" strokeWidth={1.2} fill="none" />
            </Svg>
            {days.slice(lo, hi + 1).map((day, k) => {
              const i = lo + k;
              return <Bead key={day} i={i} day={day} pos={pos} W={W} R={R} today={day === today} chosen={i === center} info={infoOf(day)} onPress={() => goRef.current?.(i)} />;
            })}
          </>
        )}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  wrap: { height: H, overflow: 'visible' },
  bead: { position: 'absolute', left: -20, top: -20, width: 40, alignItems: 'center' },
  hit: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  dot: { backgroundColor: '#1c1c1e' },
  today: { backgroundColor: '#ff3b30' },
  marked: { backgroundColor: '#fff', borderWidth: 2, borderColor: '#1c1c1e' },
  halo: { position: 'absolute', width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: '#1c1c1e' },
  lbl: { marginTop: -8, fontSize: 11.5, fontWeight: '600', color: '#8e8e93', fontVariant: ['tabular-nums'] },
  lblToday: { color: '#ff3b30', fontWeight: '800' },
  lblOn: { fontSize: 15, fontWeight: '800', color: '#1c1c1e' },
  lblFirst: { color: '#1c1c1e', fontWeight: '800' },
});
