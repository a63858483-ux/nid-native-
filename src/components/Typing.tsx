import { BlurView } from 'expo-blur';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming, ZoomIn } from 'react-native-reanimated';

import { TAIL_W } from './bubble-path';
import { usePalette } from '@/lib/colors';

function Dot({ delay, color }: { delay: number; color: string }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: 380 }), withTiming(0, { duration: 380 }), withTiming(0, { duration: 300 })), -1));
  }, [v, delay]);
  const st = useAnimatedStyle(() => ({ opacity: 0.35 + v.value * 0.55, transform: [{ translateY: -2.5 * v.value }] }));
  return <Animated.View style={[styles.dot, { backgroundColor: color }, st]} />;
}

// iMessage typing indicator: a pill with two little trailing circles for a tail.
export function Typing() {
  const pal = usePalette();
  const dotColor = pal.chrome ? '#C7C7CC' : '#8E8E93';
  const frost = (style: object) => (
    <View style={[style, { overflow: 'hidden' }]}>
      <BlurView tint={pal.chrome ? 'systemThinMaterialDark' : 'systemThinMaterialLight'} intensity={60} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: pal.hisFill }]} />
    </View>
  );
  return (
    <Animated.View entering={ZoomIn.springify().damping(14)} style={styles.wrap}>
      {frost(styles.big)}
      {frost(styles.small)}
      {frost(styles.pill)}
      <View style={styles.dots} pointerEvents="none">
        <Dot delay={0} color={dotColor} />
        <Dot delay={160} color={dotColor} />
        <Dot delay={320} color={dotColor} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'flex-start', marginLeft: TAIL_W, width: 66, height: 38 },
  pill: { position: 'absolute', left: 0, top: 0, width: 66, height: 38, borderRadius: 19 },
  big: { position: 'absolute', left: -3, bottom: -4, width: 14, height: 14, borderRadius: 7 },
  small: { position: 'absolute', left: -8, bottom: -10, width: 7, height: 7, borderRadius: 3.5 },
  dots: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
