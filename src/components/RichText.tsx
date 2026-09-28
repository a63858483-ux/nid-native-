import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { parseRich, type Effect, type Run } from '@/lib/rich';

// Text with **bold** / _italic_ / __underline__ / ~~strike~~ and [fx:…] effects,
// modelled on Messages' text effects: the marked words move, the rest of the line sits still.
// `fxOnly` + `loop` is the composer's live preview layer: only the moving words show, over and over.
export function RichText({ text, style, selectable, fxOnly, loop }: { text: string; style: StyleProp<TextStyle>; selectable?: boolean; fxOnly?: boolean; loop?: boolean }) {
  const runs = parseRich(text);
  return (
    <Text selectable={selectable} style={style}>
      {runs.map((r, i) =>
        r.fx && fxOnly && STILL.includes(r.fx) ? (
          <Text key={i} style={[runStyle(r), { fontSize: fxSize(style, r.fx) }, styles.hidden]}>
            {r.text}
          </Text>
        ) : r.fx ? (
          <FxRun key={i} run={r} style={style} loop={loop} />
        ) : (
          <Text key={i} style={[runStyle(r), fxOnly && styles.hidden]}>
            {r.text}
          </Text>
        ),
      )}
    </Text>
  );
}

const runStyle = (r: Run): TextStyle => ({
  fontWeight: r.bold ? '700' : undefined,
  fontStyle: r.italic ? 'italic' : undefined,
  textDecorationLine: r.underline && r.strike ? 'underline line-through' : r.underline ? 'underline' : r.strike ? 'line-through' : undefined,
});

const PER_CHAR: Effect[] = ['ripple', 'jitter'];
// big/small are drawn by the composer field itself; the preview layer only keeps their room
const STILL: Effect[] = ['big', 'small'];
export const fxSize = (style: StyleProp<TextStyle>, fx: Effect) => (StyleSheet.flatten(style)?.fontSize ?? 17) * (fx === 'big' ? 1.45 : fx === 'small' ? 0.78 : 1);

// Like Messages, an effect plays when the bubble comes on screen, then rests; tap to replay.
function FxRun({ run, style, loop }: { run: Run; style: StyleProp<TextStyle>; loop?: boolean }) {
  const fx = run.fx!;
  const [tick, setTick] = useState(0);
  const replay = () => setTick((t) => t + 1);
  useEffect(() => {
    if (!loop) return;
    const t = setInterval(() => setTick((n) => n + 1), 2600);
    return () => clearInterval(t);
  }, [loop]);
  const flat = StyleSheet.flatten(style) || {};
  const size = fxSize(style, fx);
  const lh = (flat.lineHeight ?? 22) * (fx === 'big' ? 1.35 : 1);
  const base: TextStyle = { ...flat, ...runStyle(run), fontSize: size, lineHeight: lh };
  if (PER_CHAR.includes(fx)) {
    return (
      <Text style={base}>
        {Array.from(run.text).map((ch, i) => (
          <View key={i} style={{ marginBottom: -(lh - size) / 2 - 3 }}>
            <Piece fx={fx} index={i} style={base} tick={tick} onTap={replay}>
              {ch}
            </Piece>
          </View>
        ))}
      </Text>
    );
  }
  // inline view lets the whole phrase move as one
  return (
    <View style={{ marginBottom: -(lh - size) / 2 - 3 }}>
      <Piece fx={fx} index={0} style={base} tick={tick} onTap={replay}>
        {run.text}
      </Piece>
    </View>
  );
}

function Piece({ fx, index, style, tick, onTap, children }: { fx: Effect; index: number; style: TextStyle; tick: number; onTap: () => void; children: string }) {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const s = useSharedValue(1);
  const o = useSharedValue(1);
  const rot = useSharedValue(0);

  useEffect(() => {
    const stop = () => [x, y, s, o, rot].forEach(cancelAnimation);
    stop();
    const rest = (v: number) => withTiming(v, { duration: 90 });
    if (fx === 'shake') {
      x.value = withSequence(withRepeat(withSequence(withTiming(-2.5, { duration: 55 }), withTiming(2.5, { duration: 55 })), 7, true), rest(0));
      rot.value = withSequence(withRepeat(withSequence(withTiming(-1.5, { duration: 70 }), withTiming(1.5, { duration: 70 })), 5, true), rest(0));
    } else if (fx === 'nod') {
      const ease = { easing: Easing.inOut(Easing.quad) };
      y.value = withSequence(
        withRepeat(withSequence(withTiming(-4, { duration: 320, ...ease }), withTiming(2, { duration: 320, ...ease })), 2, false),
        withTiming(0, { duration: 240, ...ease }),
      );
    } else if (fx === 'ripple') {
      y.value = withDelay(
        index * 70,
        withSequence(withTiming(-6, { duration: 260, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 420, easing: Easing.inOut(Easing.quad) })),
      );
    } else if (fx === 'jitter') {
      const j = () => withSequence(withTiming((Math.random() - 0.5) * 3, { duration: 40 }), withTiming((Math.random() - 0.5) * 3, { duration: 40 }));
      x.value = withSequence(withRepeat(j(), 12, true), rest(0));
      y.value = withDelay(index * 13, withSequence(withRepeat(j(), 12, true), rest(0)));
    } else if (fx === 'bloom') {
      s.value = withSequence(withTiming(1.22, { duration: 900, easing: Easing.out(Easing.cubic) }), withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }));
      o.value = withSequence(withTiming(0.75, { duration: 900 }), withTiming(1, { duration: 1100 }));
    } else if (fx === 'big' || fx === 'small') {
      s.value = fx === 'big' ? 0.6 : 1.3;
      s.value = withSpring(1, { damping: 9, stiffness: 180 });
    } else if (fx === 'explode') {
      s.value = 2.4;
      o.value = 0;
      s.value = withSpring(1, { damping: 8, stiffness: 160 });
      o.value = withTiming(1, { duration: 140 });
      rot.value = withSequence(withTiming(-8, { duration: 0 }), withSpring(0, { damping: 6, stiffness: 120 }));
    }
    return stop;
  }, [fx, index, tick, x, y, s, o, rot]);

  const st = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateX: x.value }, { translateY: y.value }, { scale: s.value }, { rotate: `${rot.value}deg` }] }));
  return (
    <Pressable onPress={onTap}>
      <Animated.Text style={[style, st]}>{children}</Animated.Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({ hidden: { color: 'transparent' } });
