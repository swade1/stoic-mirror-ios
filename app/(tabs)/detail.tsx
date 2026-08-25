import React from 'react';
import { View, Text, Image, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAtom } from 'jotai';
import { sessionsAtom, Session } from '@/lib/atoms';

export default function Detail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [sessions] = useAtom(sessionsAtom);
  const session = sessions.find((s: Session) => s.id === id);

  if (!session) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>Session not found</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{session.title || 'Detail'}</Text>
      {session.summary && <Text style={styles.summary}>{session.summary}</Text>}
      {session.image && <Image source={{ uri: session.image }} style={styles.image} />}
      {session.facts && (
        <View style={styles.factsContainer}>
          {session.facts.map((fact, idx) => (
            <View key={idx} style={styles.factBox}>
              <Text style={styles.factText}>{fact}</Text>
            </View>
          ))}
        </View>
      )}
      {session.furtherImpact && (
        <View style={styles.impactBox}>
          <Text style={styles.impactText}>{session.furtherImpact}</Text>
        </View>
      )}
      <TouchableOpacity style={styles.button} onPress={() => router.replace('(tabs)')}>
        <Text style={styles.buttonText}>Try again?</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24 },
  error: { textAlign: 'center', marginTop: 32, color: 'red' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 12 },
  summary: { fontSize: 16, marginBottom: 12 },
  image: { width: '100%', height: 200, borderRadius: 8, marginBottom: 12 },
  factsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  factBox: { backgroundColor: '#e0e0e0', padding: 8, borderRadius: 8, margin: 4 },
  factText: { fontSize: 14 },
  impactBox: { backgroundColor: '#f0f0f0', padding: 12, borderRadius: 8, marginBottom: 24 },
  impactText: { fontSize: 14 },
  button: { backgroundColor: '#000', padding: 16, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
