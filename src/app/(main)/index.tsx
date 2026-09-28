import { Image } from 'expo-image';
import { router, useNavigation } from 'expo-router';
import { useDrawerProgress } from 'expo-router/drawer';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DeviceEventEmitter, FlatList, Settings, StyleSheet, Text, View, type ScrollViewProps } from 'react-native';
import { KeyboardChatScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import Animated, { interpolate, useAnimatedStyle, type EntryAnimationsValues, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Bubble } from '@/components/Bubble';
import { ChatHeader, EdgeBlur, HEADER_H } from '@/components/ChatHeader';
import { Composer } from '@/components/Composer';
import { PlusMenu, type PlusAction } from '@/components/PlusMenu';
import { FOCUS_EVENT } from '@/components/Sidebar';
import { ThoughtLine } from '@/components/ThoughtLine';
import { Typing } from '@/components/Typing';
import { usePalette } from '@/lib/colors';
import { DEMO } from '@/lib/config';
import { buildRows, type Row } from '@/lib/rows';
import { wallpaperUri } from '@/lib/storage';
import { useApp } from '@/state/app';
import { useChat } from '@/state/chat';

const MODEL_LABEL: Record<string, string> = {
  'claude-opus-5-5': 'Opus 5.5',
  'claude-fable-5-1': 'Fable 5.1',
  'claude-haiku-4-5': 'Haiku 4.5',
};

// A sent bubble rises from the composer with a little overshoot.
const sendEnter = (v: EntryAnimationsValues) => {
  'worklet';
  return {
    initialValues: { opacity: 0.6, transform: [{ translateY: 46 }, { scale: 0.9 }] },
    animations: {
      opacity: withTiming(1, { duration: 140 }),
      transform: [
        { translateY: withSpring(0, { damping: 15, stiffness: 190, mass: 0.8 }) },
        { scale: withSpring(1, { damping: 13, stiffness: 220 }) },
      ],
    },
  };
};
const replyEnter = () => {
  'worklet';
  return {
    initialValues: { opacity: 0, transform: [{ scale: 0.92 }] },
    animations: { opacity: withTiming(1, { duration: 180 }), transform: [{ scale: withSpring(1, { damping: 14, stiffness: 220 }) }] },
  };
};

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const pal = usePalette();
  const nav = useNavigation<{ openDrawer: () => void }>();
  const { prefs, showToast } = useApp();
  const { items, send, loadOlder, loading } = useChat();
  const [plusOpen, setPlusOpen] = useState(false);
  const [composerH, setComposerH] = useState(60);
  const [flash, setFlash] = useState<string | null>(null);
  const list = useRef<FlatList<Row>>(null);

  const rows = useMemo(() => buildRows(items).reverse(), [items]);
  const wall = wallpaperUri(prefs.wallpaper);

  // Rounded corners + shadow as the drawer pushes the page aside.
  const progress = useDrawerProgress();
  const pageSt = useAnimatedStyle(() => ({
    borderRadius: interpolate(progress.value, [0, 1], [0, 32]),
    shadowOpacity: interpolate(progress.value, [0, 1], [0, 0.18]),
  }));

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(FOCUS_EVENT, (id: number) => {
      const index = rows.findIndex((r) => r.type === 'bubble' && r.itemKey === `m${id}`);
      if (index < 0) return showToast('That one is further back. Scroll up to load older messages.');
      list.current?.scrollToIndex({ index, viewPosition: 0.5, animated: true });
      const row = rows[index];
      setFlash(row.key);
      setTimeout(() => setFlash(null), 1400);
    });
    return () => sub.remove();
  }, [rows, showToast]);

  // CI screenshots: `simctl launch <app> -demoScene sidebar|model|plus` lands in NSUserDefaults.
  useEffect(() => {
    if (!DEMO) return;
    const scene = Settings.get('demoScene');
    const t = setTimeout(() => {
      if (scene === 'sidebar') nav.openDrawer();
      if (scene === 'model') router.push('/sheet/model');
      if (scene === 'plus') setPlusOpen(true);
    }, 1500);
    return () => clearTimeout(t);
  }, [nav]);

  const pick = (a: PlusAction) => {
    setPlusOpen(false);
    if (a === 'model') router.push('/sheet/model');
    else if (a === 'bubble') router.push('/sheet/bubble');
    else if (a === 'wallpaper') router.push('/sheet/wallpaper');
    else showToast({ photos: 'Photos & files', checklist: 'Checklist', toy: 'Toy' }[a] + ' comes in a later step');
  };

  const renderScroll = useCallback(
    (props: ScrollViewProps) => <KeyboardChatScrollView {...props} inverted keyboardLiftBehavior="always" offset={insets.bottom} />,
    [insets.bottom],
  );

  const renderItem = useCallback(
    ({ item }: { item: Row }) => {
      if (item.type === 'divider') {
        return <Text style={[styles.divider, { color: pal.meta }]}>{item.label}</Text>;
      }
      if (item.type === 'typing') {
        return (
          <View style={styles.gap}>
            {item.thought && <ThoughtLine label={item.thought.label} live={item.thought.live} onPress={() => {}} />}
            <Typing />
          </View>
        );
      }
      const mine = item.role === 'user';
      return (
        <Animated.View
          entering={item.fresh ? (mine ? sendEnter : replyEnter) : undefined}
          style={[item.gapAbove ? styles.gap : styles.tight, flash === item.key && styles.flash]}>
          {item.thought && (
            <ThoughtLine
              label={item.thought.label}
              live={item.thought.live}
              onPress={() => router.push({ pathname: '/sheet/thought', params: { key: item.itemKey } })}
            />
          )}
          <Bubble role={item.role} text={item.text} tail={item.tail} myColor={prefs.bubble} />
          {item.receipt ? <Text style={[styles.receipt, { color: pal.meta }]}>{item.receipt}</Text> : null}
          {item.failed ? <Text style={styles.failed}>Not delivered: {item.failed}</Text> : null}
        </Animated.View>
      );
    },
    [pal.meta, prefs.bubble, flash],
  );

  return (
    <Animated.View style={[styles.page, { backgroundColor: pal.bg, shadowColor: '#000', shadowRadius: 30 }, pageSt]}>
      {wall ? <Image source={wall} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}

      <FlatList
        ref={list}
        data={rows}
        inverted
        keyExtractor={(r) => r.key}
        renderItem={renderItem}
        renderScrollComponent={renderScroll}
        onEndReached={loadOlder}
        onEndReachedThreshold={0.4}
        keyboardDismissMode="interactive"
        onScrollToIndexFailed={() => {}}
        contentContainerStyle={{
          paddingHorizontal: 12,
          paddingTop: composerH + insets.bottom + 8,
          paddingBottom: insets.top + HEADER_H + 8,
        }}
        ListEmptyComponent={
          loading ? null : <Text style={[styles.empty, { color: pal.meta }]}>No messages yet. Say hi.</Text>
        }
      />

      <EdgeBlur from="top" height={insets.top + HEADER_H} />
      <EdgeBlur from="bottom" height={insets.bottom + composerH + 10} />

      <ChatHeader
        name={prefs.name}
        onMenu={() => nav.openDrawer()}
        onName={() => router.push('/sheet/name')}
        onCall={() => showToast('Calls come in a later step')}
      />

      <PlusMenu
        open={plusOpen}
        bottom={insets.bottom + composerH + 6}
        note={`${MODEL_LABEL[prefs.model] ?? 'More'} · ${prefs.effort}`}
        onClose={() => setPlusOpen(false)}
        onPick={pick}
      />

      <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom - 6 }} style={styles.dock}>
        <View onLayout={(e) => setComposerH(e.nativeEvent.layout.height)} style={{ paddingBottom: insets.bottom + 6 }}>
          <Composer myColor={prefs.bubble} plusOpen={plusOpen} onPlus={() => setPlusOpen((o) => !o)} onSend={send} />
        </View>
      </KeyboardStickyView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, overflow: 'hidden', borderCurve: 'continuous' },
  divider: { alignSelf: 'center', fontSize: 11.5, fontWeight: '600', paddingTop: 16, paddingBottom: 8 },
  gap: { marginTop: 10 },
  tight: { marginTop: 2 },
  flash: { opacity: 0.55 },
  receipt: { alignSelf: 'flex-end', fontSize: 11.5, fontWeight: '600', marginTop: 4, marginRight: 10 },
  failed: { alignSelf: 'flex-end', fontSize: 11.5, color: '#FF3B30', marginTop: 4, marginRight: 10 },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 14, transform: [{ scaleY: -1 }] },
  dock: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
