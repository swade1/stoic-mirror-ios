import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';

export default function Onboarding2() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <View style={styles.spacer} />

      <IconSymbol name="book.fill" size={80} color="#c9b97a" />
      <View style={styles.flexGrow} />

      <Text style={styles.title}>Three voices,{"\n"}one wisdom</Text>

      <View style={styles.philosopherList}>
        <View style={styles.philosopherRow}>
          <Text style={styles.philosopherName}>Marcus Aurelius</Text>
          <Text style={styles.philosopherRole}>Emperor · Meditations</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.philosopherRow}>
          <Text style={styles.philosopherName}>Epictetus</Text>
          <Text style={styles.philosopherRole}>Slave · Discourses</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.philosopherRow}>
          <Text style={styles.philosopherName}>Seneca</Text>
          <Text style={styles.philosopherRole}>Statesman · Letters</Text>
        </View>
      </View>

      <View style={styles.flexGrow} />

      <View style={styles.progressRow}>
        <View style={styles.dot} />
        <View style={[styles.dot, styles.dotActive]} />
        <View style={styles.dot} />
      </View>

      <TouchableOpacity style={styles.button} onPress={() => router.push('/onboarding3')}>
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
    marginBottom: 24,
    textAlign: 'center',
    color: '#f0ead6',
    letterSpacing: 0.5,
    lineHeight: 50,
  },
  philosopherList: {
    width: '100%',
    backgroundColor: '#1e1c18',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#6a6050',
    overflow: 'hidden',
    marginBottom: 32,
  },
  philosopherRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  philosopherName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f0ead6',
  },
  philosopherRole: {
    fontSize: 13,
    color: '#8a7e6e',
  },
  divider: {
    height: 1,
    backgroundColor: '#6a6050',
    marginHorizontal: 20,
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
});
