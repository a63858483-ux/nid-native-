import * as Haptics from 'expo-haptics';
import { useLocalSearchParams } from 'expo-router';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SheetHeader } from '@/components/SheetHeader';
import { usePalette } from '@/lib/colors';
import { collapseSteps } from '@/lib/traces';
import { useChat } from '@/state/chat';

type Row = { icon: SFSymbol; label: string; full?: string };

// Thought process as the old Nid drew it: a timeline, one small icon per step joined by a thin
// line. The first step is "想了想 ›"; tap it and his thinking opens in place, tap again to fold.
export default function ThoughtSheet() {
  const pal = usePalette();
  const { key } = useLocalSearchParams<{ key: string }>();
  const { items } = useChat();
  const it = items.find((i) => i.key === key);
  const thinking = (it?.thinking || '').trim();
  const rows: Row[] = [
    ...(thinking ? [{ icon: 'clock' as SFSymbol, label: '想了想', full: thinking }] : []),
    ...collapseSteps(it?.traces).map((s) => ({ icon: s.icon as SFSymbol, label: s.label })),
  ];
  const [open, setOpen] = useState(false);
  // Only words, no steps: nothing to fold, the thinking is simply the page.
  if (thinking && rows.length === 1) {
    return (
      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
        <SheetHeader title="Thought process" />
        <Text selectable style={[styles.thought, styles.plain, { color: pal.ink }]}>
          {thinking}
        </Text>
      </ScrollView>
    );
  }
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
      <SheetHeader title="Thought process" />
      <View style={styles.list}>
        {rows.length === 0 && <Text style={[styles.label, { color: pal.ink2 }]}>Nothing here.</Text>}
        {rows.map((r, i) => {
          const last = i === rows.length - 1;
          const expandable = !!r.full;
          const body = (
            <View style={styles.item}>
              <View style={styles.rail}>
                <View style={styles.icon}>
                  <SymbolView name={r.icon} size={15} tintColor={pal.ink2} />
                </View>
                {!last && <View style={[styles.line, { backgroundColor: pal.line }]} />}
              </View>
              <Text selectable={expandable && open} style={[expandable ? styles.thought : styles.label, { color: pal.ink, paddingBottom: last ? 0 : 22 }]}>
                {expandable && open ? r.full : r.label}
              </Text>
              {expandable && !open && <SymbolView name="chevron.right" size={12} weight="semibold" tintColor={pal.meta} style={styles.chev} />}
            </View>
          );
          return expandable ? (
            <Pressable
              key={i}
              onPress={() => {
                Haptics.selectionAsync();
                setOpen((o) => !o);
              }}>
              {body}
            </Pressable>
          ) : (
            <View key={i}>{body}</View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 22, paddingTop: 6 },
  item: { flexDirection: 'row', alignItems: 'stretch', gap: 14 },
  rail: { width: 20, alignItems: 'center' },
  icon: { width: 20, height: 22, alignItems: 'center', justifyContent: 'center' },
  line: { width: 1.5, flex: 1, marginTop: 4 },
  label: { flex: 1, fontSize: 15, lineHeight: 22 },
  thought: { flex: 1, fontSize: 16, lineHeight: 26, fontFamily: 'Georgia' },
  chev: { width: 12, height: 22 },
  plain: { paddingHorizontal: 22, paddingTop: 6 },
});
