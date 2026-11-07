import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { NamePromptOptions, registerNamePromptHost } from '@/lib/namePrompt';

export default function NamePromptHost() {
  const [options, setOptions] = useState<NamePromptOptions | null>(null);
  const [value, setValue] = useState('');

  useEffect(() => {
    registerNamePromptHost((opts) => {
      setValue('');
      setOptions(opts);
    });
    return () => registerNamePromptHost(null);
  }, []);

  const close = () => setOptions(null);
  const submit = () => {
    const opts = options;
    const text = value;
    close();
    opts?.onSubmit(text);
  };

  return (
    <Modal visible={!!options} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          <Text style={styles.title}>{options?.title}</Text>
          {options?.message ? <Text style={styles.message}>{options.message}</Text> : null}
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={setValue}
            placeholder={options?.placeholder}
            placeholderTextColor="#8a8270"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={submit}
            accessibilityLabel={options?.placeholder}
          />
          <View style={styles.buttons}>
            <Pressable style={styles.button} onPress={close} accessibilityRole="button">
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={submit} accessibilityRole="button">
              <Text style={styles.confirmText}>{options?.confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 340, backgroundColor: '#1e1c18', borderRadius: 14, borderWidth: 1, borderColor: '#6a6050', padding: 20 },
  title: { color: '#f0ead6', fontSize: 18, fontWeight: '600', textAlign: 'center' },
  message: { color: '#b8b09a', fontSize: 14, textAlign: 'center', marginTop: 6 },
  input: { marginTop: 16, borderWidth: 1, borderColor: '#6a6050', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: '#f0ead6', fontSize: 16, backgroundColor: '#0f0e0c' },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 18 },
  button: { paddingVertical: 8, paddingHorizontal: 16 },
  cancelText: { color: '#b8b09a', fontSize: 16 },
  confirmText: { color: '#c9b97a', fontSize: 16, fontWeight: '600' },
});
