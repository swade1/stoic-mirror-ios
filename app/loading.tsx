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

const ANTHROPIC_API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
console.log('API KEY:', ANTHROPIC_API_KEY ? 'found' : 'missing');
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const VOYAGE_API_KEY = process.env.EXPO_PUBLIC_VOYAGE_API_KEY;

const CATEGORIES = [
  'Self-Doubt', 'Anger', 'Grief & Loss', 'Fear & Anxiety',
  'Motivation & Discipline', 'Relationships', 'Purpose & Meaning',
  'Mortality', 'Resilience', 'Envy & Comparison',
  'Control & Acceptance', 'Pride & Ego', 'General',
];

// A cost/abuse safety net, not a product limit — no real person doing
// genuine daily reflection would ever approach this. Checked before any
// paid Voyage/Claude calls, so a request over the limit costs nothing.
const DAILY_REQUEST_LIMIT = 40;


const SYSTEM_PROMPT = `You are a Stoic philosophy scholar. Given a person's concern and verified passages from Marcus Aurelius, Epictetus, and Seneca, select 3-5 most relevant passages and add a personal 2-sentence interpretation for each. Return ONLY valid JSON using EXACTLY one of the category strings listed:
{"quotes":[{"quote":"exact text","author":"name","source":"work","interpretation":"your counsel"}],"category":"one of: ${CATEGORIES.join(', ')}"}
The category value MUST be copied exactly as written above — do not reorder, abbreviate, or modify the category string.`;



interface Quote {
  quote: string;
  author: string;
  source: string;
  interpretation: string;
}

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

      // Step 1a: Daily rate limit, checked before any paid API calls
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const { count: todaysCount } = await supabase
        .from('entries')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', startOfToday.toISOString());
      if ((todaysCount ?? 0) >= DAILY_REQUEST_LIMIT) {
        throw new Error(
          `You've reached today's limit of ${DAILY_REQUEST_LIMIT} reflections. Please try again tomorrow.`
        );
      }

      // Step 1b: Load the user's standing concerns, for extra context
      const { data: profile } = await supabase
        .from('profiles')
        .select('concerns')
        .eq('id', user.id)
        .single();
      const userConcerns: string[] = profile?.concerns ?? [];

      // Passages already shown to this user, so retrieval can favor fresh material
      const { data: shownQuotes } = await supabase
        .from('entry_quotes')
        .select('passage_id')
        .eq('user_id', user.id)
        .not('passage_id', 'is', null);
      const excludePassageIds: string[] = [...new Set((shownQuotes ?? []).map((r) => r.passage_id as string))];

      // Step 2: Embed the concern via Voyage AI
      const embedRes = await fetch('https://api.voyageai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${VOYAGE_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'voyage-4',
          input: [`Stoic philosophy advice needed: ${concern}`],
          output_dimension: 1024,
        }),
      });
      if (!embedRes.ok) {
        const errText = await embedRes.text();
        throw new Error(`Embedding failed: ${embedRes.status} ${errText}`);
      }
      const embedData = await embedRes.json();
      const embedding = embedData.data[0].embedding;
      console.log('Embedding success, length:', embedding?.length);

      // Step 3: Retrieve relevant passages from Supabase
      const matchRes = await fetch(
        `${SUPABASE_URL}/rest/v1/rpc/match_stoic_passages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY!,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            query_embedding: embedding,
            match_count: 10,
            match_threshold: 0.1,
            exclude_ids: excludePassageIds,
            boost_concerns: userConcerns,
          }),
        }
      );
      if (!matchRes.ok) throw new Error('Passage retrieval failed');
      const passages = await matchRes.json();
      console.log('Passages found:', passages?.length);

      if (!passages.length) {
        const retryRes = await fetch(
          `${SUPABASE_URL}/rest/v1/rpc/match_stoic_passages`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': SUPABASE_ANON_KEY!,
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
              query_embedding: embedding,
              match_count: 10,
              match_threshold: 0.1,
              exclude_ids: excludePassageIds,
              boost_concerns: userConcerns,
            }),
          }
        );
        const retryPassages = await retryRes.json();
        if (!retryPassages.length) throw new Error('No relevant passages found');
        passages.push(...retryPassages);
      }

      // Step 4: Format passages as context
      const passageContext = passages
        .map((p: any, i: number) => {
          const source = p.section ? `${p.work}, ${p.section}` : p.work;
          return `[${i + 1}] ${p.author} — ${source}\n"${p.passage}"`;
        })
        .join('\n\n');

      const concernContext = userConcerns.length
        ? `\n\nFor background, this person has told us their ongoing concerns include: ${userConcerns.join(', ')}. Let this inform your interpretation where relevant, but prioritize what they've actually written above.`
        : '';

      const userMessage = `The person's concern:\n"${concern}"\n\nAvailable passages:\n\n${passageContext}${concernContext}`;

      // Step 5: Ask Claude to select and interpret
      const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userMessage }],
        }),
      });
      if (!claudeRes.ok) throw new Error('Claude API failed');
      const claudeData = await claudeRes.json();
      const content = claudeData.content.find((b: any) => b.type === 'text')?.text;
      console.log('Claude content:', content?.slice(0, 100));
      if (!content) throw new Error('Empty response from Claude');

      const clean = content
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      const parsed = JSON.parse(clean);
      const quotes: Quote[] = parsed.quotes.slice(0, 5);
      const category: string = parsed.category || 'General';

      // Step 6: Save to database
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

      const quoteRows = quotes.map((q) => {
        // Match Claude's returned quote back to the passage it came from,
        // from this same request's candidate list, so we can exclude it
        // from future retrieval for this user.
        const sourcePassage = passages.find((p: any) => p.passage === q.quote);
        // If this passage was tagged for one of the user's standing
        // concerns, snapshot which one — drives the honest framing lead-in
        // in detail.tsx/history.tsx without needing to join back to
        // stoic_passages (whose tags may be re-tuned later).
        const matchedConcern: string | null =
          sourcePassage?.concern_tags?.find((t: string) => userConcerns.includes(t)) ?? null;
        return {
          entry_id: entry.id,
          user_id: user.id,
          passage_id: sourcePassage?.id ?? null,
          quote: q.quote,
          author: q.author,
          source: q.source,
          interpretation: q.interpretation,
          matched_concern: matchedConcern,
        };
      });

      await supabase.from('entry_quotes').insert(quoteRows);

      // Navigate to results with entry id
      router.replace(`/detail?id=${entry.id}`);

    } catch (error) {
      if (isNetworkError(error)) {
        Alert.alert(
          'No Connection',
          "The Stoic Mirror needs an internet connection to seek counsel. Check your connection and try again."
        );
      } else {
        Alert.alert('Error', (error as Error).message);
      }
      router.replace('/(tabs)');
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
