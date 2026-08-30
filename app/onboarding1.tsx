import { useRouter } from 'expo-router';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function Onboarding1() {
  const router = useRouter();
  return (
    <View style={styles.container}>
    <View style={styles.flexGrow} />
    <Image
      source={require('../assets/images/mirror-welcome.png')}
      style={styles.wreathImage}
    />
    <Text style={styles.title}>{"A mirror for\nthe mind"}</Text>

      <Text style={styles.subtitle}>
        {"Describe what's troubling you and receive counsel from the greatest Stoic philosophers in history."}
      </Text>

      <View style={styles.flexGrow} />

      <View style={styles.progressRow}>
        <View style={[styles.dot, styles.dotActive]} />
        <View style={styles.dot} />
        <View style={styles.dot} />
      </View>

      <TouchableOpacity style={styles.button} onPress={() => router.push('/onboarding2')}>
        <Text style={styles.buttonText}>Next</Text>
      </TouchableOpacity>

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
  icon: {
    fontSize: 80,
    textAlign: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 42,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#f0ead6',
    letterSpacing: 0.5,
    lineHeight: 50,
  },
  subtitle: {
    fontSize: 18,
    color: '#c4b99e',
    marginBottom: 32,
    textAlign: 'center',
    lineHeight: 28,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 32,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6a6050',
  },
  dotActive: {
    backgroundColor: '#c9b97a',
  },
  button: {
    backgroundColor: '#2a2720',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 20,
    width: '100%',
    borderWidth: 1,
    borderColor: '#c9b97a',
  },
  buttonText: {
    color: '#c9b97a',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 2,
  },
  wreathImage: {
    width: 160,
    height: 160,
    marginBottom: 16,
  },
});
