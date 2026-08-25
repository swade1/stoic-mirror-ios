import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function Onboarding1() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <View style={styles.spacer} />
      <View style={styles.kywBox}>
        <Text style={styles.kywText}>AN</Text>
      </View>
            <View style={styles.flexGrow} />
      <Text style={styles.title}>Problem{"\n"}Statement</Text>
      <Text style={styles.subtitle}>Simple clear statement{"\n"}that does not confuse</Text>
      <View style={styles.flexGrow} />
      <TouchableOpacity style={styles.button} onPress={() => router.push('/onboarding2')}>
        <Text style={styles.buttonText}>Next</Text>
      </TouchableOpacity>
      <View style={styles.spacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#fff' },
  spacer: { height: 40 },
  kywBox: { backgroundColor: '#7CFFB2', borderRadius: 32, paddingVertical: 24, paddingHorizontal: 36, marginBottom: 32, borderWidth: 1, borderColor: '#222' },
  kywText: { fontSize: 32, fontWeight: 'bold', color: '#222', textAlign: 'center' },
  title: { fontSize: 48, fontWeight: 'bold', marginBottom: 12, textAlign: 'center', color: '#111' },
  subtitle: { fontSize: 28, color: '#111', marginBottom: 32, textAlign: 'center' },
  flexGrow: { flex: 1 },
  button: { backgroundColor: '#000', paddingVertical: 20, paddingHorizontal: 48, borderRadius: 32, marginBottom: 12, width: '100%' },
  buttonText: { color: '#fff', fontSize: 32, fontWeight: 'bold', textAlign: 'center' },
});
