import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { DeviceEventEmitter, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Footnote, Group } from '@/components/Group';
import { SheetHeader } from '@/components/SheetHeader';
import { usePalette } from '@/lib/colors';
import * as S from '@/lib/study';
import { useApp } from '@/state/app';

export const STUDY_CHANGED = 'nid.studyChanged';

const KINDS = [
  { ext: 'EPUB', title: 'EPUB', sub: "Keeps the book's own colours, notes and pictures", types: ['application/epub+zip'] },
  { ext: 'PDF', title: 'PDF', sub: 'Opens in the system PDF reader', types: ['application/pdf'] },
  { ext: 'TXT', title: 'Plain Text', sub: 'Split into chapters by headings', types: ['text/plain'] },
];

function FileIcon({ label }: { label: string }) {
  return (
    <View style={{ width: 26, height: 32 }}>
      <Svg width={26} height={32} viewBox="0 0 26 32">
        <Path d="M3 1.5h13l7.5 7.5v20a1.5 1.5 0 0 1-1.5 1.5H3A1.5 1.5 0 0 1 1.5 29V3A1.5 1.5 0 0 1 3 1.5z" fill="#fff" stroke="#c7c7cc" />
        <Path d="M16 1.5V8a1 1 0 0 0 1 1h6.5" stroke="#c7c7cc" fill="none" />
      </Svg>
      <Text style={styles.ficon}>{label}</Text>
    </View>
  );
}

// "+" in the study room: add a book from Files, or write a piece for Paper.
export default function AddSheet() {
  const pal = usePalette();
  const { showToast } = useApp();
  const pick = async (types: string[]) => {
    let res: import('expo-document-picker').DocumentPickerResult;
    try {
      const DocumentPicker = await import('expo-document-picker');
      res = await DocumentPicker.getDocumentAsync({ type: types, copyToCacheDirectory: true });
    } catch {
      return showToast('Files need the newer app build');
    }
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    router.back();
    showToast(`Adding ${a.name}…`);
    try {
      const b = await S.uploadBook({ uri: a.uri, name: a.name, mime: a.mimeType || 'application/octet-stream' });
      showToast(`《${b.title}》 is on the shelf`);
      DeviceEventEmitter.emit(STUDY_CHANGED);
    } catch (e) {
      showToast(e instanceof Error && e.message && !e.message.startsWith('upload') ? e.message : "Couldn't add that file");
    }
  };
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
      <SheetHeader title="Add" />
      <Group>
        {KINDS.map((k, i) => (
          <Pressable key={k.ext} onPress={() => pick(k.types)} style={({ pressed }) => [styles.opt, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: pal.line }, pressed && { backgroundColor: pal.fill }]}>
            <FileIcon label={k.ext} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.ot, { color: pal.ink }]}>{k.title}</Text>
              <Text style={[styles.os, { color: pal.ink2 }]}>{k.sub}</Text>
            </View>
            <SymbolView name="chevron.right" size={13} weight="semibold" tintColor={pal.meta} />
          </Pressable>
        ))}
      </Group>
      <Group>
        <Pressable
          onPress={() => {
            router.back();
            setTimeout(() => router.push('/study/compose'), 250);
          }}
          style={({ pressed }) => [styles.opt, pressed && { backgroundColor: pal.fill }]}>
          <View style={[styles.pen, { backgroundColor: pal.fill }]}>
            <SymbolView name="square.and.pencil" size={16} tintColor={pal.ink} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.ot, { color: pal.ink }]}>Write</Text>
            <Text style={[styles.os, { color: pal.ink2 }]}>A piece for Paper. He sees it and can reply.</Text>
          </View>
          <SymbolView name="chevron.right" size={13} weight="semibold" tintColor={pal.meta} />
        </Pressable>
      </Group>
      <Footnote>Choose a file from Files, iCloud Drive or any app that shares documents.</Footnote>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  opt: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 14, paddingVertical: 11 },
  ficon: { position: 'absolute', left: 0, right: 0, bottom: 5, textAlign: 'center', fontSize: 6.5, fontWeight: '800', color: '#8e8e93' },
  ot: { fontSize: 16, fontWeight: '600' },
  os: { fontSize: 12.5, marginTop: 1 },
  pen: { width: 26, height: 32, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
});
