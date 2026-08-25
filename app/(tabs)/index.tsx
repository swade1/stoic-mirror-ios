import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { useAtom } from 'jotai';
import { sessionsAtom, Session } from '@/lib/atoms';
import { useRouter } from 'expo-router';

export default function HomeScreen() {
  const router = useRouter();
  const [sessions] = useAtom(sessionsAtom);
  const [input, setInput] = useState('');

  return (
    <View style={styles.container}>
      <FlatList
        data={sessions}
        keyExtractor={(item: Session) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.sessionItem}
            onPress={() => router.push(`/detail?id=${item.id}`)}
          >
            <Text style={styles.sessionDate}>{item.date}</Text>
            <Text style={styles.sessionTitle}>{item.title}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>No previous sessions</Text>}
        contentContainerStyle={styles.listContainer}
      />
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          placeholder="ask something here to get started!"
          value={input}
          onChangeText={setInput}
        />
        <TouchableOpacity
          style={styles.sendButton}
          onPress={() => {
            router.push(`/loading?prompt=${encodeURIComponent(input)}`);
            setInput('');
          }}
        >
          <Text style={styles.sendText}>→</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContainer: { padding: 24 },
  sessionItem: { marginBottom: 16, padding: 12, borderRadius: 8, backgroundColor: '#f0f0f0' },
  sessionDate: { fontSize: 12, color: '#666' },
  sessionTitle: { fontSize: 16, fontWeight: 'bold' },
  emptyText: { textAlign: 'center', marginTop: 32, color: '#666' },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#000',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
  },
  sendButton: {
    backgroundColor: '#000',
    padding: 12,
    borderRadius: 24,
  },
  sendText: {
    color: '#fff',
    fontSize: 18,
  },
});
