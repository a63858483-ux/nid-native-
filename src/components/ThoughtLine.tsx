import * as Haptics from 'expo-haptics';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { TAIL_W } from './bubble-path';
import { usePalette } from '@/lib/colors';

const WEEKDAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const pad = (n: number) => String(n).padStart(2, '0');
// Nid runs on Beijing time whatever the phone's zone says.
function beijing(iso: string) {
  const d = new Date(new Date(iso).getTime() + 8 * 3600_000);
  return {
    hh: pad(d.getUTCHours()),
    mm: pad(d.getUTCMinutes()),
    wd: WEEKDAYS[d.getUTCDay()],
    date: `${String(d.getUTCFullYear()).slice(2)}/${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())}`,
  };
}

// The clock before his reply: tap it for when he sent it; the label opens his thought process.
export function ThoughtLine({ label, live, icon, ts, onPress }: { label: string; live: boolean; icon?: string; ts: string; onPress: () => void }) {
  const pal = usePalette();
  const [open, setOpen] = useState(false);
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.set(live ? withRepeat(withTiming(0.35, { duration: 700 }), -1, true) : withTiming(1));
  }, [live, pulse]);
  const st = useAnimatedStyle(() => ({ opacity: pulse.value }));
  const t = beijing(ts);
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            setOpen((o) => !o);
          }}
          hitSlop={10}
          accessibilityLabel="Sent at">
          <Animated.View style={st}>
            <SymbolView name={(icon as SFSymbol) || 'clock'} size={13} tintColor={pal.meta} />
          </Animated.View>
        </Pressable>
        {label ? (
          <Pressable onPress={onPress} disabled={live} hitSlop={8} style={({ pressed }) => [styles.labelRow, pressed && { opacity: 0.5 }]}>
            <Text style={[styles.label, { color: pal.meta }]}>{label}</Text>
            {!live && <SymbolView name="chevron.right" size={10} weight="semibold" tintColor={pal.meta} />}
          </Pressable>
        ) : (
          // No thinking to open: the clock just says when (her call, 2026-09-30).
          <Text style={[styles.label, styles.time, { color: pal.meta }]}>
            {t.hh}:{t.mm}
          </Text>
        )}
      </View>
      {open && (
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(120)}
          style={[styles.stamp, { backgroundColor: pal.chrome ? 'rgba(40,40,44,0.78)' : 'rgba(255,255,255,0.86)' }]}>
          <Text style={[styles.big, { color: pal.chrome ? '#fff' : '#111' }]}>
            {t.hh}:{t.mm}
          </Text>
          <View style={[styles.bar, { backgroundColor: pal.chrome ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.3)' }]} />
          <View style={styles.side}>
            <Text style={[styles.wd, { color: pal.chrome ? 'rgba(255,255,255,0.95)' : '#111' }]}>{t.wd}</Text>
            <Text style={[styles.dt, { color: pal.chrome ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.55)' }]}>{t.date}</Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginLeft: TAIL_W + 4, marginBottom: 4, alignSelf: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  label: { fontSize: 12.5, fontWeight: '600', fontVariant: ['tabular-nums'] },
  time: { fontWeight: '500' },
  stamp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
    marginBottom: 4,
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: 16,
    borderRadius: 16,
    borderCurve: 'continuous',
    alignSelf: 'flex-start',
  },
  big: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 34, lineHeight: 36, letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  bar: { width: StyleSheet.hairlineWidth * 2, height: 34 },
  side: { gap: 3 },
  wd: { fontFamily: 'JosefinSans_600SemiBold', fontSize: 12, letterSpacing: 2.6 },
  dt: { fontFamily: 'JosefinSans_400Regular', fontSize: 12.5, letterSpacing: 1.8, fontVariant: ['tabular-nums'] },
});
