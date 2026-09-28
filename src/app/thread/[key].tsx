import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  KeyboardAvoidingView,
  KeyboardStickyView,
} from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Bubble } from "@/components/Bubble";
import { Composer, type Pending } from "@/components/Composer";
import { Glass } from "@/components/Glass";
import { usePalette, WallpaperContext } from "@/lib/colors";
import { AVATAR_HIM } from "@/lib/config";
import { parseReply, replyMarker } from "@/lib/markers";
import { dayLabel, segmentsOf, threadOf } from "@/lib/rows";
import { wallpaperUri } from "@/lib/storage";
import { useApp } from "@/state/app";
import { useChat } from "@/state/chat";

// Messages' reply view: the original alone on a dimmed sheet, its replies under it,
// and a composer that says Reply. ✕ takes you back.
export default function ThreadScreen() {
  const { key, seg } = useLocalSearchParams<{ key: string; seg?: string }>();
  const { prefs } = useApp();
  return (
    <WallpaperContext value={!!wallpaperUri(prefs.wallpaper)}>
      <ThreadInner targetKey={key} seg={seg ? Number(seg) : undefined} />
    </WallpaperContext>
  );
}

function ThreadInner({ targetKey, seg }: { targetKey: string; seg?: number }) {
  const insets = useSafeAreaInsets();
  const pal = usePalette();
  const { prefs } = useApp();
  const { items, send } = useChat();
  const [pending, setPending] = useState<Pending[]>([]);
  const thread = useMemo(
    () => threadOf(items, targetKey, seg),
    [items, targetKey, seg],
  );
  const root = thread[0];
  const ink = pal.wall || pal.dark ? "#fff" : pal.ink;

  const onSend = (text: string) => {
    if (!root) return;
    const segs = segmentsOf(root);
    const s =
      seg !== undefined && segs[seg]?.kind === "text" ? segs[seg] : null;
    const body =
      s && s.kind === "text"
        ? s.text
        : (parseReply(root.text)?.rest ?? root.text);
    send(`${replyMarker(root.id, body)} ${text}`);
    setPending([]);
  };

  return (
    <View style={styles.wrap}>
      <BlurView
        tint={
          pal.chrome ? "systemThickMaterialDark" : "systemThickMaterialLight"
        }
        intensity={70}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: "rgba(0,0,0,0.35)" },
        ]}
      />

      <View style={[styles.head, { paddingTop: insets.top + 6 }]}>
        <View style={{ width: 44 }} />
        <View style={styles.who}>
          <Image source={AVATAR_HIM} style={styles.avatar} contentFit="cover" />
          <Glass
            style={styles.name}
            tint={pal.wall ? "rgba(30,30,32,0.5)" : undefined}
          >
            <Text style={[styles.nameText, { color: ink }]}>{prefs.name}</Text>
            <SymbolView
              name="chevron.right"
              size={9}
              weight="bold"
              tintColor={ink}
            />
          </Glass>
        </View>
        <Pressable onPress={() => router.back()} accessibilityLabel="Close">
          <Glass
            interactive
            style={styles.circle}
            tint={pal.wall ? "rgba(30,30,32,0.5)" : undefined}
          >
            <SymbolView
              name="xmark"
              size={17}
              weight="medium"
              tintColor={ink}
            />
          </Glass>
        </Pressable>
      </View>

      {/* Messages opens the reply view with the keyboard up; the bubbles ride above it. */}
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + 72 },
          ]}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
        >
          {thread.map((it, i) => {
            // the original shows only the bubble being replied to
            const all = segmentsOf(it);
            const picked =
              i === 0 && seg !== undefined && all[seg] ? [all[seg]] : all;
            const segs = picked.filter((s) => s.kind === "text") as {
              kind: "text";
              text: string;
            }[];
            const showTime =
              i === 0 ||
              new Date(it.ts).getTime() - new Date(thread[i - 1].ts).getTime() >
                3600_000;
            return (
              <View
                key={it.key}
                style={i === 1 ? { marginTop: 18 } : undefined}
              >
                {showTime && (
                  <Text style={[styles.divider, { color: pal.meta }]}>
                    <Text style={{ fontWeight: "700" }}>
                      {dayLabel(it.ts).split(" ")[0]}
                    </Text>{" "}
                    {dayLabel(it.ts).split(" ").slice(1).join(" ")}
                  </Text>
                )}
                {segs.map((s, j) => (
                  <View key={j} style={{ marginTop: j ? 3 : 8 }}>
                    <Bubble
                      role={it.role}
                      text={s.text}
                      tail={j === segs.length - 1}
                      myColor={prefs.bubble}
                    />
                  </View>
                ))}
              </View>
            );
          })}
        </ScrollView>
      </KeyboardAvoidingView>

      <KeyboardStickyView
        offset={{ closed: 0, opened: insets.bottom - 6 }}
        style={styles.dock}
      >
        <View style={{ paddingBottom: insets.bottom + 6 }}>
          <Composer
            myColor={prefs.bubble}
            plusOpen={false}
            pending={pending}
            onRemovePending={(l) =>
              setPending((c) => c.filter((p) => p.local !== l))
            }
            onPlus={() => {}}
            onSend={onSend}
            placeholder="Reply"
            autoFocus
          />
        </View>
      </KeyboardStickyView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  head: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 12,
  },
  who: { alignItems: "center", marginTop: -2 },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: "#ddd" },
  name: {
    height: 24,
    borderRadius: 12,
    paddingLeft: 11,
    paddingRight: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: -3,
  },
  nameText: { fontSize: 12.5, fontWeight: "500" },
  circle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    paddingHorizontal: 12,
    paddingTop: 40,
    flexGrow: 1,
    justifyContent: "flex-end",
  },
  divider: {
    alignSelf: "center",
    fontSize: 11.5,
    fontWeight: "500",
    paddingTop: 16,
    paddingBottom: 6,
    color: "#fff",
  },
  dock: { position: "absolute", left: 0, right: 0, bottom: 0 },
});
