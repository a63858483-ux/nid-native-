import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

import { Glass } from '@/components/Glass';
import { usePalette } from '@/lib/colors';
import { AuthError, useApp } from '@/state/app';

export default function Login() {
  const pal = usePalette();
  const { signIn } = useApp();
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const go = async () => {
    if (!pw || busy) return;
    setBusy(true);
    setErr('');
    try {
      await signIn(pw);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/');
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErr(e instanceof AuthError ? 'That password is not right.' : "Can't reach the server. Check your connection.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.wrap, { backgroundColor: pal.bg }]}>
      <View style={styles.center}>
        <Text style={[styles.brand, { color: pal.ink }]}>Nid douillet</Text>
        <Text style={[styles.sub, { color: pal.ink2 }]}>Sign in with the same password as the web app.</Text>
        <TextInput
          value={pw}
          onChangeText={setPw}
          secureTextEntry
          autoFocus
          placeholder="Password"
          placeholderTextColor={pal.ink2}
          onSubmitEditing={go}
          returnKeyType="go"
          style={[styles.input, { backgroundColor: pal.card, color: pal.ink }]}
        />
        {err ? <Text style={styles.err}>{err}</Text> : null}
        <Pressable onPress={go} disabled={!pw || busy}>
          <Glass interactive tint={pal.blue} style={[styles.btn, (!pw || busy) && { opacity: 0.5 }]}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Sign in</Text>}
          </Glass>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', paddingHorizontal: 28, gap: 14 },
  brand: { fontFamily: 'PlayfairDisplay_800ExtraBold_Italic', fontSize: 44, textAlign: 'center' },
  sub: { textAlign: 'center', fontSize: 14, marginBottom: 18 },
  input: { height: 52, borderRadius: 16, paddingHorizontal: 16, fontSize: 17 },
  err: { color: '#FF3B30', fontSize: 14, textAlign: 'center' },
  btn: { height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '600' },
});
