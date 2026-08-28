import React, { useState, useEffect } from 'react';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { IconSymbol } from '@/components/ui/IconSymbol';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

export default function CounselScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState('');
  const [listening, setListening] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  

  const handleMic = async () => {
    try {
      const SpeechModule = require('expo-speech-recognition');
      if (listening) {
        SpeechModule.ExpoSpeechRecognitionModule.stop();
        setListening(false);
        return;
      }
      const { granted } = await SpeechModule.ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!granted) return;
      setListening(true);
      SpeechModule.ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        continuous: false,
        interimResults: true,
      });
    } catch (e) {
      console.log('Speech recognition not available on this device');
      setListening(false);
    }
  };

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const handleSeekCounsel = () => {
    if (!input.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
        <Image
          source={require('../../assets/images/wreath-small-bright.png')}
          style={styles.wreathSmall}
        />
        <View>
          <Text style={styles.headerTitle}>The Stoic Mirror</Text>
          <Text style={styles.headerSubtitle}>Seek counsel from the philosophers</Text>
        </View>
      </View>

      {/* Main content */}
      <View style={styles.content}>
        <Text style={styles.prompt}>What troubles you?</Text>
        <Text style={styles.promptSub}>
          Describe your concern openly. The philosophers will counsel you from their own words.
        </Text>

      <View style={styles.textInputContainer}>
      <TextInput
        style={styles.textInput}
        placeholder="Speak freely..."
        placeholderTextColor="#8a7e6e"
        value={input}
        onChangeText={setInput}
        multiline
        maxLength={2000}
        textAlignVertical="top"
      />
      <TouchableOpacity
        style={[styles.micButton, listening && styles.micButtonActive]}
        onPress={handleMic}
      >
        <IconSymbol
          name={listening ? 'stop.fill' : 'mic.fill'}
          size={16}
          color={listening ? '#0f0e0c' : '#c9b97a'}
        />
      </TouchableOpacity>
    </View>
    
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

      {!keyboardVisible && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 80 }]}>
          <Text style={styles.footerText}>
            Drawing from Marcus Aurelius · Epictetus · Seneca
          </Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0e0c',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#4a4540',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f0ead6',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#a89f88',
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
    color: '#8a7e6e',
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
    borderColor: '#6a6050',
    minHeight: 160,
    maxHeight: 280,
    marginBottom: 16,
  },
  sendButton: {
    backgroundColor: '#2a2720',
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#c9b97a',
    alignItems: 'center',
    width: '100%',
  },
  sendButtonDisabled: {
    borderColor: '#6a6050',
  },
  sendButtonText: {
    color: '#c9b97a',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  sendButtonTextDisabled: {
    color: '#6a6050',
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 11,
    color: '#a89f88',
    letterSpacing: 1,
    textAlign: 'center',
  },
  wreathSmall: {
    width: 68,
    height: 68,
    marginRight: 12,
  },
  inputButtons: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  textInputContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  micButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#2a2720',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#c9b97a',
    zIndex: 1,
  },
  micButtonActive: {
    backgroundColor: '#c9b97a',
  },  
});
