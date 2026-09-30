import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Group } from '@/components/Group';
import { SheetHeader } from '@/components/SheetHeader';
import { usePalette } from '@/lib/colors';
import { useApp } from '@/state/app';

export default function NameSheet() {
  const pal = usePalette();
  const { prefs, setPrefs } = useApp();
  const [v, setV] = useState(prefs.name);
  const save = () => {
    setPrefs({ name: v.trim() || 'Antoine' });
    router.back();
  };
  return (
    <View>
      <SheetHeader title="Name" />
      <Group>
        <TextInput
          value={v}
          onChangeText={setV}
          autoFocus
          selectTextOnFocus
          maxLength={16}
          placeholder="Antoine"
          placeholderTextColor={pal.ink2}
          onSubmitEditing={save}
          returnKeyType="done"
          style={[styles.input, { color: pal.ink }]}
        />
      </Group>
      <Pressable onPress={save} style={[styles.btn, { backgroundColor: pal.ink }]}>
        <Text style={[styles.btnText, { color: pal.bg }]}>Save</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  input: { fontSize: 17, paddingHorizontal: 18, height: 54 },
  btn: { marginHorizontal: 16, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  btnText: { fontSize: 16, fontWeight: '700' },
});
