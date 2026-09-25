import React, { useState, useEffect, useCallback } from 'react';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { IconButton } from '@/components/ui/IconButton';
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
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { getDailyQuoteId } from '@/lib/dailyQuote';
import { ScaledText } from '@/components/ScaledText';

export default function CounselScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // The tab bar's own screenOptions set tabBarStyle.position: 'absolute'
  // (app/(tabs)/_layout.tsx) — it floats over this screen rather than
  // reserving its own space, so insets.bottom alone doesn't clear it.
  // This is only used to pin the footer line just above it and to keep
  // the scroll content's own bottom padding clear of it — it no longer
  // feeds into the action card's dynamic sizing at all.
  const tabBarHeight = useBottomTabBarHeight();
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

    // index is a 1-indexed position among all rows ordered by id, not a
    // literal id value — the id column isn't guaranteed to be a dense
    // 1..count range (e.g. after rows are deleted and reinserted).
    const { data } = await supabase
      .from('daily_quotes')
      .select('quote, author, source')
      .order('id', { ascending: true })
      .range(index - 1, index - 1)
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

  // Names at most this many concerns directly; beyond that, "+N more" keeps
  // the pill's width bounded regardless of how many of the 14 categories a
  // user selected, without falling back to a generic phrase that would look
  // identical for every user (the whole point of surfacing this line is
  // that it's genuinely specific to them).
  const CONCERN_PILL_LIMIT = 2;
  const concernPillText = activeConcerns.length === 0
    ? null
    : activeConcerns.length <= CONCERN_PILL_LIMIT
    ? `Matching ${activeConcerns.join(', ')}`
    : `Matching ${activeConcerns.slice(0, CONCERN_PILL_LIMIT).join(', ')} +${activeConcerns.length - CONCERN_PILL_LIMIT} more`;

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
        contentContainerStyle={[styles.contentContainer, { paddingBottom: tabBarHeight + 44 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        { /* Daily quote — always mounted (even before it loads) so the
             action card below doesn't grow to fill its spot and then
             snap back down once the quote arrives. */ }
        <View style={styles.dailyQuoteBox}>
          <Text style={styles.dailyQuoteLabel}>Today&apos;s reflection</Text>
          {dailyQuote ? (
            <>
              <ScaledText style={styles.dailyQuoteText}>
                &ldquo;{dailyQuote.quote}&rdquo;
              </ScaledText>
              <ScaledText style={styles.dailyQuoteAuthor}>— {dailyQuote.author}</ScaledText>
            </>
          ) : (
            <View style={styles.dailyQuotePlaceholderLine} />
          )}
        </View>
        <View style={styles.introZone}>
          <Text style={styles.prompt}>What troubles you?</Text>
          <Text style={styles.promptSub}>
            Describe your concern openly. The philosophers will counsel you from their own words.
          </Text>
        </View>

        <View style={styles.actionCard}>
          {concernPillText && (
            <View style={styles.concernPill}>
              <Text style={styles.concernPillText}>{concernPillText}</Text>
            </View>
          )}

          <View style={styles.micWrap}>
            <IconButton
              style={[styles.largeMicButton, listening && styles.micButtonActive]}
              onPress={handleMic}
              accessibilityRole="button"
              accessibilityLabel={listening ? 'Stop voice input' : 'Start voice input'}
              accessibilityState={{ selected: listening }}
            >
              <IconSymbol
                name={listening ? 'stop.fill' : 'mic.fill'}
                size={32}
                color={listening ? '#0f0e0c' : '#c9b97a'}
              />
            </IconButton>
            <Text style={styles.micCaption}>Tap to speak</Text>
          </View>

          <TextInput
            style={styles.textInput}
            placeholder="Or describe it here..."
            placeholderTextColor="#8a7e6e"
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={2000}
            textAlignVertical="top"
            accessibilityLabel="Describe your concern"
          />

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
        </View>
      </ScrollView>

      {!keyboardVisible && (
        <View style={[styles.footer, { bottom: tabBarHeight + 10 }]}>
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
    paddingHorizontal: 24,
    paddingTop: 24,
    justifyContent: 'flex-start',
    width: '100%',
  },
  introZone: {
    marginBottom: 8,
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
  },
  // Contains the mic, text field, and Seek Counsel button as one unit —
  // same treatment as dailyQuoteBox, so the "act" part of the screen reads
  // as a single contained card instead of independently floating pieces.
  //
  // flex: 1 (inside contentContainer's flexGrow: 1 below) plus
  // justifyContent: 'space-between' is what makes this card absorb
  // whatever room a longer daily quote leaves it, rather than the quote
  // pushing the card — and the Seek Counsel button — down the screen.
  // gap is a floor under that, not the driver: when there's little room
  // (a 3-line quote, or the keyboard open) the card shrinks toward gap's
  // minimum instead of collapsing further, and content taller than that
  // floor still just scrolls, via the ScrollView it already sits in.
  actionCard: {
    backgroundColor: '#1e1c18',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#4a4540',
    padding: 20,
    marginBottom: 24,
    alignItems: 'stretch',
    justifyContent: 'space-between',
    gap: 10,
    flex: 1,
  },
  concernPill: {
    alignSelf: 'center',
    backgroundColor: '#c9b97a',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    maxWidth: '100%',
  },
  concernPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0f0e0c',
    letterSpacing: 0.2,
  },
  // Recessed relative to actionCard's own surface (page background instead
  // of the card's own #1e1c18), so the field reads as set *into* the card
  // rather than blending into it.
  textInput: {
    backgroundColor: '#0f0e0c',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    color: '#f0ead6',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#4a4540',
    minHeight: 70,
    maxHeight: 130,
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
  // Pinned at a fixed spot just above the (absolutely-positioned, floating)
  // tab bar, via the inline `bottom` set from tabBarHeight above — no
  // longer a flex sibling of the ScrollView, so it can't compete with the
  // action card for space or drift out of sync with it.
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 24,
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
  micWrap: {
    alignItems: 'center',
    gap: 6,
  },
  // Reduced from the original 96px — still the largest circular element on
  // the card and the clearest "primary" affordance, but no longer sized to
  // dominate the whole screen the way it did floating on its own.
  largeMicButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#2a2720',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#c9b97a',
  },
  micButtonActive: {
    backgroundColor: '#c9b97a',
  },
  micCaption: {
    fontSize: 12,
    color: '#8a7e6e',
    letterSpacing: 0.2,
  },
  dailyQuoteBox: {
    backgroundColor: '#1e1c18',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
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
    lineHeight: 18,
    marginBottom: 0,
  },
  dailyQuoteAuthor: {
    fontSize: 13,
    color: '#a89f88',
    textAlign: 'right',
  },
  // Roughly matches a loaded quote's height (label + a couple of text
  // lines + author line) so the box doesn't visibly jump size once the
  // real quote arrives.
  dailyQuotePlaceholderLine: {
    height: 44,
    borderRadius: 6,
    backgroundColor: '#2a2720',
  },
  showMore: {
    color: '#c9b97a',
    fontStyle: 'normal',
    fontWeight: '600',
  },
});
