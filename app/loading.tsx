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

/* const SYSTEM_PROMPT = `You are a scholar of Stoic philosophy providing counsel to someone in need.



You will be given:
1. A person's concern or struggle
2. A set of verified passages from the actual writings of Marcus Aurelius, Epictetus, and Seneca

Your task:
- Select 3 to 5 of the most relevant and emotionally resonant passages
- For each passage, write a 2-3 sentence interpretation explaining how it applies to this person's specific situation. Be warm, direct, and personal.
- Determine the single best category for their concern from this list: ${CATEGORIES.join(', ')}
- Return ONLY valid JSON — no preamble, no commentary, no markdown fences

JSON format:
{
  "quotes": [
    {
      "quote": "exact passage text as provided",
      "author": "author name",
      "source": "work title and section",
      "interpretation": "your personal interpretation for this person"
    }
  ],
  "category": "category string"
}`; */

const SYSTEM_PROMPT = `You are a Stoic philosophy scholar. Given a person's concern and verified passages from Marcus Aurelius, Epictetus, and Seneca, select 3-5 most relevant passages and add a personal 2-sentence interpretation for each. Return ONLY valid JSON:
{"quotes":[{"quote":"exact text","author":"name","source":"work","interpretation":"your counsel"}],"category":"one of: ${CATEGORIES.join(', ')}"}`;

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

  // Cycle through loading phrases
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
      // Step 1: Get current user
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Session:', JSON.stringify(session));
      const user = session?.user ?? { id: 'anonymous' };

      // Step 2: Embed the concern via Anthropic
      const embedRes = await fetch('https://api.voyageai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${VOYAGE_API_KEY}`,
        },
        body: JSON.stringify({
        model: 'voyage-3',
        input: [`Stoic philosophy advice needed: ${concern}`],
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
            match_count: 8,
            match_threshold: 0.1,
          }),
        }
      );

      if (!matchRes.ok) throw new Error('Passage retrieval failed');
      const passages = await matchRes.json();

      console.log('Passages found:', passages?.length);

      if (!passages.length) {
        // Retry with lower threshold
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
              match_count: 8,
              match_threshold: 0.1,
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

      const userMessage = `The person's concern:\n"${concern}"\n\nAvailable passages:\n\n${passageContext}`;

      // Step 5: Ask Claude to select and interpret
      const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userMessage }],
        }),
      });


      if (!claudeRes.ok) throw new Error('Claude API failed');
      const claudeData = await claudeRes.json();
      const content = claudeData.content.find((b: any) => b.type === 'text')?.text;
   
      console.log('Claude content:', content?.slice(0,100));

      if (!content) throw new Error('Empty response from Claude');

      const clean = content
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      const parsed = JSON.parse(clean);
      const quotes: Quote[] = parsed.quotes.slice(0, 5);
      const category: string = parsed.category || 'General';

      // Step 6: Save entry to Supabase
      const { data: entry, error: entryError } = await supabase
        .from('entries')
        .insert({
          user_id: user.id,
          concern,
          category,
        })
        .select()
        .single();

      if (entryError) throw entryError;

      // Step 7: Save quotes
      const quoteRows = quotes.map((q) => ({
        entry_id: entry.id,
        user_id: user.id,
        quote: q.quote,
        author: q.author,
        source: q.source,
        interpretation: q.interpretation,
      }));

      await supabase.from('entry_quotes').insert(quoteRows);

      // Step 8: Navigate to results
      router.replace(`/detail?id=${entry.id}`);

    } catch (error) {
      Alert.alert('Error', (error as Error).message);
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
