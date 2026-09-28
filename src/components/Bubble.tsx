import MaskedView from '@react-native-masked-view/masked-view';
import { BlurView } from 'expo-blur';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { bubblePath, TAIL_W } from './bubble-path';
import { FROSTED_HIS_BUBBLE } from '@/lib/config';
import { inkOn, usePalette } from '@/lib/colors';

type Props = { role: 'user' | 'assistant'; text: string; tail: boolean; myColor: string };

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
    ? { position: 'absolute' as const, top: 0, left: mine ? 0 : -TAIL_W, width: svgW, height: box.h + 1 }
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
          <BlurView tint={pal.dark ? 'systemThinMaterialDark' : 'systemThinMaterialLight'} intensity={60} style={StyleSheet.absoluteFill} />
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

const styles = StyleSheet.create({
  wrap: { maxWidth: '76%' },
  mine: { alignSelf: 'flex-end', marginRight: TAIL_W },
  his: { alignSelf: 'flex-start', marginLeft: TAIL_W },
  pad: { paddingHorizontal: 13, paddingTop: 7, paddingBottom: 8 },
  text: { fontSize: 17, lineHeight: 22 },
});
