import { BlurView } from 'expo-blur';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming, FadeOut } from 'react-native-reanimated';

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

// Messages' typing bubble: the pill breathes a little and the two tail beads
// swell in counter-phase while he types.
const typingEnter = () => {
  'worklet';
  return {
    initialValues: { opacity: 0, transform: [{ translateY: 18 }, { scale: 0.9 }] },
    animations: {
      opacity: withTiming(1, { duration: 200 }),
      transform: [{ translateY: withSpring(0, { damping: 22, stiffness: 190 }) }, { scale: withSpring(1, { damping: 22, stiffness: 220 }) }],
    },
  };
};

export function Typing() {
  const pal = usePalette();
  const dotColor = pal.chrome ? '#C7C7CC' : '#8E8E93';
  const breath = useSharedValue(0);
  useEffect(() => {
    breath.value = withRepeat(
      withSequence(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 900, easing: Easing.inOut(Easing.sin) })),
      -1,
    );
  }, [breath]);
  const pillSt = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.035 * breath.value }] }));
  const bigSt = useAnimatedStyle(() => ({ transform: [{ scale: 1 - 0.12 * breath.value }] }));
  const smallSt = useAnimatedStyle(() => ({ transform: [{ scale: 0.85 + 0.25 * breath.value }] }));

  const frost = (style: object, anim: object) => (
    <Animated.View style={[style, { overflow: 'hidden' }, anim]}>
      <BlurView tint={pal.hisBlur} intensity={pal.hisBlurIntensity} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: pal.hisFill }]} />
    </Animated.View>
  );
  return (
    <Animated.View entering={typingEnter} exiting={FadeOut.duration(160)} style={styles.wrap}>
      {frost(styles.big, bigSt)}
      {frost(styles.small, smallSt)}
      {frost(styles.pill, pillSt)}
      <View style={styles.dots} pointerEvents="none">
        <Dot delay={0} color={dotColor} />
        <Dot delay={160} color={dotColor} />
        <Dot delay={320} color={dotColor} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'flex-start', marginLeft: TAIL_W, width: 66, height: 38, transformOrigin: 'left bottom' },
  pill: { position: 'absolute', left: 0, top: 0, width: 66, height: 38, borderRadius: 19, transformOrigin: 'left bottom' },
  big: { position: 'absolute', left: -3, bottom: -4, width: 14, height: 14, borderRadius: 7 },
  small: { position: 'absolute', left: -8, bottom: -10, width: 7, height: 7, borderRadius: 3.5 },
  dots: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
