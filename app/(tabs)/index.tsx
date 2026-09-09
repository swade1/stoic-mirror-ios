import React, { useState, useEffect, useCallback } from 'react';
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
  ScrollView,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { getDailyQuoteId } from '@/lib/dailyQuote';

export default function CounselScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState('');
  const [listening, setListening] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [dailyQuote, setDailyQuote] = useState<{ quote: string; author: string; source: string } | null>(null);
  const [expandedQuote, setExpandedQuote] = useState(false);
  const [activeConcerns, setActiveConcerns] = useState<string[]>([]);


  //TESTING ONLY - remove after one run

  // Surfaces the same profiles.concerns used to boost retrieval in
  // loading.tsx, so the personalization is visible rather than silent —
  // the honesty requirement behind the concern-boosting feature.
  const loadActiveConcerns = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase
      .from('profiles')
      .select('concerns')
      .eq('id', session.user.id)
      .single();
    setActiveConcerns(data?.concerns ?? []);
  };

  const loadDailyQuote = async () => {
    const { count } = await supabase
      .from('daily_quotes')
      .select('*', { count: 'exact', head: true });

    if (!count) return;

    const index = getDailyQuoteId(new Date(), count);

    const { data } = await supabase
      .from('daily_quotes')
      .select('quote, author, source')
      .eq('id', index)
      .single();

    if (data) {
      setDailyQuote({
        quote: data.quote,
        author: data.author,
        source: data.source,
      });
    }
  };
   

  useEffect(() => {
    loadDailyQuote();
  }, []);

  // useFocusEffect, not useEffect: profiles.concerns can change in Settings
  // while this tab stays mounted, so it should reflect the latest value
  // whenever the user comes back here, not just on first app launch.
  useFocusEffect(
    useCallback(() => {
      loadActiveConcerns();
    }, [])
  );

  // Right after a fresh signup, show the trial-started welcome once. Not
  // triggered from signup.tsx directly — that would race
  // _layout.tsx's own post-SIGNED_IN navigation to (tabs) and lose. Instead
  // signup.tsx leaves this flag, and it's picked up and cleared here.
  // useFocusEffect, not useEffect: the tab navigator keeps this screen
  // mounted across visits rather than remounting it, so a plain
  // useEffect(..., []) only ever fires once per app session (whenever
  // this tab first happened to mount) — not on the specific occasion
  // right after signup, which is what actually matters here.
  useFocusEffect(
    useCallback(() => {
      const checkPendingWelcome = async () => {
        const stored = await AsyncStorage.getItem('pending_trial_welcome');
        if (!stored) return;
        await AsyncStorage.removeItem('pending_trial_welcome');
        const { plan, trialEnd } = JSON.parse(stored);
        router.push({ pathname: '/trial-started', params: { plan, trialEnd } });
      };
      checkPendingWelcome();
    }, [router])
  );

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
          source={require('../../assets/images/mirror-small.png')}
          style={styles.wreathSmall}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
        <View>
          <Text style={styles.headerTitle}>The Stoic Mirror</Text>
          <Text style={styles.headerSubtitle}>Seek counsel from the philosophers</Text>
        </View>
      </View>

      {/* Main content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        { /* Daily quote */ }
        {dailyQuote && (
          <View style={styles.dailyQuoteBox}>
            <Text style={styles.dailyQuoteLabel}>Today&apos;s reflection</Text>
            <Text style={styles.dailyQuoteText}>
              &ldquo;{dailyQuote.quote}&rdquo;
            </Text>
            <Text style={styles.dailyQuoteAuthor}>— {dailyQuote.author}</Text>
          </View>
        )}
        <Text style={styles.prompt}>What troubles you?</Text>
        <Text style={styles.promptSub}>
          Describe your concern openly. The philosophers will counsel you from their own words.
        </Text>
        {activeConcerns.length > 0 && (
          <Text style={styles.concernNotice}>
            We&apos;ll surface content that matches what you&apos;re working through: {activeConcerns.join(', ')}.
          </Text>
        )}


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
        accessibilityLabel="Describe your concern"
      />
      <TouchableOpacity
        style={[styles.micButton, listening && styles.micButtonActive]}
        onPress={handleMic}
        accessibilityRole="button"
        accessibilityLabel={listening ? 'Stop voice input' : 'Start voice input'}
        accessibilityState={{ selected: listening }}
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
      accessibilityRole="button"
    >
      <Text style={[styles.sendButtonText, !input.trim() && styles.sendButtonTextDisabled]}>
        Seek Counsel
      </Text>
    </TouchableOpacity>
      </ScrollView>

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
  },
  contentContainer: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'flex-start',
    width: '100%',
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
  concernNotice: {
    fontSize: 13,
    color: '#c9b97a',
    lineHeight: 20,
    marginBottom: 24,
    fontStyle: 'italic',
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
  dailyQuoteBox: {
    backgroundColor: '#1e1c18',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2a2720',
    borderLeftWidth: 3,
    borderLeftColor: '#c9b97a',
    alignSelf: 'stretch',
   },
  dailyQuoteLabel: {
    fontSize: 11,
    color: '#c9b97a',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  dailyQuoteText: {
    fontSize: 14,
    color: '#f0ead6',
    lineHeight: 22,
    marginBottom: 10,
  },
  dailyQuoteAuthor: {
    fontSize: 13,
    color: '#a89f88',
    textAlign: 'right',
  },
  showMore: {
    color: '#c9b97a',
    fontStyle: 'normal',
    fontWeight: '600',
  },
});
