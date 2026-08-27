import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';

export default function Onboarding3() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <View style={styles.spacer} />

      <IconSymbol name="shield.fill" size={80} color="#c9b97a" />

      <View style={styles.flexGrow} />

      <Text style={styles.title}>Wisdom,{"\n"}not therapy</Text>
      <Text style={styles.subtitle}>
        {"The Stoic Mirror offers ancient philosophical counsel — not medical or psychological advice. For serious concerns, please seek a qualified professional."}
      </Text>

      <View style={styles.quoteBox}>
        <Text style={styles.quote}>
          {"\"You have power over your mind, not outside events. Realize this, and you will find strength.\""}
        </Text>
        <Text style={styles.quoteAuthor}>— Marcus Aurelius</Text>
      </View>

      <View style={styles.flexGrow} />

      <View style={styles.progressRow}>
        <View style={styles.dot} />
        <View style={styles.dot} />
        <View style={[styles.dot, styles.dotActive]} />
      </View>

      <TouchableOpacity style={styles.button} onPress={() => router.push('/signup')}>
        <Text style={styles.buttonText}>Begin my practice</Text>
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
    fontSize: 16,
    color: '#a89f88',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 26,
  },
  quoteBox: {
    backgroundColor: '#1e1c18',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#3a3730',
    borderLeftWidth: 3,
    borderLeftColor: '#c9b97a',
    padding: 20,
    marginBottom: 32,
    width: '100%',
  },
  quote: {
    fontSize: 15,
    color: '#c9b97a',
    fontStyle: 'italic',
    lineHeight: 24,
    marginBottom: 8,
  },
  quoteAuthor: {
    fontSize: 13,
    color: '#5a5446',
    textAlign: 'right',
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
    backgroundColor: '#3a3730',
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
});
