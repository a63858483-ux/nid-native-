import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { Glass } from './Glass';
import { usePalette } from '@/lib/colors';

export type PlusAction = 'camera' | 'photos' | 'files' | 'model' | 'checklist' | 'bubble' | 'wallpaper';

const ITEMS: { key: PlusAction; label: string; icon: SFSymbol; color: string }[] = [
  { key: 'camera', label: 'Camera', icon: 'camera.fill', color: '#5E5E62' },
  { key: 'photos', label: 'Photos', icon: 'photo.on.rectangle', color: '#FF7A93' },
  { key: 'files', label: 'Files', icon: 'folder.fill', color: '#3B82F6' },
  { key: 'model', label: 'Model', icon: 'slider.horizontal.3', color: '#3A3A3C' },
  { key: 'checklist', label: 'Checklist', icon: 'checklist', color: '#F2A516' },
  { key: 'bubble', label: 'Bubble', icon: 'paintpalette.fill', color: '#F58AA4' },
  { key: 'wallpaper', label: 'Wallpaper', icon: 'photo.artframe', color: '#4F9F7A' },
];

const ROW = 66;

// Messages' plus panel: a fixed-height sheet growing out of the + button. With the
// keyboard closed it sits just above the home indicator, covering the composer;
// with the keyboard open it stays over the keyboard (the keyboard does not hide).
// The + itself turns into ✕ and stays on top.
export function PlusMenu({
  open,
  bottomInset,
  topInset,
  note,
  onClose,
  onPick,
}: {
  open: boolean;
  bottomInset: number;
  topInset: number;
  note?: string;
  onClose: () => void;
  onPick: (a: PlusAction) => void;
}) {
  const pal = usePalette();
  const { height: screenH } = useWindowDimensions();
  const { height: kb } = useReanimatedKeyboardAnimation(); // 0 closed, -keyboardHeight open
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = open ? withSpring(1, { damping: 17, stiffness: 240, mass: 0.8 }) : withTiming(0, { duration: 160 });
  }, [open, p]);

  const wanted = ITEMS.length * ROW + 16;
  const bottom = bottomInset + 8;
  const panel = useAnimatedStyle(() => {
    const lift = -kb.value * 0.45;
    const room = screenH - topInset - bottom - lift - 8;
    return {
      opacity: Math.min(1, p.value * 1.6),
      height: Math.max(ROW * 3, Math.min(wanted, room)),
      transform: [{ translateY: -lift + (1 - p.value) * 16 }, { scale: 0.55 + 0.45 * p.value }],
    };
  });
  // the ✕ rides with the composer, which the sticky view lifts by the full keyboard height
  const closeSt = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ translateY: kb.value + (kb.value < 0 ? bottomInset - 6 : 0) }] }));
  const veil = useAnimatedStyle(() => ({ opacity: p.value }));
  const ink = pal.chrome ? '#FFFFFF' : pal.ink;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={open ? 'auto' : 'none'}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.veil, veil]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View style={[styles.anchor, { bottom }, panel]}>
        <View style={styles.panel}>
          <BlurView tint={pal.chrome ? 'systemThickMaterialDark' : 'systemThickMaterialLight'} intensity={90} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: pal.chrome ? 'rgba(28,28,30,0.35)' : 'rgba(255,255,255,0.25)' }]} />
          <ScrollView bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
            {ITEMS.map((it, i) => (
              <Pressable
                key={it.key}
                onPress={() => {
                  Haptics.selectionAsync();
                  onPick(it.key);
                }}
                style={({ pressed }) => [styles.item, pressed && { backgroundColor: 'rgba(120,120,128,0.18)' }, (i === 3 || i === 5) && styles.gap]}>
                <View style={[styles.icon, { backgroundColor: it.color }]}>
                  <SymbolView name={it.icon} size={22} tintColor="#fff" />
                </View>
                <Text style={[styles.label, { color: ink }]}>{it.label}</Text>
                {it.key === 'model' && note ? <Text style={[styles.note, { color: pal.chrome ? 'rgba(255,255,255,0.6)' : pal.ink2 }]}>{note}</Text> : null}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Animated.View>
      <Animated.View style={[styles.close, { bottom: bottomInset + 6 }, closeSt]}>
        <Pressable onPress={onClose} accessibilityLabel="Close">
          <Glass interactive tint={pal.wall ? 'rgba(30,30,32,0.5)' : undefined} style={styles.closeBtn}>
            <SymbolView name="xmark" size={18} weight="medium" tintColor={pal.wall ? '#fff' : pal.ink} />
          </Glass>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  veil: { backgroundColor: 'rgba(0,0,0,0.08)' },
  anchor: { position: 'absolute', left: 12, width: '72%', maxWidth: 320, transformOrigin: 'left bottom' },
  panel: { flex: 1, borderRadius: 34, overflow: 'hidden', borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.25)' },
  list: { paddingVertical: 8, paddingHorizontal: 8 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 16, height: ROW, paddingHorizontal: 12, borderRadius: 24 },
  gap: { marginTop: 4 },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 21, fontWeight: '500', letterSpacing: -0.2 },
  note: { marginLeft: 'auto', fontSize: 13 },
  close: { position: 'absolute', left: 12 },
  closeBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
