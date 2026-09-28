import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, LinearTransition, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import * as Haptics from 'expo-haptics';

import { Glass } from './Glass';
import type { Attachment } from '@/lib/api';
import { inkOn, usePalette } from '@/lib/colors';
import { EFFECTS, wrapSelection, type Effect } from '@/lib/rich';

import { TextMenu } from '../../modules/nid-text-menu';

const SPRING = { damping: 16, stiffness: 260, mass: 0.7 };

export type Pending = {
  local: string;
  att?: Attachment;
  name: string;
  isImage: boolean;
  uploading: boolean;
};

export function Composer({
  myColor,
  plusOpen,
  pending,
  onRemovePending,
  onPlus,
  onSend,
  placeholder = 'Message',
}: {
  myColor: string;
  plusOpen: boolean;
  pending: Pending[];
  onRemovePending: (local: string) => void;
  onPlus: () => void;
  onSend: (text: string) => void;
  placeholder?: string;
}) {
  const pal = usePalette();
  const [text, setText] = useState('');
  const [sentTick, setSentTick] = useState(0);
  // Select words, then Text Effects in the system edit menu (native module) wraps them.
  // Builds without that module fall back to a small bar shown while something is selected.
  const [focused, setFocused] = useState(false);
  const [hasSel, setHasSel] = useState(false);
  const [fxOpen, setFxOpen] = useState(false);
  const sel = useRef({ start: 0, end: 0 });
  const input = useRef<TextInput>(null);
  const format = (kind: 'bold' | 'italic' | 'underline' | 'strike' | Effect) => {
    const r = wrapSelection(text, sel.current, kind);
    if (r.text === text) return;
    Haptics.selectionAsync();
    setText(r.text);
    sel.current = r.sel;
    setFxOpen(false);
  };
  const barVisible = !TextMenu && focused && hasSel;
  useEffect(() => {
    if (!TextMenu || !focused) return;
    const sub = TextMenu.addListener('onTextEffect', (e) => {
      sel.current = { start: e.start, end: e.end };
      format(e.kind as Effect);
    });
    return () => sub.remove();
  });
  const uploading = pending.some((p) => p.uploading);
  const ready = (text.trim().length > 0 || pending.length > 0) && !uploading;
  const show = useSharedValue(0);
  const rot = useSharedValue(0);
  const morph = useSharedValue(0);

  useEffect(() => {
    show.value = withSpring(ready ? 1 : 0, SPRING);
  }, [ready, show]);
  useEffect(() => {
    rot.value = withSpring(plusOpen ? 45 : 0, SPRING);
  }, [plusOpen, rot]);
  useEffect(() => {
    if (!sentTick) return;
    morph.value = withSequence(withTiming(1, { duration: 70 }), withTiming(1, { duration: 110 }), withTiming(0, { duration: 120 }));
  }, [sentTick, morph]);

  const sendSt = useAnimatedStyle(() => ({
    opacity: show.value,
    transform: [{ scale: 0.4 + 0.6 * show.value }],
  }));
  const micSt = useAnimatedStyle(() => ({
    opacity: 1 - show.value,
    transform: [{ scale: 1 - 0.4 * show.value }],
  }));
  const plusSt = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rot.value}deg` }],
  }));
  // iMessage: the typed text tints to the bubble colour in place, then leaves the field.
  const morphSt = useAnimatedStyle(() => ({ opacity: morph.value }));

  const tint = pal.wall ? 'rgba(30,30,32,0.5)' : undefined;
  const ink = pal.wall ? '#FFFFFF' : pal.ink;
  const ink2 = pal.wall ? 'rgba(255,255,255,0.6)' : pal.ink2;
  const sendColor = myColor === 'glass' ? pal.blue : myColor;
  const sendInk = myColor === 'glass' ? '#fff' : inkOn(sendColor);
  const submit = () => {
    if (!ready) return;
    setSentTick((n) => n + 1);
    onSend(text);
    setText('');
  };

  return (
    <View>
      {barVisible && (
        <Animated.View entering={FadeInDown.duration(160)} exiting={FadeOutDown.duration(120)} layout={LinearTransition.springify().damping(18)} style={styles.barRow}>
          <Glass tint={tint} style={styles.bar}>
            {fxOpen ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always" contentContainerStyle={styles.fxRow}>
                <Pressable onPress={() => setFxOpen(false)} hitSlop={6} style={styles.fmt}>
                  <SymbolView name="chevron.left" size={13} weight="bold" tintColor={ink} />
                </Pressable>
                {EFFECTS.map((e) => (
                  <Pressable
                    key={e}
                    onPress={() => format(e)}
                    style={[
                      styles.fxChip,
                      {
                        backgroundColor: pal.wall ? 'rgba(255,255,255,0.14)' : 'rgba(120,120,128,0.14)',
                      },
                    ]}>
                    <Text style={[styles.fxText, { color: ink }, e === 'big' && { fontSize: 15 }, e === 'small' && { fontSize: 11 }]}>{e[0].toUpperCase() + e.slice(1)}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : (
              <View style={styles.fmtRow}>
                <Pressable onPress={() => format('bold')} style={styles.fmt}>
                  <Text style={[styles.fmtText, { color: ink, fontWeight: '800' }]}>B</Text>
                </Pressable>
                <Pressable onPress={() => format('italic')} style={styles.fmt}>
                  <Text
                    style={[
                      styles.fmtText,
                      {
                        color: ink,
                        fontStyle: 'italic',
                        fontFamily: 'Georgia',
                      },
                    ]}>
                    I
                  </Text>
                </Pressable>
                <Pressable onPress={() => format('underline')} style={styles.fmt}>
                  <Text style={[styles.fmtText, { color: ink, textDecorationLine: 'underline' }]}>U</Text>
                </Pressable>
                <Pressable onPress={() => format('strike')} style={styles.fmt}>
                  <Text style={[styles.fmtText, { color: ink, textDecorationLine: 'line-through' }]}>S</Text>
                </Pressable>
                <View style={[styles.vline, { backgroundColor: ink2 }]} />
                <Pressable onPress={() => setFxOpen(true)} style={[styles.fmt, { flexDirection: 'row', gap: 4, paddingHorizontal: 10 }]}>
                  <SymbolView name="textformat" size={15} weight="semibold" tintColor={ink} />
                  <Text style={[styles.fxLabel, { color: ink }]}>Effects</Text>
                </Pressable>
              </View>
            )}
          </Glass>
        </Animated.View>
      )}
      <View style={styles.row}>
        <Pressable onPress={onPlus} accessibilityLabel="More">
          <Glass interactive tint={tint} style={styles.circle}>
            <Animated.View style={plusSt}>
              <SymbolView name="plus" size={20} weight="medium" tintColor={ink} />
            </Animated.View>
          </Glass>
        </Pressable>
        <Glass tint={tint} style={styles.pill}>
          {pending.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="always">
              {pending.map((p) => (
                <View key={p.local} style={[styles.chip, { backgroundColor: pal.card }, p.uploading && { opacity: 0.55 }]}>
                  {p.isImage ? (
                    <Image source={p.local} style={styles.chipImg} contentFit="cover" />
                  ) : (
                    <View style={styles.chipDoc}>
                      <SymbolView name="doc.fill" size={16} tintColor={pal.ink2} />
                      <Text numberOfLines={1} style={[styles.chipName, { color: pal.ink }]}>
                        {p.name}
                      </Text>
                    </View>
                  )}
                  <Pressable onPress={() => onRemovePending(p.local)} hitSlop={8} style={styles.chipX} accessibilityLabel="Remove">
                    <SymbolView name="xmark" size={9} weight="bold" tintColor="#fff" />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          )}
          <View style={styles.inrow}>
            <View style={{ flex: 1 }}>
              <TextInput
                ref={input}
                value={text}
                onChangeText={setText}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onSelectionChange={(e) => {
                  sel.current = e.nativeEvent.selection;
                  setHasSel(e.nativeEvent.selection.end > e.nativeEvent.selection.start);
                }}
                placeholder={placeholder}
                placeholderTextColor={ink2}
                multiline
                style={[styles.input, { color: ink }]}
              />
              <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.morph, { backgroundColor: sendColor }, morphSt]}>
                <Text numberOfLines={5} style={[styles.input, { color: sendInk }]}>
                  {text}
                </Text>
              </Animated.View>
            </View>
            <View style={styles.action}>
              <Animated.View style={[StyleSheet.absoluteFill, styles.center, micSt]} pointerEvents={ready ? 'none' : 'auto'}>
                <SymbolView name="mic" size={19} tintColor={ink2} />
              </Animated.View>
              <Animated.View style={[StyleSheet.absoluteFill, sendSt]} pointerEvents={ready ? 'auto' : 'none'}>
                <Pressable onPress={submit} accessibilityLabel="Send" style={[styles.send, { backgroundColor: sendColor }]}>
                  <SymbolView name="arrow.up" size={16} weight="bold" tintColor={sendInk} />
                </Pressable>
              </Animated.View>
            </View>
          </View>
        </Glass>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  barRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 6,
  },
  bar: {
    height: 38,
    borderRadius: 19,
    paddingHorizontal: 6,
    justifyContent: 'center',
    maxWidth: '100%',
  },
  fmtRow: { flexDirection: 'row', alignItems: 'center' },
  fmt: {
    minWidth: 36,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fmtText: { fontSize: 17 },
  vline: {
    width: StyleSheet.hairlineWidth,
    height: 18,
    marginHorizontal: 4,
    opacity: 0.6,
  },
  fxLabel: { fontSize: 14, fontWeight: '600' },
  fxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 4,
  },
  fxChip: {
    height: 28,
    paddingHorizontal: 11,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fxText: { fontSize: 13.5, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  circle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    flex: 1,
    minHeight: 44,
    borderRadius: 22,
    paddingLeft: 14,
    paddingRight: 5,
    paddingVertical: 5,
  },
  chips: { gap: 6, paddingTop: 4, paddingBottom: 8, paddingRight: 6 },
  chip: { height: 72, borderRadius: 14, overflow: 'hidden' },
  chipImg: { height: 72, width: 72 },
  chipDoc: {
    height: 72,
    width: 150,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  chipName: { flex: 1, fontSize: 12.5, fontWeight: '600' },
  chipX: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inrow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  input: {
    fontSize: 17,
    lineHeight: 22,
    maxHeight: 132,
    paddingTop: 6,
    paddingBottom: 6,
  },
  morph: {
    borderRadius: 17,
    paddingHorizontal: 12,
    marginLeft: -12,
    marginRight: -4,
    justifyContent: 'flex-end',
  },
  action: { width: 34, height: 34, marginLeft: 2 },
  center: { alignItems: 'center', justifyContent: 'center' },
  send: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
