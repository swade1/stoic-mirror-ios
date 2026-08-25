import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const nextPath = `/onboarding1`;
const loginPath = `/login`;

export default function Start() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <View style={styles.flexGrow} />
      <View style={styles.kywBox}>
        <Text style={styles.kywText}>AN</Text>
      </View>
      <Text style={styles.title}>App Name</Text>
      <Text style={styles.subtitle}>A one liner for your app</Text>
      <View style={styles.flexGrow} />
      <TouchableOpacity style={styles.button} onPress={() => router.push(nextPath)}>
        <Text style={styles.buttonText}>Get Started</Text>
      </TouchableOpacity>
      <Pressable onPress={() => router.push(loginPath)}>
        <Text style={styles.signInText}>or Sign In here</Text>
      </Pressable>
      <View style={styles.spacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#fff' },
  spacer: { height: 40 },
  kywBox: { backgroundColor: '#7CFFB2', borderRadius: 32, paddingVertical: 24, paddingHorizontal: 36, marginBottom: 32, borderWidth: 1, borderColor: '#222' },
  kywText: { fontSize: 32, fontWeight: 'bold', color: '#222', textAlign: 'center' },
  title: { fontSize: 40, fontWeight: 'bold', marginBottom: 12, textAlign: 'center', color: '#111' },
  subtitle: { fontSize: 24, color: '#111', marginBottom: 32, textAlign: 'center' },
  flexGrow: { flex: 1 },
  button: { backgroundColor: '#000', paddingVertical: 16, paddingHorizontal: 48, borderRadius: 20, marginBottom: 12, width: '100%' },
  buttonText: { color: '#fff', fontSize: 28, fontWeight: 'bold', textAlign: 'center' },
  signInText: { color: '#111', fontSize: 20, textAlign: 'center', textDecorationLine: 'underline', marginBottom: 24 },
});
