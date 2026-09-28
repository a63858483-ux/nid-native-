import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView } from 'react-native';
import Animated, { SlideInLeft, SlideInRight } from 'react-native-reanimated';

import { Footnote, Group, Row } from '@/components/Group';
import { SheetHeader } from '@/components/SheetHeader';
import { useApp } from '@/state/app';
import type { Prefs } from '@/lib/storage';

// Mirrors the server's models.json (primary = shown on the first page).
const MODELS = [
  { id: 'claude-opus-5-5', label: 'Opus 5.5', desc: 'Most capable for ambitious work', primary: true },
  { id: 'claude-fable-5-1', label: 'Fable 5.1', desc: 'For your toughest challenges', primary: true },
  { id: 'claude-haiku-4-5', label: 'Haiku 4.5', desc: 'Fastest for quick answers', primary: true },
  { id: 'claude-opus-5', label: 'Opus 5' },
  { id: 'claude-fable-5', label: 'Fable 5' },
  { id: 'claude-opus-4-8', label: 'Opus 4.8' },
  { id: 'claude-opus-4-7', label: 'Opus 4.7' },
  { id: 'claude-opus-4-6', label: 'Opus 4.6' },
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6' },
];
const EFFORTS: { key: Prefs['effort']; desc: string }[] = [
  { key: 'Low', desc: 'Quick replies, lighter thinking' },
  { key: 'Medium', desc: 'Balanced' },
  { key: 'High', desc: 'Thinks longer before answering' },
  { key: 'Max', desc: 'Deepest thinking, slowest' },
];

export default function ModelSheet() {
  const { prefs, setPrefs } = useApp();
  const [page, setPage] = useState<'main' | 'effort' | 'more'>('main');
  const [dir, setDir] = useState<'in' | 'out'>('in');
  const go = (p: typeof page) => {
    setDir(p === 'main' ? 'out' : 'in');
    setPage(p);
  };
  const choose = (patch: Partial<Prefs>, close: boolean) => {
    Haptics.selectionAsync();
    setPrefs(patch);
    if (close) setTimeout(() => router.back(), 180);
    else go('main');
  };
  const current = MODELS.find((m) => m.id === prefs.model);
  const enter = (dir === 'in' ? SlideInRight : SlideInLeft).springify().damping(20);

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
      {page === 'main' && (
        <Animated.View key="main" entering={enter}>
          <SheetHeader title="Select model" />
          <Group>
            {MODELS.filter((m) => m.primary).map((m, i) => (
              <Row key={m.id} first={i === 0} title={m.label} subtitle={m.desc} checked={m.id === prefs.model} onPress={() => choose({ model: m.id }, true)} />
            ))}
          </Group>
          <Group>
            <Row first title="Effort" value={prefs.effort} chevron onPress={() => go('effort')} />
          </Group>
          <Group>
            <Row first title="More models" value={current && !current.primary ? current.label : undefined} chevron onPress={() => go('more')} />
          </Group>
        </Animated.View>
      )}
      {page === 'effort' && (
        <Animated.View key="effort" entering={enter}>
          <SheetHeader title="Effort" onBack={() => go('main')} />
          <Group>
            {EFFORTS.map((e, i) => (
              <Row key={e.key} first={i === 0} title={e.key} subtitle={e.desc} checked={e.key === prefs.effort} onPress={() => choose({ effort: e.key }, false)} />
            ))}
          </Group>
          <Footnote>Applies from your next message. This conversation stays open.</Footnote>
        </Animated.View>
      )}
      {page === 'more' && (
        <Animated.View key="more" entering={enter}>
          <SheetHeader title="More models" onBack={() => go('main')} />
          <Group>
            {MODELS.filter((m) => !m.primary).map((m, i) => (
              <Row key={m.id} first={i === 0} title={m.label} checked={m.id === prefs.model} onPress={() => choose({ model: m.id }, true)} />
            ))}
          </Group>
        </Animated.View>
      )}
    </ScrollView>
  );
}
