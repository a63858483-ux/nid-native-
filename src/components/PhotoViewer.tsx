import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { Easing, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { PhotoOpen } from './Bubble';

const OPEN = { duration: 340, easing: Easing.out(Easing.cubic) };
const CLOSE = { duration: 280, easing: Easing.inOut(Easing.cubic) };

// Messages' photo view: the picture grows out of its bubble onto black, chrome fades in,
// pinch or double-tap to zoom, drag down to put it back.
export function PhotoViewer({ photo, onClosed }: { photo: PhotoOpen; onClosed: () => void }) {
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [chrome, setChrome] = useState(true);
  const r = photo.rect;
  let tw = W;
  let th = W / photo.ratio;
  if (th > H) {
    th = H;
    tw = H * photo.ratio;
  }
  const target = { x: (W - tw) / 2, y: (H - th) / 2, w: tw, h: th };

  const p = useSharedValue(0); // 0 = in the bubble, 1 = full screen
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedT = useSharedValue({ x: 0, y: 0 });
  const drag = useSharedValue(0); // how far a dismissing drag has gone, 0-1

  useEffect(() => {
    p.set(withTiming(1, OPEN));
  }, [p]);

  const close = () => {
    'worklet';
    scale.value = withTiming(1, CLOSE);
    tx.value = withTiming(0, CLOSE);
    ty.value = withTiming(0, CLOSE);
    drag.value = withTiming(0, CLOSE);
    p.set(withTiming(0, CLOSE, (done) => done && runOnJS(onClosed)()));
  };

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(0.8, Math.min(5, savedScale.value * e.scale));
    })
    .onEnd(() => {
      if (scale.value < 1) {
        scale.value = withSpring(1, { damping: 20 });
        tx.value = withSpring(0, { damping: 20 });
        ty.value = withSpring(0, { damping: 20 });
        savedT.value = { x: 0, y: 0 };
      }
      savedScale.value = Math.max(1, scale.value);
    });

  const pan = Gesture.Pan()
    .averageTouches(true)
    .onUpdate((e) => {
      if (savedScale.value > 1) {
        tx.value = savedT.value.x + e.translationX;
        ty.value = savedT.value.y + e.translationY;
      } else {
        tx.value = e.translationX * 0.6;
        ty.value = e.translationY;
        drag.value = Math.min(1, Math.abs(e.translationY) / 320);
      }
    })
    .onEnd((e) => {
      if (savedScale.value > 1) {
        savedT.value = { x: tx.value, y: ty.value };
        return;
      }
      if (Math.abs(e.translationY) > 110 || Math.abs(e.velocityY) > 900) {
        runOnJS(setChrome)(false);
        close();
      } else {
        tx.value = withSpring(0, { damping: 20 });
        ty.value = withSpring(0, { damping: 20 });
        drag.value = withTiming(0, { duration: 180 });
      }
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((e) => {
      if (savedScale.value > 1) {
        scale.value = withTiming(1, OPEN);
        tx.value = withTiming(0, OPEN);
        ty.value = withTiming(0, OPEN);
        savedScale.value = 1;
        savedT.value = { x: 0, y: 0 };
      } else {
        const k = 2.5;
        // zoom toward the tapped point
        const nx = (W / 2 - e.x) * (k - 1);
        const ny = (H / 2 - e.y) * (k - 1);
        scale.value = withTiming(k, OPEN);
        tx.value = withTiming(nx, OPEN);
        ty.value = withTiming(ny, OPEN);
        savedScale.value = k;
        savedT.value = { x: nx, y: ny };
      }
    });
  const toggleChrome = () => setChrome((c) => !c);
  const singleTap = Gesture.Tap().onEnd(() => runOnJS(toggleChrome)());
  const gesture = Gesture.Simultaneous(pinch, pan, Gesture.Exclusive(doubleTap, singleTap));

  const frame = useAnimatedStyle(() => ({
    left: interpolate(p.value, [0, 1], [r.x, target.x]),
    top: interpolate(p.value, [0, 1], [r.y, target.y]),
    width: interpolate(p.value, [0, 1], [r.w, target.w]),
    height: interpolate(p.value, [0, 1], [r.h, target.h]),
    borderRadius: interpolate(p.value, [0, 1], [18, 0]),
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value * (1 - drag.value * 0.25) }],
  }));
  const backdrop = useAnimatedStyle(() => ({ opacity: p.value * (1 - drag.value) }));
  const chromeSt = useAnimatedStyle(() => ({ opacity: p.value * (1 - drag.value * 2) }));

  const share = async () => {
    Haptics.selectionAsync();
    try {
      await Share.share({ url: photo.uri });
    } catch {
      // the share sheet was dismissed or the download failed; nothing to undo
    }
  };

  return (
    <GestureHandlerRootView style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.black, backdrop]} />
      <GestureDetector gesture={gesture}>
        <View style={StyleSheet.absoluteFill}>
          <Animated.View style={[styles.frame, frame]}>
            <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
          </Animated.View>
        </View>
      </GestureDetector>

      {chrome && (
        <Animated.View style={[StyleSheet.absoluteFill, chromeSt]} pointerEvents="box-none">
          <View style={[styles.top, { paddingTop: insets.top + 6 }]} pointerEvents="box-none">
            <View style={{ width: 44 }} />
            <Text style={styles.title}>Photo</Text>
            <Pressable onPress={() => close()} accessibilityLabel="Close">
              <View style={styles.circle}>
                <BlurView tint="systemThinMaterialDark" intensity={80} style={StyleSheet.absoluteFill} />
                <SymbolView name="xmark" size={17} weight="medium" tintColor="#fff" />
              </View>
            </Pressable>
          </View>
          <View style={[styles.bottom, { paddingBottom: insets.bottom + 8 }]} pointerEvents="box-none">
            <View />
            <Pressable onPress={share} accessibilityLabel="Share">
              <View style={styles.circle}>
                <BlurView tint="systemThinMaterialDark" intensity={80} style={StyleSheet.absoluteFill} />
                <SymbolView name="square.and.arrow.up" size={18} weight="medium" tintColor="#fff" />
              </View>
            </Pressable>
          </View>
        </Animated.View>
      )}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  black: { backgroundColor: '#000' },
  frame: { position: 'absolute', overflow: 'hidden', borderCurve: 'continuous' },
  top: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14 },
  title: { color: '#fff', fontSize: 17, fontWeight: '600' },
  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 18 },
  circle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
