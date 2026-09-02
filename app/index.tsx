import { useRouter } from 'expo-router';
import React from 'react';
import { Image, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const nextPath = `/onboarding1`;
const loginPath = `/login`;

export default function Start() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <View style={styles.flexGrow} />

      <Image
        source={require('../assets/images/mirror-welcome.png')}
        style={styles.mirrorImage}
      />

      <Text style={styles.title}>The Stoic Mirror</Text>

      <Text style={styles.tagline}>
        When all you want is peace of mind.
      </Text>

      <Text style={styles.description}>
        Describe what's troubling you and receive personalized wisdom from Marcus Aurelius, Epictetus, and Seneca.
      </Text>

      <Text style={styles.attribution}>
        2,000 years of Stoic philosophy · matched to your concern
      </Text>

      <View style={styles.flexGrow} />

      <TouchableOpacity style={styles.button} onPress={() => router.push(nextPath)}>
        <Text style={styles.buttonText}>Begin</Text>
      </TouchableOpacity>

      <Pressable onPress={() => router.push(loginPath)}>
        <Text style={styles.signInText}>or Sign In here</Text>
      </Pressable>

      <View style={styles.spacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#0f0e0c',
  },
  spacer: { height: 40 },
  flexGrow: { flex: 1 },
  mirrorImage: {
    width: 160,
    height: 160,
    marginBottom: 32,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
    color: '#f0ead6',
    letterSpacing: 0.5,
  },
  tagline: {
    fontSize: 20,
    color: '#c9b97a',
    marginBottom: 16,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 28,
    paddingHorizontal: 16,
  },
  description: {
    fontSize: 16,
    color: '#a89f88',
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 26,
    paddingHorizontal: 8,
  },
  attribution: {
    fontSize: 12,
    color: '#a89f88',
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: 32,
  },
  button: {
    backgroundColor: '#2a2720',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 20,
    marginBottom: 12,
    width: '100%',
    borderWidth: 1,
    borderColor: '#c9b97a',
  },
  buttonText: {
    color: '#c9b97a',
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 2,
  },
  signInText: {
    color: '#8a7e6e',
    fontSize: 16,
    textAlign: 'center',
    textDecorationLine: 'underline',
    marginBottom: 24,
  },
});
