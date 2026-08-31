import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const REASONS = [
  'Anxiety & worry',
  'Relationships & conflict',
  'Work & career stress',
  'Loss & grief',
  'Finding direction',
  'General peace of mind',
];

export default function Onboarding2() {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);

  const handleContinue = async () => {
    if (selected.length > 0) {
      await AsyncStorage.setItem('user_primary_concern', JSON.stringify(selected));
    }
    router.push('/signup');
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        <Image
          source={require('../assets/images/mirror-welcome.png')}
          style={styles.mirrorImage}
        />

        <Text style={styles.title}>What brings you here?</Text>

        <Text style={styles.subtitle}>
          Your answer helps us find the most relevant wisdom for you.
        </Text>

        <View style={styles.options}>
          {REASONS.map((reason) => (
            <TouchableOpacity
              key={reason}
              style={[styles.option, selected.includes(reason) && styles.optionSelected]}
              onPress={() => {
                setSelected((prev) =>
                  prev.includes(reason)
                    ? prev.filter((r) => r !== reason)
                    : [...prev, reason]
                );
              }}
            >
              <Text style={[styles.optionText, selected.includes(reason) && styles.optionTextSelected]}>
                {reason}
              </Text>
              {selected.includes(reason) && (
                <Text style={styles.checkmark}>✓</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.progressRow}>
          <View style={styles.dot} />
          <View style={[styles.dot, styles.dotActive]} />
        </View>
        <TouchableOpacity
          style={[styles.button, selected.length === 0 && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={selected.length === 0}
        >
          <Text style={[styles.buttonText, selected.length === 0 && styles.buttonTextDisabled]}>
            Continue
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.skip} onPress={() => router.push('/signup')}>
          <Text style={styles.skipText}>Skip</Text>
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
    marginBottom: 12,
    lineHeight: 44,
  },
  subtitle: {
    fontSize: 16,
    color: '#a89f88',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  options: {
    width: '100%',
    gap: 12,
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e1c18',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#4a4540',
  },
  optionSelected: {
    borderColor: '#c9b97a',
    backgroundColor: '#2a2720',
  },
  optionText: {
    fontSize: 16,
    color: '#a89f88',
  },
  optionTextSelected: {
    color: '#f0ead6',
    fontWeight: '600',
  },
  checkmark: {
    fontSize: 16,
    color: '#c9b97a',
    fontWeight: 'bold',
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
  buttonDisabled: {
    borderColor: '#4a4540',
    backgroundColor: '#1a1814',
  },
  buttonText: {
    color: '#c9b97a',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 2,
  },
  buttonTextDisabled: {
    color: '#4a4540',
  },
  skip: {
    marginTop: 16,
  },
  skipText: {
    fontSize: 14,
    color: '#5a5446',
    textDecorationLine: 'underline',
  },
  spacer: { height: 40 },
});
