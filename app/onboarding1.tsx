import { useRouter } from 'expo-router';
import React from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function Onboarding1() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <Image
          source={require('../assets/images/mirror-welcome.png')}
          style={styles.mirrorImage}
        />

        <Text style={styles.title}>Your mind won't stop.</Text>

        <Text style={styles.body}>
          You keep thinking about it. The conversation that went wrong. The thing you can't fix. The future you can't predict. No matter how hard you try, your thoughts keep circling back.
        </Text>

        <Text style={styles.body}>
          You're not broken. You're human. But there's a better way.
        </Text>

        <Text style={styles.body}>
          The Stoics believed that wisdom begins with seeing yourself clearly — like looking into a mirror. Not to judge what you see, but to understand it. That's why Marcus Aurelius kept a journal we know today as Meditations. That's why this app is called The Stoic Mirror.
        </Text>

      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.progressRow}>
          <View style={[styles.dot, styles.dotActive]} />
          <View style={styles.dot} />
        </View>
        <TouchableOpacity style={styles.button} onPress={() => router.push('/onboarding2')}>
          <Text style={styles.buttonText}>See how it works</Text>
        </TouchableOpacity>
        <View style={styles.spacer} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0e0c',
  },
  scrollContent: {
    padding: 32,
    paddingTop: 60,
    alignItems: 'center',
  },
  mirrorImage: {
    width: 120,
    height: 120,
    marginBottom: 32,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#f0ead6',
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: 24,
    lineHeight: 44,
  },
  body: {
    fontSize: 17,
    color: '#a89f88',
    textAlign: 'center',
    lineHeight: 28,
    marginBottom: 20,
  },
  footer: {
    padding: 24,
    paddingBottom: 0,
    alignItems: 'center',
  },
  progressRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
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
  spacer: { height: 40 },
});
