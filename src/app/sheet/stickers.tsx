import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Footnote } from '@/components/Group';
import { SheetHeader } from '@/components/SheetHeader';
import * as api from '@/lib/api';
import { usePalette } from '@/lib/colors';
import { API_BASE } from '@/lib/config';
import { stickMarker } from '@/lib/markers';
import { useStickers } from '@/lib/stickers';
import { useChat } from '@/state/chat';

const EMOJI = [
  ...'😂 🤣 😭 🥺 🥹 😍 🥰 😘 😚 😋 😜 🤪 😝 🤭 🫢 🫣 🤫 🤔 🤨 🧐 😏 🙄 😬 😳 😱 😤 😡 🤬 😈 😇 🥳 😎 🤓 😴 🤤 😪 🥱 😵‍💫 🤯 🫠 😶‍🌫️ 🙃 😌 😔 😢 😞 😩 😫 🫡 🤗 💀 👻 🙈 🙉 🙊 💩'.split(
    ' ',
  ),
  ...'❤️ 🩷 🧡 💛 💚 🩵 💙 💜 🖤 🩶 🤍 💔 ❤️‍🔥 💕 💞 💗 💖 💘 💝 💋 💌'.split(' '),
  ...'👍 👎 👏 🙌 🫶 🤝 🙏 ✌️ 🤞 🫰 🤌 👌 👉 👈 ☝️ 👋 🤙 💪 🫵 🫳 🫴'.split(' '),
  ...'🔥 ✨ ⭐ 🌟 💫 💥 💯 💢 💤 💦 🫧 🎉 🎊 🎈 🎁 🎀 👑 💎 🌸 🌹 🌷 🌻 🍀 🍓 🍑 🍒 🧁 🍰 🍫 ☕ 🧋 🐱 🐰 🐶 🐻 🐼 🐥 🦋 🌙 ☀️ 🌈 ❄️ ⚡'.split(' '),
];
const EMOJI_RE =
  /(?:\p{Extended_Pictographic}|\p{Emoji_Presentation}|[\u{1F1E6}-\u{1F1FF}])(?:️|[\u{1F3FB}-\u{1F3FF}]|[\u{1F1E6}-\u{1F1FF}]|‍(?:\p{Extended_Pictographic}|\p{Emoji_Presentation})️?)*/u;

// Stickers and emoji. From the + menu a tap sends one; from a bubble's long-press
// (stick=1) it gets stuck onto that bubble, bare and tilted.
export default function StickersSheet() {
  const pal = usePalette();
  const { send } = useChat();
  const { stick, id, quote } = useLocalSearchParams<{ stick?: string; id?: string; quote?: string }>();
  const sticking = stick === '1';
  const target = id ? Number(id) : undefined;
  const list = useStickers(api.stickersList);
  const mine = (list ?? []).filter((s) => s.owner === 'user');
  const his = (list ?? []).filter((s) => s.owner !== 'user');
  const [typed, setTyped] = useState('');

  const done = (text: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
    setTimeout(() => send(text), 150);
  };
  const pickSticker = (sid: string) => done(sticking ? stickMarker(target, quote ?? '', `sticker:${sid}`) : `[sticker:${sid}]`);
  const pickEmoji = (e: string) => done(stickMarker(target, quote ?? '', e));

  const grid = (items: typeof mine) => (
    <View style={styles.grid}>
      {items.map((s) => (
        <Pressable key={s.id} onPress={() => pickSticker(s.id)} style={({ pressed }) => [styles.cell, { backgroundColor: pal.fill }, pressed && { transform: [{ scale: 0.94 }] }]}>
          <Image source={API_BASE + (s.thumbnail || s.url)} style={styles.img} contentFit="contain" transition={120} />
        </Pressable>
      ))}
    </View>
  );
  const emojiPart = (
    <>
      <TextInput
        value={typed}
        onChangeText={(t) => {
          const m = EMOJI_RE.exec(t);
          if (m) {
            setTyped('');
            pickEmoji(m[0]);
          } else setTyped(t);
        }}
        placeholder="Any emoji from the keyboard…"
        placeholderTextColor={pal.ink2}
        style={[styles.field, { backgroundColor: pal.fill, color: pal.ink }]}
      />
      <View style={styles.emojiGrid}>
        {EMOJI.map((e) => (
          <Pressable key={e} onPress={() => pickEmoji(e)} style={({ pressed }) => [styles.emojiCell, pressed && { transform: [{ scale: 1.25 }] }]}>
            <Text style={styles.emoji}>{e}</Text>
          </Pressable>
        ))}
      </View>
    </>
  );

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
      <SheetHeader title={sticking ? 'Attach Sticker' : 'Stickers'} />
      {sticking && (
        <>
          <Text style={[styles.sec, { color: pal.ink2 }]}>EMOJI</Text>
          {emojiPart}
          <Text style={[styles.sec, { color: pal.ink2 }]}>STICKERS</Text>
        </>
      )}
      {list === null ? (
        <ActivityIndicator style={{ marginTop: 30 }} />
      ) : (
        <>
          {mine.length > 0 && grid(mine)}
          {his.length > 0 && (
            <>
              <Text style={[styles.sec, { color: pal.ink2 }]}>HIS</Text>
              {grid(his)}
            </>
          )}
          {list.length === 0 && <Text style={[styles.empty, { color: pal.ink2 }]}>No stickers yet. Add some from the web app.</Text>}
        </>
      )}
      {!sticking && <Footnote>Emoji come from the keyboard as usual; one to three of them on their own show up big.</Footnote>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16, paddingBottom: 12 },
  cell: { width: '30.5%', aspectRatio: 1, borderRadius: 18, padding: 8 },
  img: { flex: 1 },
  sec: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, marginHorizontal: 20, marginTop: 8, marginBottom: 8 },
  empty: { textAlign: 'center', marginTop: 30, fontSize: 14 },
  field: { marginHorizontal: 16, marginBottom: 10, height: 40, borderRadius: 12, paddingHorizontal: 14, fontSize: 16 },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 10, paddingBottom: 8 },
  emojiCell: { width: '12.5%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 30 },
});
