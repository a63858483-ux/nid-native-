import { BlurView } from 'expo-blur';
import { File, Paths } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { WebView as WebViewType, WebViewMessageEvent } from 'react-native-webview';

import { NidPdfView, type PdfMark, type PdfRef } from '../../../../modules/nid-pdf';
import { HER_MARK, HIS_MARK, NoteEditor, NoteThread, threadOf } from '@/components/study/NoteThread';
import { readerHtml } from '@/components/study/readerHtml';
import { authHeaders } from '@/lib/api';
import { API_BASE } from '@/lib/config';
import { download } from '@/lib/open';
import * as S from '@/lib/study';
import { useApp } from '@/state/app';

// Apple Books' six looks: page colour, ink ('' keeps the book's own), weight.
const THEMES = [
  { name: 'Original', paper: '#ffffff', ink: '', weight: 400, meta: '#8a8a8e' },
  { name: 'Quiet', paper: '#4a4a4f', ink: '#d8d8dc', weight: 400, meta: '#aaaaaf' },
  { name: 'Paper', paper: '#eeeeee', ink: '#1a1a1a', weight: 400, meta: '#8a8a8e' },
  { name: 'Bold', paper: '#ffffff', ink: '#000000', weight: 600, meta: '#8a8a8e' },
  { name: 'Calm', paper: '#f0e0c6', ink: '#2b2418', weight: 400, meta: '#8f806a' },
  { name: 'Focus', paper: '#fffbf0', ink: '#1f1d17', weight: 400, meta: '#8f8a7a' },
];

// Loaded on demand: builds made before the WebView was added would throw at import.
let WebView: typeof WebViewType | null = null;
try {
  WebView = require('react-native-webview').WebView;
} catch {
  WebView = null;
}

type Reading = { theme: number; size: number; pos: Record<string, string | number> };
const readingFile = () => new File(Paths.document, 'reading.json');
function loadReading(): Reading {
  try {
    const f = readingFile();
    if (f.exists) return { theme: 0, size: 100, pos: {}, ...JSON.parse(f.textSync()) };
  } catch {}
  return { theme: 0, size: 100, pos: {} };
}
function saveReading(r: Reading) {
  try {
    readingFile().write(JSON.stringify(r));
  } catch {}
}

// Progress goes to the server at most every 8 seconds.
let lastSaved = 0;
function saveProgressSoon(id: number, percent: number, page?: number) {
  if (Date.now() - lastSaved < 8000) return;
  lastSaved = Date.now();
  S.setProgress(id, percent, page).catch(() => {});
}

type Panel = null | 'menu' | 'toc' | 'marks' | 'search' | 'themes';
type TocItem = { label: string; href?: string; page?: number; level: number };
type Hit = { cfi?: string; index?: number; page?: number; excerpt: string };

const MENU = [
  { label: 'Highlight', key: 'highlight' },
  { label: 'Add Note', key: 'note' },
  { label: 'Copy', key: 'copy' },
];

export default function Reader() {
  const insets = useSafeAreaInsets();
  const { showToast } = useApp();
  const p = useLocalSearchParams<{ id: string; title: string; file: string; ext: string }>();
  const bookId = Number(p.id);
  const isPdf = p.ext === 'pdf';
  const [initial] = useState(loadReading);
  const reading = useRef(initial);
  const [themeIdx, setThemeIdx] = useState(initial.theme);
  const [size, setSize] = useState(initial.size);
  const theme = THEMES[themeIdx] ?? THEMES[0];

  const web = useRef<WebViewType>(null);
  // The page is built once; theme changes go in through nidTheme so the book never reloads.
  const [html] = useState(() => readerHtml({ top: insets.top + 44, bottom: insets.bottom + 44, paper: (THEMES[initial.theme] ?? THEMES[0]).paper }));
  const pdf = useRef<PdfRef>(null);
  const [pdfPath, setPdfPath] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState('');
  const [loc, setLoc] = useState({ pct: 0, page: 0, total: 0, cpage: 0, ctotal: 0, chapter: '' });
  const [panel, setPanel] = useState<Panel>(null);
  const [chrome, setChrome] = useState(true);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [notes, setNotes] = useState<S.Note[]>([]);
  const [sel, setSel] = useState<{ text: string; cfi?: string; page?: number } | null>(null);
  const [thread, setThread] = useState<{ quote: string; root: S.Note | null; cfi?: string; page?: number } | null>(null);
  const [editor, setEditor] = useState<{ quote: string; root: S.Note | null; at: number; cfi?: string; page?: number } | null>(null);
  const [markMenu, setMarkMenu] = useState<{ root: S.Note; x: number; y: number; bottom: number } | null>(null);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const { width: screenW } = useWindowDimensions();
  const [footnote, setFootnote] = useState<{ label: string; text: string } | null>(null);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[] | null>(null);

  const js = useCallback((code: string) => web.current?.injectJavaScript(`${code};true;`), []);
  const roots = useMemo(() => notes.filter((n) => n.reply_to_id == null && n.quote), [notes]);
  const marksFor = useCallback(
    (list: S.Note[]) =>
      list
        .filter((n) => n.reply_to_id == null && n.quote)
        .map((n) => ({ id: n.id, cfi: n.cfi, quote: n.quote, page: n.page_no ?? 0, color: n.author === 'ta' ? HER_MARK : HIS_MARK })),
    [],
  );

  useEffect(() => {
    S.notes(bookId)
      .then(setNotes)
      .catch(() => {});
  }, [bookId]);

  // Notes can arrive after the book opened: hand them to the page whenever they change.
  useEffect(() => {
    if (!isPdf && ready) js(`window.nidMarks(${JSON.stringify(marksFor(notes))})`);
  }, [isPdf, ready, notes, js, marksFor]);

  // PDF: fetch the file with the token into the cache, then hand PDFKit the local path.
  useEffect(() => {
    if (!isPdf || !NidPdfView) return;
    download(p.file.replace(API_BASE, ''), `book-${bookId}.pdf`, true)
      .then((f) => setPdfPath(f.uri))
      .catch(() => setFailed("Couldn't download this book."));
  }, [isPdf, p.file, bookId]);

  const themePayload = (t = theme, s = size) => ({ paper: t.paper, ink: t.ink, weight: t.weight, size: s });
  const setTheme = (i: number) => {
    setThemeIdx(i);
    reading.current = { ...reading.current, theme: i };
    saveReading(reading.current);
    js(`window.nidTheme(${JSON.stringify(themePayload(THEMES[i], size))})`);
  };
  const bump = (d: number) => {
    const s = Math.max(70, Math.min(170, size + d));
    setSize(s);
    reading.current = { ...reading.current, size: s };
    saveReading(reading.current);
    js(`window.nidTheme(${JSON.stringify({ size: s })})`);
  };

  const onMessage = (e: WebViewMessageEvent) => {
    let m: Record<string, unknown>;
    try {
      m = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    switch (m.t) {
      case 'boot': {
        const token = (authHeaders().Authorization || '').replace('Bearer ', '');
        const cfi = reading.current.pos[String(bookId)] || '';
        js(`window.nidOpen(${JSON.stringify(p.file)}, ${JSON.stringify(token)}, ${JSON.stringify(cfi)}, ${JSON.stringify(themePayload())}, ${JSON.stringify(marksFor(notes))})`);
        break;
      }
      case 'ready':
        setReady(true);
        break;
      case 'error':
        setFailed(String(m.m || 'Something went wrong opening this book.'));
        break;
      case 'toc':
        setToc(m.items as TocItem[]);
        break;
      case 'loc': {
        const l = m as unknown as typeof loc & { cfi: string };
        setLoc({ pct: l.pct, page: l.page, total: l.total, cpage: l.cpage, ctotal: l.ctotal, chapter: l.chapter });
        reading.current = { ...reading.current, pos: { ...reading.current.pos, [String(bookId)]: l.cfi } };
        saveReading(reading.current);
        if (l.pct > 0) saveProgressSoon(bookId, l.pct * 100);
        break;
      }
      case 'select':
        setSel(m.text ? { text: String(m.text), cfi: m.cfi as string } : null);
        break;
      case 'mark': {
        // A tap on a highlight also reaches the page as a plain tap; that one is dropped.
        clearTimeout(tapTimer.current);
        const root = notes.find((n) => n.id === m.id);
        if (!root) break;
        if (typeof m.y === 'number') setMarkMenu({ root, x: Number(m.x), y: Number(m.y), bottom: Number(m.bottom) });
        else openThread(root);
        break;
      }
      case 'note':
        setFootnote({ label: String(m.label || ''), text: String(m.text) });
        break;
      case 'link':
        WebBrowser.openBrowserAsync(String(m.url));
        break;
      case 'tap':
        clearTimeout(tapTimer.current);
        tapTimer.current = setTimeout(() => {
          if (markMenu) return setMarkMenu(null);
          setPanel(null);
          setFootnote(null);
          setChrome((c) => !c);
        }, 220);
        break;
      case 'results':
        setHits((m.items as { cfi: string; excerpt: string }[]).map((h) => ({ cfi: h.cfi, excerpt: h.excerpt })));
        break;
    }
  };

  const onMenu = async (key: string) => {
    if (key === 'highlight') return highlight(false);
    if (key === 'note') return highlight(true);
    if (key === 'copy' && sel) {
      try {
        const Clipboard = await import('expo-clipboard');
        await Clipboard.setStringAsync(sel.text);
      } catch {}
      js('window.nidClear()');
      setSel(null);
    }
  };

  const saveEditor = async (text: string) => {
    if (!editor) return;
    try {
      if (editor.root) {
        const n = await S.editNote(bookId, editor.root.id, text);
        setNotes((x) => x.map((y) => (y.id === n.id ? n : y)));
      } else {
        const n = await S.addNote(bookId, { quote: editor.quote, text: text || null, cfi: editor.cfi, page_no: editor.page, color: HER_MARK });
        setNotes((x) => [...x, n]);
        if (!isPdf) js(`window.nidMarks(${JSON.stringify(marksFor([n]))})`);
      }
      setEditor(null);
    } catch {
      showToast("Couldn't save the note");
    }
  };
  const removeMark = (root: S.Note) =>
    Alert.alert('Remove this highlight?', root.text ? 'Its note goes with it.' : undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await S.deleteNote(bookId, root.id);
            const gone = new Set([root.id, ...threadOf(root, notes).map((n) => n.id)]);
            setNotes((x) => x.filter((n) => !gone.has(n.id)));
            if (!isPdf) js(`window.nidUnmark(${root.id})`);
          } catch {
            showToast("Couldn't remove it");
          }
        },
      },
    ]);

  const openThread = (root: S.Note) => {
    setPanel(null);
    setThread({ quote: root.quote, root, cfi: root.cfi ?? undefined, page: root.page_no ?? undefined });
  };

  const highlight = async (withNote: boolean) => {
    if (!sel) return;
    Haptics.selectionAsync();
    let quote = sel.text;
    let page = sel.page;
    if (isPdf) {
      const r = await pdf.current?.highlightSelection();
      if (!r) return;
      quote = r.quote;
      page = r.page;
    } else js('window.nidClear()');
    const cfi = sel.cfi;
    setSel(null);
    if (withNote) {
      setEditor({ quote, root: null, at: Date.now(), cfi, page });
      return;
    }
    try {
      const n = await S.addNote(bookId, { quote, cfi, page_no: page, color: HER_MARK });
      setNotes((x) => [...x, n]);
      if (!isPdf) js(`window.nidMarks(${JSON.stringify(marksFor([n]))})`);
    } catch {
      showToast("Couldn't save the highlight");
    }
  };

  const sendNote = async (text: string) => {
    if (!thread) return;
    try {
      if (!thread.root) {
        const n = await S.addNote(bookId, { quote: thread.quote, text, cfi: thread.cfi, page_no: thread.page, color: HER_MARK });
        setNotes((x) => [...x, n]);
        setThread({ ...thread, root: n });
        if (!isPdf) js(`window.nidMarks(${JSON.stringify(marksFor([n]))})`);
      } else {
        const n = await S.addNote(bookId, { quote: thread.root.quote, text, reply_to_id: thread.root.id });
        setNotes((x) => [...x, n]);
      }
    } catch {
      showToast("Couldn't send it");
    }
  };

  const openPanel = async (x: Panel) => {
    Haptics.selectionAsync();
    setPanel(x);
    if (x === 'toc' && isPdf && toc.length === 0) {
      const o = (await pdf.current?.outline()) ?? [];
      setToc(o.map((i) => ({ label: i.title, page: i.page, level: i.level })));
    }
    if (x === 'search') setHits(null);
  };
  const runSearch = async () => {
    const s = q.trim();
    if (!s) return;
    setHits([]);
    if (isPdf) {
      const r = (await pdf.current?.search(s)) ?? [];
      setHits(r.map((h) => ({ index: h.index, page: h.page, excerpt: h.text })));
    } else js(`window.nidSearch(${JSON.stringify(s)})`);
  };
  const goTo = (t: { href?: string; cfi?: string | null; page?: number; index?: number }) => {
    setPanel(null);
    if (isPdf) {
      if (t.index != null) pdf.current?.goToResult(t.index);
      else if (t.page) pdf.current?.goToPage(t.page);
    } else if (t.cfi || t.href) js(`window.nidGo(${JSON.stringify(t.cfi || t.href)})`);
  };

  const pageLabel = isPdf ? (loc.page ? String(loc.page) : '') : loc.total ? String(loc.page) : loc.ctotal ? `${loc.cpage} / ${loc.ctotal}` : '';
  const pdfMarks: PdfMark[] = useMemo(() => roots.map((n) => ({ id: n.id, quote: n.quote, page: n.page_no ?? 0, color: n.author === 'ta' ? HER_MARK : HIS_MARK })), [roots]);
  const PdfView = NidPdfView;
  const chromeTop = insets.top + 6;
  const ink = theme.ink || '#1a1a1a';
  const btnBg = themeIdx === 1 ? 'rgba(255,255,255,0.14)' : 'rgba(120,120,128,0.16)';

  return (
    <View style={[styles.root, { backgroundColor: theme.paper }]}>
      <StatusBar style={themeIdx === 1 ? 'light' : 'dark'} />
      {isPdf ? (
        PdfView && pdfPath ? (
          <PdfView
            ref={pdf}
            style={[StyleSheet.absoluteFill, { top: insets.top + 40, bottom: insets.bottom + 40 }]}
            path={pdfPath}
            initialPage={Number(initial.pos[String(bookId)] || 1)}
            paper={theme.paper}
            marks={pdfMarks}
            onLoad={(e) => (e.nativeEvent.ok ? setReady(true) : setFailed("This PDF wouldn't open."))}
            onPageChanged={(e) => {
              const { page, total } = e.nativeEvent;
              setLoc((l) => ({ ...l, page, total, pct: total ? page / total : 0 }));
              reading.current = { ...reading.current, pos: { ...reading.current.pos, [String(bookId)]: page } };
              saveReading(reading.current);
              saveProgressSoon(bookId, total ? (page / total) * 100 : 0, page);
            }}
            onSelection={(e) => setSel(e.nativeEvent.text ? { text: e.nativeEvent.text, page: e.nativeEvent.page } : null)}
            onTapMark={(e) => {
              const root = notes.find((n) => n.id === e.nativeEvent.id);
              if (root) openThread(root);
            }}
            onTap={() => {
              setPanel(null);
              setChrome((c) => !c);
            }}
          />
        ) : null
      ) : WebView ? (
        <WebView
          ref={web}
          source={{ html, baseUrl: API_BASE }}
          originWhitelist={['*']}
          onMessage={onMessage}
          scrollEnabled={false}
          bounces={false}
          style={{ flex: 1, backgroundColor: theme.paper }}
          containerStyle={{ backgroundColor: theme.paper }}
          javaScriptEnabled
          allowsLinkPreview={false}
          dataDetectorTypes="none"
          textInteractionEnabled
          // Like Apple Books: Highlight / Add Note live in the system selection menu itself.
          menuItems={MENU}
          onCustomMenuSelection={(e) => onMenu(e.nativeEvent.key)}
        />
      ) : null}

      {!ready && !failed && (
        <View style={styles.center} pointerEvents="none">
          <ActivityIndicator color={theme.meta} />
        </View>
      )}
      {!!(failed || (isPdf && !NidPdfView) || (!isPdf && !WebView)) && (
        <View style={styles.center}>
          <Text style={[styles.failed, { color: theme.meta }]}>{failed || 'Reading needs the newer app build from TestFlight.'}</Text>
        </View>
      )}

      {chrome && (
        <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(160)} style={[styles.topBar, { top: chromeTop }]} pointerEvents="box-none">
          <Text style={[styles.title, { color: theme.meta }]} numberOfLines={1}>
            {loc.chapter || p.title}
          </Text>
          <Pressable onPress={() => router.back()} style={[styles.round, styles.close, { backgroundColor: btnBg }]} hitSlop={8} accessibilityLabel="Close book">
            <SymbolView name="xmark" size={13} weight="bold" tintColor={ink} />
          </Pressable>
        </Animated.View>
      )}
      <Text style={[styles.page, { color: theme.meta, bottom: insets.bottom + 14 }]} pointerEvents="none">
        {pageLabel}
      </Text>
      {chrome && (
        <Pressable
          onPress={() => openPanel(panel === 'menu' ? null : 'menu')}
          style={[styles.round, styles.menuBtn, { bottom: insets.bottom + 6, backgroundColor: btnBg }]}
          accessibilityLabel="Reading menu">
          <SymbolView name="list.bullet" size={16} weight="semibold" tintColor={ink} />
        </Pressable>
      )}

      {isPdf && sel && !thread && (
        <Animated.View entering={FadeInDown.duration(160)} exiting={FadeOutDown.duration(120)} style={[styles.selBar, { bottom: insets.bottom + 56 }]}>
          <Pressable onPress={() => highlight(false)} style={styles.selBtn}>
            <View style={[styles.swatch, { backgroundColor: HER_MARK }]} />
            <Text style={styles.selText}>Highlight</Text>
          </Pressable>
          <View style={styles.selSep} />
          <Pressable onPress={() => highlight(true)} style={styles.selBtn}>
            <SymbolView name="note.text" size={15} tintColor="#fff" />
            <Text style={styles.selText}>Add Note</Text>
          </Pressable>
        </Animated.View>
      )}

      {footnote && (
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setFootnote(null)}>
          <Animated.View entering={FadeInDown.duration(180)} style={[styles.footnote, { bottom: insets.bottom + 70 }]}>
            {!!footnote.label && <Text style={styles.fnLabel}>{footnote.label}</Text>}
            <ScrollView style={{ maxHeight: 260 }}>
              <Text style={styles.fnText}>{footnote.text}</Text>
            </ScrollView>
          </Animated.View>
        </Pressable>
      )}

      {panel === 'menu' && (
        <>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setPanel(null)} />
          <Animated.View entering={FadeInDown.duration(180)} exiting={FadeOut.duration(120)} style={[styles.menu, { bottom: insets.bottom + 54 }]}>
            <MenuRow dark label={`Contents · ${Math.round(loc.pct * 100)}%`} icon="list.bullet" onPress={() => openPanel('toc')} />
            <MenuRow label="Bookmarks & Highlights" right={String(roots.length)} onPress={() => openPanel('marks')} />
            <MenuRow label="Search Book" icon="magnifyingglass" onPress={() => openPanel('search')} />
            <MenuRow label="Themes & Settings" icon="textformat.size" onPress={() => openPanel('themes')} />
          </Animated.View>
        </>
      )}

      {(panel === 'toc' || panel === 'marks' || panel === 'search') && (
        <Sheet title={panel === 'toc' ? 'Contents' : panel === 'marks' ? 'Highlights' : 'Search'} onClose={() => setPanel(null)} bottom={insets.bottom}>
          {panel === 'toc' && (
            <FlatList
              data={toc}
              keyExtractor={(_, i) => String(i)}
              ListEmptyComponent={<Text style={styles.empty}>This book has no contents list.</Text>}
              renderItem={({ item }) => (
                <Pressable onPress={() => goTo(item)} style={({ pressed }) => [styles.row, { paddingLeft: 18 + item.level * 16 }, pressed && styles.pressed]}>
                  <Text style={styles.rowText} numberOfLines={2}>
                    {item.label}
                  </Text>
                  {!!item.page && <Text style={styles.rowMeta}>{item.page}</Text>}
                </Pressable>
              )}
            />
          )}
          {panel === 'marks' && (
            <FlatList
              data={roots}
              keyExtractor={(n) => String(n.id)}
              ListEmptyComponent={<Text style={styles.empty}>Select some text to highlight it.</Text>}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    goTo({ cfi: item.cfi, page: item.page_no ?? undefined });
                    openThread(item);
                  }}
                  style={({ pressed }) => [styles.row, styles.markRow, pressed && styles.pressed]}>
                  <View style={[styles.markBar, { backgroundColor: item.author === 'ta' ? HER_MARK : HIS_MARK }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowText} numberOfLines={3}>
                      {item.quote}
                    </Text>
                    {!!item.text && (
                      <Text style={styles.rowMeta} numberOfLines={2}>
                        {item.author === 'ta' ? '挞挞' : 'Antoine'}：{item.text}
                      </Text>
                    )}
                  </View>
                </Pressable>
              )}
            />
          )}
          {panel === 'search' && (
            <>
              <View style={styles.searchRow}>
                <SymbolView name="magnifyingglass" size={15} tintColor="#8e8e93" />
                <TextInput
                  value={q}
                  onChangeText={setQ}
                  onSubmitEditing={runSearch}
                  placeholder="Search this book"
                  placeholderTextColor="#8e8e93"
                  style={styles.searchInput}
                  autoFocus
                  returnKeyType="search"
                />
              </View>
              {hits && hits.length === 0 && <ActivityIndicator style={{ marginTop: 20 }} />}
              <FlatList
                data={hits ?? []}
                keyExtractor={(_, i) => String(i)}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <Pressable onPress={() => goTo(item)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                    <Text style={styles.rowText} numberOfLines={3}>
                      {item.excerpt}
                    </Text>
                    {!!item.page && <Text style={styles.rowMeta}>{item.page}</Text>}
                  </Pressable>
                )}
              />
            </>
          )}
        </Sheet>
      )}

      {panel === 'themes' && (
        <Sheet title="Themes & Settings" onClose={() => setPanel(null)} bottom={insets.bottom} compact>
          {!isPdf && (
            <View style={styles.sizes}>
              <Pressable onPress={() => bump(-10)} style={styles.sizeBtn} accessibilityLabel="Smaller text">
                <Text style={{ fontSize: 15 }}>A</Text>
              </Pressable>
              <Pressable onPress={() => bump(10)} style={styles.sizeBtn} accessibilityLabel="Larger text">
                <Text style={{ fontSize: 21 }}>A</Text>
              </Pressable>
            </View>
          )}
          <View style={styles.tgrid}>
            {THEMES.map((t, i) => (
              <Pressable key={t.name} onPress={() => setTheme(i)} style={[styles.tbtn, { backgroundColor: t.paper }, i === themeIdx && styles.tsel]}>
                <Text style={[styles.tAa, { color: t.ink || '#1a1a1a', fontWeight: t.weight === 600 ? '700' : '400' }]}>大小</Text>
                <Text style={[styles.tName, { color: t.ink || '#1a1a1a' }]}>{t.name}</Text>
              </Pressable>
            ))}
          </View>
        </Sheet>
      )}

      {markMenu && (
        <MarkMenu
          menu={markMenu}
          screenW={screenW}
          top={insets.top + 8}
          items={
            markMenu.root.author === 'ta'
              ? [
                  { label: 'Edit Note', on: () => setEditor({ quote: markMenu.root.quote, root: markMenu.root, at: markMenu.root.created_at }) },
                  ...(threadOf(markMenu.root, notes).length ? [{ label: 'Replies', on: () => openThread(markMenu.root) }] : []),
                  { label: 'Remove…', on: () => removeMark(markMenu.root) },
                ]
              : [{ label: 'Reply', on: () => openThread(markMenu.root) }]
          }
          onClose={() => setMarkMenu(null)}
        />
      )}
      {editor && <NoteEditor quote={editor.quote} initial={editor.root?.text ?? ''} at={editor.at} onSave={saveEditor} onClose={() => setEditor(null)} bottom={insets.bottom} />}
      {thread && <NoteThread quote={thread.quote} root={thread.root} all={notes} onSend={sendNote} onClose={() => setThread(null)} bottom={insets.bottom + 10} />}
    </View>
  );
}

// The iOS edit-menu look, floated over a highlight she tapped: Edit Note | Remove… (Apple Books).
function MarkMenu({
  menu,
  items,
  screenW,
  top,
  onClose,
}: {
  menu: { x: number; y: number; bottom: number };
  items: { label: string; on: () => void }[];
  screenW: number;
  top: number;
  onClose: () => void;
}) {
  const [w, setW] = useState(0);
  const above = menu.y - 54 > top;
  const y = above ? menu.y - 54 : menu.bottom + 10;
  const left = Math.max(12, Math.min(screenW - 12 - w, menu.x - 20));
  return (
    <>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <Animated.View entering={FadeIn.duration(140)} onLayout={(e) => setW(e.nativeEvent.layout.width)} style={[styles.mm, { top: y, left, opacity: w ? 1 : 0 }]}>
        <BlurView tint="systemChromeMaterialLight" intensity={95} style={StyleSheet.absoluteFill} />
        {items.map((it, i) => (
          <Pressable
            key={it.label}
            onPress={() => {
              Haptics.selectionAsync();
              onClose();
              it.on();
            }}
            style={({ pressed }) => [styles.mmItem, i > 0 && styles.mmLine, pressed && { backgroundColor: 'rgba(0,0,0,0.06)' }]}>
            <Text style={styles.mmText}>{it.label}</Text>
          </Pressable>
        ))}
      </Animated.View>
    </>
  );
}

function MenuRow({ label, icon, right, dark, onPress }: { label: string; icon?: SFSymbol; right?: string; dark?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.menuRow, dark && styles.menuDark, pressed && { opacity: 0.8 }]}>
      <Text style={[styles.menuText, dark && { color: '#fff' }]}>{label}</Text>
      {icon ? <SymbolView name={icon} size={15} tintColor={dark ? '#fff' : '#111'} /> : <Text style={[styles.menuText, dark && { color: '#fff' }]}>{right}</Text>}
    </Pressable>
  );
}

function Sheet({ title, onClose, bottom, compact, children }: { title: string; onClose: () => void; bottom: number; compact?: boolean; children: React.ReactNode }) {
  return (
    <>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.18)' }]} onPress={onClose} />
      <Animated.View entering={FadeInDown.duration(200)} exiting={FadeOutDown.duration(150)} style={[styles.sheet, { paddingBottom: bottom + 10 }, !compact && { height: '72%' }]}>
        <BlurView tint="systemChromeMaterialLight" intensity={95} style={StyleSheet.absoluteFill} />
        <View style={styles.sheetHead}>
          <Text style={styles.sheetTitle}>{title}</Text>
          <Pressable onPress={onClose} style={styles.sheetX} hitSlop={8} accessibilityLabel="Close">
            <SymbolView name="xmark" size={12} weight="bold" tintColor="#555" />
          </Pressable>
        </View>
        {children}
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', padding: 40 },
  failed: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  topBar: { position: 'absolute', left: 0, right: 0, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 13, fontWeight: '600', maxWidth: '64%' },
  round: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  close: { position: 'absolute', right: 16 },
  page: { position: 'absolute', left: 0, right: 0, textAlign: 'center', fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  menuBtn: { position: 'absolute', right: 18, width: 40, height: 40, borderRadius: 20 },
  menu: { position: 'absolute', right: 16, width: 260, gap: 8 },
  menuRow: {
    height: 46,
    borderRadius: 23,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(235,235,238,0.96)',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  menuDark: { backgroundColor: '#2c2c2e' },
  menuText: { fontSize: 15, color: '#111' },
  mm: {
    position: 'absolute',
    flexDirection: 'row',
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
  },
  mmItem: { paddingHorizontal: 16, justifyContent: 'center' },
  mmLine: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: 'rgba(60,60,67,0.3)' },
  mmText: { fontSize: 15, color: '#111' },
  selBar: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30,30,32,0.94)',
    borderRadius: 22,
    paddingHorizontal: 6,
    height: 44,
  },
  selBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, height: 44 },
  selSep: { width: StyleSheet.hairlineWidth, height: 22, backgroundColor: 'rgba(255,255,255,0.3)' },
  selText: { color: '#fff', fontSize: 15, fontWeight: '500' },
  swatch: { width: 14, height: 14, borderRadius: 7 },
  footnote: {
    position: 'absolute',
    left: 22,
    right: 22,
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(250,250,250,0.98)',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 18,
  },
  fnLabel: { fontSize: 12, color: '#3456c8', fontWeight: '600', marginBottom: 4 },
  fnText: { fontSize: 14, lineHeight: 22, color: '#222' },
  sheet: { position: 'absolute', left: 8, right: 8, bottom: 8, borderRadius: 28, overflow: 'hidden', paddingTop: 16, backgroundColor: 'rgba(245,245,247,0.7)' },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, marginBottom: 10 },
  sheetTitle: { fontSize: 20, fontWeight: '700', color: '#111' },
  sheetX: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(118,118,128,0.16)', alignItems: 'center', justifyContent: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  pressed: { backgroundColor: 'rgba(0,0,0,0.05)' },
  rowText: { flex: 1, fontSize: 15, color: '#111', lineHeight: 21 },
  rowMeta: { fontSize: 13, color: '#8e8e93', marginTop: 2 },
  markRow: { alignItems: 'stretch' },
  markBar: { width: 3, borderRadius: 2 },
  empty: { textAlign: 'center', color: '#8e8e93', marginTop: 30, fontSize: 14 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(118,118,128,0.14)',
  },
  searchInput: { flex: 1, fontSize: 16, color: '#111' },
  sizes: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 12 },
  sizeBtn: { flex: 1, height: 40, borderRadius: 20, backgroundColor: '#e3e3e6', alignItems: 'center', justifyContent: 'center' },
  tgrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginHorizontal: 16 },
  tbtn: { width: '31%', flexGrow: 1, height: 78, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(0,0,0,0.06)' },
  tsel: { borderColor: '#111' },
  tAa: { fontSize: 22, fontFamily: 'Songti SC' },
  tName: { fontSize: 13, fontWeight: '600', marginTop: 2 },
});
