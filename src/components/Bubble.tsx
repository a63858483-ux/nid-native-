import MaskedView from '@react-native-masked-view/masked-view';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { bubblePath, TAIL_W } from './bubble-path';
import { type Attachment, attachmentUrl, authHeaders } from '@/lib/api';
import { FROSTED_HIS_BUBBLE } from '@/lib/config';
import { inkOn, usePalette } from '@/lib/colors';

type Props = { role: 'user' | 'assistant'; text: string; tail: boolean; myColor: string };

// One outline for body + tail. Without a tail the body starts at x=0, so the
// SVG must not be shifted left, or the bubble lands 7pt off from its neighbours.
export function Bubble({ role, text, tail, myColor }: Props) {
  const pal = usePalette();
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const mine = role === 'user';
  const glassMine = myColor === 'glass';
  const fill = mine ? (glassMine ? pal.hisFill : myColor) : pal.hisFill;
  const ink = mine && !glassMine ? inkOn(myColor) : pal.hisInk;
  const frosted = !mine || glassMine;
  const side = tail ? (mine ? 'right' : 'left') : null;

  const shape = box ? bubblePath(box.w, box.h, side) : '';
  const svgW = box ? box.w + TAIL_W : 0;
  const shapeStyle = box
    ? { position: 'absolute' as const, top: 0, left: side === 'left' ? -TAIL_W : 0, width: svgW, height: box.h + 1 }
    : null;

  return (
    <View style={[styles.wrap, mine ? styles.mine : styles.his]}>
      {box && shapeStyle && frosted && FROSTED_HIS_BUBBLE && (
        <MaskedView
          style={shapeStyle}
          maskElement={
            <Svg width={svgW} height={box.h + 1}>
              <Path d={shape} fill="#000" />
            </Svg>
          }>
          <BlurView tint={pal.hisBlur} intensity={pal.hisBlurIntensity} style={StyleSheet.absoluteFill} />
        </MaskedView>
      )}
      {box && shapeStyle && (
        <Svg style={shapeStyle} width={svgW} height={box.h + 1} pointerEvents="none">
          <Path d={shape} fill={fill} />
        </Svg>
      )}
      <View onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })} style={styles.pad}>
        <Text selectable style={[styles.text, { color: ink }]}>
          {text}
        </Text>
      </View>
    </View>
  );
}

const MAX_IMG = 240;

export function PhotoBubble({ convId, att, mine }: { convId: string; att: Attachment; mine: boolean }) {
  const [ratio, setRatio] = useState(1.25);
  const h = Math.max(120, Math.min(320, MAX_IMG / ratio));
  return (
    <View style={[styles.photo, mine ? styles.mine : styles.his, { width: MAX_IMG, height: h }]}>
      <Image
        source={{ uri: attachmentUrl(convId, att), headers: authHeaders() }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={180}
        onLoad={(e) => e.source?.width && e.source?.height && setRatio(e.source.width / e.source.height)}
      />
    </View>
  );
}

export function FileBubble({ att, mine, myColor }: { att: Attachment; mine: boolean; myColor: string }) {
  const pal = usePalette();
  const bg = mine && myColor !== 'glass' ? myColor : pal.hisFill;
  const ink = mine && myColor !== 'glass' ? inkOn(myColor) : pal.hisInk;
  const ext = (att.name.split('.').pop() || '').toUpperCase().slice(0, 5);
  const size = att.size ? (att.size < 1048576 ? `${Math.round(att.size / 1024)} KB` : `${(att.size / 1048576).toFixed(1)} MB`) : '';
  return (
    <View style={[styles.file, mine ? styles.mine : styles.his, { backgroundColor: bg }]}>
      <View style={[styles.fileIcon, { backgroundColor: pal.card }]}>
        <SymbolView name="doc.fill" size={18} tintColor={pal.ink2} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={[styles.fileName, { color: ink }]}>{att.name}</Text>
        <Text style={[styles.fileMeta, { color: ink }]}>{[ext, size].filter(Boolean).join(' · ')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { maxWidth: '76%' },
  mine: { alignSelf: 'flex-end', marginRight: TAIL_W },
  his: { alignSelf: 'flex-start', marginLeft: TAIL_W },
  pad: { paddingHorizontal: 14, paddingTop: 7, paddingBottom: 8 },
  text: { fontSize: 17, lineHeight: 22 },
  photo: { borderRadius: 18, overflow: 'hidden', backgroundColor: 'rgba(120,120,128,0.18)', borderCurve: 'continuous' },
  file: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, paddingRight: 16, borderRadius: 18, minWidth: 200, maxWidth: '76%', borderCurve: 'continuous' },
  fileIcon: { width: 34, height: 42, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  fileName: { fontSize: 15, fontWeight: '600' },
  fileMeta: { fontSize: 12, opacity: 0.65, marginTop: 2, fontVariant: ['tabular-nums'] },
});
