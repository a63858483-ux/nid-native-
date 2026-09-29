import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeInDown,
  FadeOutDown,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  ZoomIn,
  ZoomOut,
} from 'react-native-reanimated';

import * as Haptics from 'expo-haptics';

import { Glass } from './Glass';
import type { Attachment } from '@/lib/api';
import { inkOn, usePalette } from '@/lib/colors';
import { RichText, fxSize } from './RichText';
import { isFormat, piecesOf, serialize, shiftSpans, toggleSpan, type Kind, type Span } from '@/lib/compose';
import { EFFECTS, type Effect } from '@/lib/rich';

import { TextMenu } from '../../modules/nid-text-menu';

const SPRING = { damping: 16, stiffness: 260, mass: 0.7 };
const MIN_H = 34;
const MAX_H = 132;

// Moving effects are drawn by the preview layer on top, so the field leaves those words invisible.
function pieceStyle(kinds: Kind[]): TextStyle | undefined {
  if (!kinds.length) return undefined;
  const has = (k: Kind) => kinds.includes(k);
  const fx = kinds.find((k) => (EFFECTS as readonly string[]).includes(k)) as Effect | undefined;
  return {
    fontWeight: has('bold') ? '700' : undefined,
    fontStyle: has('italic') ? 'italic' : undefined,
    textDecorationLine: has('underline') && has('strike') ? 'underline line-through' : has('underline') ? 'underline' : has('strike') ? 'line-through' : undefined,
    fontSize: fx === 'big' || fx === 'small' ? fxSize(styles.input, fx) : undefined,
    color: fx && fx !== 'big' && fx !== 'small' ? 'transparent' : undefined,
  };
}

export type HoldEvent = { phase: 'start' | 'move' | 'end'; x: number; y: number };

export type Pending = { local: string; att?: Attachment; name: string; isImage: boolean; uploading: boolean };

export function Composer({
  myColor,
  plusOpen,
  pending,
  onRemovePending,
  onPlus,
  onSend,
  placeholder = 'Message',
  autoFocus,
  talk,
  onTalk,
  onHold,
}: {
  myColor: string;
  plusOpen: boolean;
  pending: Pending[];
  onRemovePending: (local: string) => void;
  onPlus: () => void;
  onSend: (text: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  // Hold to Talk: the mic swaps the field for a bar; holding it records (handled by the screen).
  talk?: boolean;
  onTalk?: (on: boolean) => void;
  onHold?: (e: HoldEvent) => void;
}) {
  const pal = usePalette();
  // Plain text plus styled ranges: formatting shows in the field, markup only on send.
  const [text, setText] = useState('');
  const [spans, setSpans] = useState<Span[]>([]);
  const [contentH, setContentH] = useState(MIN_H);
  const [sentTick, setSentTick] = useState(0);
  // Select words, then Text Effects in the system edit menu (native module) wraps them.
  // Builds without that module fall back to a small bar shown while something is selected.
  const [focused, setFocused] = useState(false);
  const [hasSel, setHasSel] = useState(false);
  const [fxOpen, setFxOpen] = useState(false);
  const sel = useRef({ start: 0, end: 0 });
  const input = useRef<TextInput>(null);
  const format = (kind: Kind) => {
    const { start, end } = sel.current;
    if (end <= start || !text.slice(start, end).trim()) return;
    Haptics.selectionAsync();
    setSpans((cur) => toggleSpan(cur, start, end, kind));
    setFxOpen(false);
  };
  const onChange = (t: string) => {
    setSpans((cur) => shiftSpans(cur, text, t));
    setText(t);
  };
  const barVisible = !TextMenu && focused && hasSel;
  useEffect(() => {
    if (!TextMenu || !focused) return;
    const sub = TextMenu.addListener('onTextEffect', (e) => {
      sel.current = { start: e.start, end: e.end };
      format(e.kind as Kind);
    });
    return () => sub.remove();
  });
  const uploading = pending.some((p) => p.uploading);
  const ready = (text.trim().length > 0 || pending.length > 0) && !uploading;
  const rot = useSharedValue(0);
  const morph = useSharedValue(0);

  useEffect(() => {
    rot.set(withSpring(plusOpen ? 45 : 0, SPRING));
  }, [plusOpen, rot]);
  useEffect(() => {
    if (!sentTick) return;
    morph.set(withSequence(withTiming(1, { duration: 70 }), withTiming(1, { duration: 110 }), withTiming(0, { duration: 120 })));
  }, [sentTick, morph]);

  const plusSt = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value}deg` }] }));
  // iMessage: the typed text tints to the bubble colour in place, then leaves the field.
  const morphSt = useAnimatedStyle(() => ({ opacity: morph.value }));

  const tint = pal.wall ? 'rgba(30,30,32,0.5)' : undefined;
  const ink = pal.wall ? '#FFFFFF' : pal.ink;
  const ink2 = pal.wall ? 'rgba(255,255,255,0.6)' : pal.ink2;
  const sendColor = myColor === 'glass' ? pal.blue : myColor;
  const sendInk = myColor === 'glass' ? '#fff' : inkOn(sendColor);
  const moving = spans.some((sp) => !isFormat(sp.kind) && sp.kind !== 'big' && sp.kind !== 'small');
  const submit = () => {
    if (!ready) return;
    setSentTick((n) => n + 1);
    onSend(serialize(text, spans));
    setText('');
    setSpans([]);
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
                  <Pressable key={e} onPress={() => format(e)} style={[styles.fxChip, { backgroundColor: pal.wall ? 'rgba(255,255,255,0.14)' : 'rgba(120,120,128,0.14)' }]}>
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
                  <Text style={[styles.fmtText, { color: ink, fontStyle: 'italic', fontFamily: 'Georgia' }]}>I</Text>
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
        <Pressable onPress={talk ? () => onTalk?.(false) : onPlus} accessibilityLabel={talk ? 'Keyboard' : 'More'}>
          <Glass interactive tint={tint} style={styles.circle}>
            {talk ? (
              <SymbolView name="keyboard" size={20} weight="medium" tintColor={ink} />
            ) : (
              <Animated.View style={plusSt}>
                <SymbolView name="plus" size={20} weight="medium" tintColor={ink} />
              </Animated.View>
            )}
          </Glass>
        </Pressable>
        {talk ? (
          <HoldBar onHold={onHold} />
        ) : (
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
                <Text aria-hidden style={[styles.input, styles.measure]} onLayout={(e) => setContentH(e.nativeEvent.layout.height)}>
                  {piecesOf(text, spans).map((pc, i) => (
                    <Text key={i} style={pieceStyle(pc.kinds)}>
                      {pc.text}
                    </Text>
                  ))}
                  {/* keeps a trailing empty line counted */}
                  {'\u200b'}
                </Text>
                <TextInput
                  ref={input}
                  autoFocus={autoFocus}
                  onChangeText={onChange}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  onSelectionChange={(e) => {
                    sel.current = e.nativeEvent.selection;
                    setHasSel(e.nativeEvent.selection.end > e.nativeEvent.selection.start);
                  }}
                  placeholder={placeholder}
                  placeholderTextColor={ink2}
                  multiline
                  // Sized from the hidden copy below: grows with the text, back to one line once sent.
                  style={[styles.input, { color: ink, height: text ? Math.min(MAX_H, Math.max(MIN_H, contentH)) : MIN_H }]}>
                  {piecesOf(text, spans).map((pc, i) => (
                    <Text key={i} style={pieceStyle(pc.kinds)}>
                      {pc.text}
                    </Text>
                  ))}
                </TextInput>
                {moving && (
                  <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
                    <RichText text={serialize(text, spans)} style={[styles.input, { color: ink }]} fxOnly loop />
                  </View>
                )}
                <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.morph, { backgroundColor: sendColor }, morphSt]}>
                  <Text numberOfLines={5} style={[styles.input, { color: sendInk }]}>
                    {text}
                  </Text>
                </Animated.View>
              </View>
              <View style={styles.action}>
                {ready ? (
                  <Animated.View key="send" entering={ZoomIn.springify().damping(16)} exiting={ZoomOut.duration(120)} style={StyleSheet.absoluteFill}>
                    <Pressable onPress={submit} accessibilityLabel="Send" style={[styles.send, { backgroundColor: sendColor }]}>
                      <SymbolView name="arrow.up" size={16} weight="bold" tintColor={sendInk} />
                    </Pressable>
                  </Animated.View>
                ) : uploading ? (
                  <View key="wait" style={[StyleSheet.absoluteFill, styles.center]}>
                    <ActivityIndicator size="small" color={ink2} />
                  </View>
                ) : (
                  <Animated.View key="mic" entering={ZoomIn.duration(140)} exiting={ZoomOut.duration(120)} style={[StyleSheet.absoluteFill, styles.center]}>
                    <Pressable onPress={() => onTalk?.(true)} hitSlop={8} accessibilityLabel="Voice message" style={styles.center}>
                      <SymbolView name="mic" size={19} tintColor={ink2} />
                    </Pressable>
                  </Animated.View>
                )}
              </View>
            </View>
          </Glass>
        )}
      </View>
    </View>
  );
}

// The white Hold to Talk bar. A pan with no minimum distance fires on touch-down, tracks
// the finger in screen coordinates and ends on release, so the screen can pick the zone.
function HoldBar({ onHold }: { onHold?: (e: HoldEvent) => void }) {
  const [down, setDown] = useState(false);
  const gesture = Gesture.Pan()
    .minDistance(0)
    .runOnJS(true)
    .onBegin((e) => {
      setDown(true);
      onHold?.({ phase: 'start', x: e.absoluteX, y: e.absoluteY });
    })
    .onUpdate((e) => onHold?.({ phase: 'move', x: e.absoluteX, y: e.absoluteY }))
    .onFinalize((e) => {
      setDown(false);
      onHold?.({ phase: 'end', x: e.absoluteX, y: e.absoluteY });
    });
  return (
    <GestureDetector gesture={gesture}>
      <View style={[styles.talk, down && styles.talkDown]}>
        <Text style={styles.talkText}>Hold to Talk</Text>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  barRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 12, paddingTop: 6 },
  bar: { height: 38, borderRadius: 19, paddingHorizontal: 6, justifyContent: 'center', maxWidth: '100%' },
  fmtRow: { flexDirection: 'row', alignItems: 'center' },
  fmt: { minWidth: 36, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  fmtText: { fontSize: 17 },
  vline: { width: StyleSheet.hairlineWidth, height: 18, marginHorizontal: 4, opacity: 0.6 },
  fxLabel: { fontSize: 14, fontWeight: '600' },
  fxRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 4 },
  fxChip: { height: 28, paddingHorizontal: 11, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  fxText: { fontSize: 13.5, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingTop: 8 },
  circle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  pill: { flex: 1, minHeight: 44, borderRadius: 22, paddingLeft: 14, paddingRight: 5, paddingVertical: 5 },
  talk: { flex: 1, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.94)', alignItems: 'center', justifyContent: 'center' },
  talkDown: { backgroundColor: 'rgba(205,205,208,0.96)' },
  talkText: { fontSize: 16, fontWeight: '600', color: '#111' },
  chips: { gap: 6, paddingTop: 4, paddingBottom: 8, paddingRight: 6 },
  chip: { height: 72, borderRadius: 14, overflow: 'hidden' },
  chipImg: { height: 72, width: 72 },
  chipDoc: { height: 72, width: 150, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  chipName: { flex: 1, fontSize: 12.5, fontWeight: '600' },
  chipX: { position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  inrow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  input: { fontSize: 17, lineHeight: 22, paddingTop: 6, paddingBottom: 6 },
  measure: { position: 'absolute', left: 0, right: 0, top: 0, opacity: 0 },
  morph: { borderRadius: 17, paddingHorizontal: 12, marginLeft: -12, marginRight: -4, justifyContent: 'flex-end' },
  action: { width: 34, height: 34, marginLeft: 2 },
  center: { alignItems: 'center', justifyContent: 'center' },
  send: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
