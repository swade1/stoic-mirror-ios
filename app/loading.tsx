import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { isNetworkError } from '@/lib/networkError';
import { requestCounsel, NO_PASSAGES_MESSAGE } from '@/lib/counselClient';

const LOADING_PHRASES = [
  'Consulting the philosophers...',
  'Searching the Meditations...',
  'Seeking wisdom from Epictetus...',
  'Reading the works of Seneca...',
  'Reflecting on your concern...',
];

export default function LoadingScreen() {
  const router = useRouter();
  const { prompt } = useLocalSearchParams<{ prompt: string }>();
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [charIndex, setCharIndex] = useState(0);

  // Cycle to next phrase when current one finishes typing
  useEffect(() => {
    if (charIndex >= LOADING_PHRASES[phraseIndex].length) {
      const pause = setTimeout(() => {
        setPhraseIndex((prev) => (prev + 1) % LOADING_PHRASES.length);
        setCharIndex(0);
        setDisplayedText('');
      }, 1000);
      return () => clearTimeout(pause);
    }
  }, [charIndex, phraseIndex]);

  // Type one character at a time
  useEffect(() => {
    if (charIndex < LOADING_PHRASES[phraseIndex].length) {
      const timer = setTimeout(() => {
        setDisplayedText((prev) => prev + LOADING_PHRASES[phraseIndex][charIndex]);
        setCharIndex((prev) => prev + 1);
      }, 45);
      return () => clearTimeout(timer);
    }
  }, [charIndex, phraseIndex]);

  useEffect(() => {
    if (!prompt) return;
    seekCounsel(prompt);
  }, [prompt]);

  const seekCounsel = async (concern: string) => {
    try {
      // Step 1: Get the current user — every account is authenticated now
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not signed in');
      const user = session.user;

      // Step 2: Ask the seek-counsel Edge Function. It holds the Voyage and
      // Anthropic keys, enforces rate limits, retrieves passages and asks
      // Claude — none of that happens on the phone.
      const { quotes, category } = await requestCounsel(concern);

      // Step 3: Save to database. The concern is encrypted on the phone, so
      // the server never stores it.
      const { encryptConcern } = await import('@/lib/encryption');
      const encryptedConcern = await encryptConcern(concern, user.id);

      const { data: entry, error: entryError } = await supabase
        .from('entries')
        .insert({
          user_id: user.id,
          concern: encryptedConcern,
          category,
        })
        .select()
        .single();

      if (entryError) throw entryError;

      const quoteRows = quotes.map((q) => ({
        entry_id: entry.id,
        user_id: user.id,
        passage_id: q.passage_id,
        quote: q.quote,
        author: q.author,
        source: q.source,
        interpretation: q.interpretation,
        matched_concern: q.matched_concern,
      }));

      await supabase.from('entry_quotes').insert(quoteRows);

      // Navigate to results with entry id
      router.replace(`/detail?id=${entry.id}`);

    } catch (error) {
      if (isNetworkError(error)) {
        Alert.alert(
          'No Connection',
          "The Stoic Mirror needs an internet connection to seek counsel. Check your connection and try again."
        );
        router.replace('/(tabs)');
      } else if ((error as Error).message === NO_PASSAGES_MESSAGE) {
        // Every passage above the similarity threshold for this concern has
        // already been shown to this user (match_stoic_passages excludes
        // entry_quotes.passage_id permanently, per user) — a genuine
        // milestone, not a failure, so this gets its own celebratory copy
        // and a real choice of next step instead of the generic error alert.
        Alert.alert(
          "You've Read the Entire Stoa",
          "Every passage we have on this concern is now yours. Marcus, Epictetus, and Seneca have officially run out of new things to say about it — consider building a slideshow of your favorite wisdom on this to revisit daily, or bring them a new concern.",
          [
            {
              text: 'Review My Favorites',
              onPress: () => router.replace({ pathname: '/(tabs)/history', params: { q: concern } }),
            },
            {
              text: 'Not Now',
              style: 'cancel',
              onPress: () => router.replace('/(tabs)'),
            },
          ]
        );
      } else {
        Alert.alert('Error', (error as Error).message);
        router.replace('/(tabs)');
      }
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>The Stoic Mirror</Text>
      <ActivityIndicator size="large" color="#c9b97a" style={styles.spinner} />
      <Text style={styles.phrase}>{displayedText}</Text>
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
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#f0ead6',
    marginBottom: 48,
    letterSpacing: 0.5,
  },
  spinner: {
    marginVertical: 32,
  },
  phrase: {
    fontSize: 16,
    color: '#c9b97a',
    textAlign: 'center',
    fontStyle: 'italic',
    letterSpacing: 0.5,
  },
});
