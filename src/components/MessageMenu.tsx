import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';

import { usePalette } from '@/lib/colors';

export type MenuAction = 'reply' | 'sticker';
export const TAPBACKS = ['❤️', '👍', '👎', '😂', '‼️', '❓'];

// Long-press: the bubble lifts out of the list, tapbacks above it, actions below,
// everything else blurred away — the Messages layout.
export function MessageMenu({
  rect,
  mine,
  active,
  bubble,
  onClose,
  onTapback,
  onAction,
}: {
  rect: { x: number; y: number; w: number; h: number };
  mine: boolean;
  active: string[];
  bubble: ReactNode;
  onClose: () => void;
  onTapback: (emoji: string) => void;
  onAction: (a: MenuAction) => void;
}) {
  const pal = usePalette();
  const { width: W, height: H } = useWindowDimensions();
  const barH = 52;
  const menuH = 128;
  // keep bubble + bar + menu on screen
  let top = rect.y;
  const total = barH + 10 + rect.h + 10 + menuH;
  if (top - barH - 10 < 90) top = 90 + barH + 10;
  if (top + rect.h + 10 + menuH > H - 40) top = Math.max(90 + barH + 10, H - 40 - menuH - 10 - rect.h);
  void total;
  const side = mine ? { right: W - (rect.x + rect.w) } : { left: rect.x };
  const items: { key: MenuAction; label: string; icon: SFSymbol }[] = [
    { key: 'reply', label: 'Reply', icon: 'arrowshape.turn.up.left' },
    { key: 'sticker', label: 'Attach Sticker', icon: 'face.smiling' },
  ];
  const cardBg = pal.chrome ? 'rgba(44,44,46,0.92)' : 'rgba(250,250,250,0.94)';
  const ink = pal.chrome ? '#fff' : '#111';

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(140)} style={StyleSheet.absoluteFill}>
        <BlurView tint={pal.chrome ? 'systemThickMaterialDark' : 'systemThinMaterialLight'} intensity={40} style={StyleSheet.absoluteFill} />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View entering={ZoomIn.springify().damping(16)} style={[styles.bar, { top: top - barH - 10, backgroundColor: cardBg }, side]}>
        {TAPBACKS.map((e) => {
          const on = active.includes(e);
          return (
            <Pressable
              key={e}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onTapback(e);
              }}
              style={[styles.tb, on && { backgroundColor: pal.blue }]}>
              <Text style={styles.tbText}>{e}</Text>
            </Pressable>
          );
        })}
      </Animated.View>

      <View style={[styles.bubble, { top, width: rect.w, height: rect.h }, side]} pointerEvents="none">
        {bubble}
      </View>

      <Animated.View entering={ZoomIn.springify().damping(16)} style={[styles.menu, { top: top + rect.h + 10, backgroundColor: cardBg }, side]}>
        {items.map((it, i) => (
          <Pressable
            key={it.key}
            onPress={() => onAction(it.key)}
            style={({ pressed }) => [
              styles.item,
              i > 0 && {
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: pal.line,
              },
              pressed && { backgroundColor: 'rgba(120,120,128,0.15)' },
            ]}>
            <SymbolView name={it.icon} size={20} tintColor={ink} />
            <Text style={[styles.itemText, { color: ink }]}>{it.label}</Text>
          </Pressable>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    height: 52,
    borderRadius: 26,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  tb: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tbText: { fontSize: 24 },
  bubble: { position: 'absolute' },
  menu: {
    position: 'absolute',
    width: 250,
    borderRadius: 18,
    overflow: 'hidden',
    borderCurve: 'continuous',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  item: {
    height: 52,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  itemText: { fontSize: 17 },
});
