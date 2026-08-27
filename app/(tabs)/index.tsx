import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CounselScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState('');

  const handleSeekCounsel = () => {
    if (!input.trim()) return;
    router.push(`/loading?prompt=${encodeURIComponent(input.trim())}`);
    setInput('');
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>The Stoic Mirror</Text>
        <Text style={styles.headerSubtitle}>Seek counsel from the philosophers</Text>
      </View>

      {/* Main content */}
      <View style={styles.content}>
        <Text style={styles.prompt}>What troubles you?</Text>
        <Text style={styles.promptSub}>
          Describe your concern openly. The philosophers will counsel you from their own words.
        </Text>

        <TextInput
          style={styles.textInput}
          placeholder="Speak freely..."
          placeholderTextColor="#5a5446"
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={2000}
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={[styles.sendButton, !input.trim() && styles.sendButtonDisabled]}
          onPress={handleSeekCounsel}
          disabled={!input.trim()}
        >
          <Text style={[styles.sendButtonText, !input.trim() && styles.sendButtonTextDisabled]}>
            Seek Counsel
          </Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 80 }]}>
        <Text style={styles.footerText}>
          Drawing from Marcus Aurelius · Epictetus · Seneca
        </Text>
      </View>

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0e0c',
  },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2720',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f0ead6',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#5a5446',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  prompt: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#f0ead6',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  promptSub: {
    fontSize: 15,
    color: '#5a5446',
    lineHeight: 22,
    marginBottom: 32,
  },
  textInput: {
    backgroundColor: '#1e1c18',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    color: '#f0ead6',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#3a3730',
    minHeight: 160,
    maxHeight: 280,
    marginBottom: 16,
  },
  sendButton: {
    backgroundColor: '#2a2720',
    paddingVertical: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#c9b97a',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    borderColor: '#3a3730',
  },
  sendButtonText: {
    color: '#c9b97a',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  sendButtonTextDisabled: {
    color: '#3a3730',
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 11,
    color: '#5a5446',
    letterSpacing: 1,
    textAlign: 'center',
  },
});
