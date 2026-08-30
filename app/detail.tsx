import React, { useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Animated } from 'react-native';

interface Quote {
  id: string;
  quote: string;
  author: string;
  source: string;
  interpretation: string;
}

interface Entry {
  id: string;
  concern: string;
  category: string;
  created_at: string;
}

export default function ResultsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [entry, setEntry] = useState<Entry | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState<string[]>([]);
  const [sessionSaved, setSessionSaved] = useState(false);

  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const saveAnims = React.useRef<{[key: string]: Animated.Value}>({}).current;

  const getSaveAnim = (id: string) => {
    if (!saveAnims[id]) {
      saveAnims[id] = new Animated.Value(1);
    }
    return saveAnims[id];
  };

  React.useEffect(() => {
    if (quotes.length === 0) return;
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, [quotes]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      setEntry(null);
      setQuotes([]);
      setSaved([]);
      if (id) {
        loadResults(id);
      } else {
        loadMostRecent();
      }
    }, [id])
  );

  const loadMostRecent = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }

    const { data } = await supabase
      .from('entries')
      .select('id')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (data) {
      loadResults(data.id);
    } else {
      setLoading(false);
    }
  };

  const loadResults = async (entryId: string) => {
    try {
      const { data: entryData } = await supabase
        .from('entries')
        .select('*')
        .eq('id', entryId)
        .single();

      const { data: quotesData } = await supabase
        .from('entry_quotes')
        .select('*')
        .eq('entry_id', entryId)
        .order('created_at', { ascending: true });

      const { data: savedData } = await supabase
        .from('saved_quotes')
        .select('quote')
        .eq('entry_id', entryId);

      if (entryData) setEntry(entryData);
      if (quotesData) setQuotes(quotesData);
      if (savedData && quotesData) {
        const savedQuoteTexts = savedData.map((s) => s.quote);
        const alreadySaved = quotesData
          .filter((q) => savedQuoteTexts.includes(q.quote))
          .map((q) => q.id);
        setSaved(alreadySaved);
      }
    } catch (error) {
      console.error('Failed to load results:', error);
    } finally {
      setLoading(false);
      setSessionSaved(true);
      setTimeout(() => setSessionSaved(false), 3000);
    }
  };
  
  const toggleSave = async (quote: Quote) => {
    const isSaved = saved.includes(quote.id);
    
    // Bounce animation
    const anim = getSaveAnim(quote.id);
    Animated.sequence([
      Animated.timing(anim, { toValue: 2.0, duration: 150, useNativeDriver: true }),
      Animated.spring(anim, { toValue: 1, useNativeDriver: true }),
    ]).start();

    if (isSaved) {
      const { error } = await supabase
        .from('saved_quotes')
        .delete()
        .eq('entry_id', entry?.id)
        .eq('quote', quote.quote);
      if (!error || error.code === '23505') {
       // Success or duplicate (already saved) — both are fine
       setSaved((prev) => [...prev, quote.id]);
     }
      setSaved((prev) => prev.filter((savedId) => savedId !== quote.id));
    } else {
      const session = (await supabase.auth.getSession()).data.session;
      
      const { error } = await supabase.from('saved_quotes').insert({
        user_id: session?.user.id,
        entry_id: entry?.id,
        quote: quote.quote,
        author: quote.author,
        source: quote.source,
        interpretation: quote.interpretation,
        concern: entry?.concern,
      });
      setSaved((prev) => [...prev, quote.id]);
    }
  };

  const saveAll = async () => {
    const unsaved = quotes.filter((q) => !saved.includes(q.id));
    if (unsaved.length === 0) return;

    const session = (await supabase.auth.getSession()).data.session;
    if (!session) return;

    const rows = unsaved.map((q) => ({
      user_id: session.user.id,
      entry_id: entry?.id,
      quote: q.quote,
      author: q.author,
      source: q.source,
      interpretation: q.interpretation,
      concern: entry?.concern,
    }));

    await supabase.from('saved_quotes').upsert(rows, { onConflict: 'user_id,quote' });
    setSaved(quotes.map((q) => q.id));
  };


  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };
  if (loading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#c9b97a" />
      </View>
    );
  }

  if (!entry) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <IconSymbol name="scroll.fill" size={48} color="#6a6050" />
        <Text style={styles.emptyTitle}>No results yet</Text>
        <Text style={styles.emptySubtitle}>
          Seek counsel from the Counsel tab and your wisdom will appear here
        </Text>
      </View>
    );
  }


return (
    <View style={[styles.outerContainer, { paddingTop: insets.top }]}>

      {/* Fixed header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Received Wisdom</Text>
        <Text style={styles.headerSubtitle}>{entry.category}</Text>
        {sessionSaved && (
          <View style={styles.savedIndicator}>
            <IconSymbol name="checkmark.circle.fill" size={14} color="#4caf50" />
            <Text style={styles.savedIndicatorText}>Session saved</Text>
          </View>
        )}
      </View>

      {/* Scrollable content */}
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 100 },
        ]}
      >
      {/* Concern */}
      <View style={styles.concernBox}>
        <Text style={styles.concernLabel}>Your concern</Text>
        <Text style={styles.concernText}>{entry.concern}</Text>
        {true && (
          <Text style={styles.savePrompt}>
            Save at least one quote to revisit this counsel in History.
          </Text>
        )}
      </View>
        {/* Divider */}
        <View style={styles.divider} />

          {/* Quotes */}
          <Animated.View style={{ opacity: fadeAnim }}>
             {quotes.map((quote, index) => (
               <View
                 key={quote.id}
                 style={styles.quoteCard}
               >
            <Text style={styles.quoteNumber}>
              {index + 1} of {quotes.length}
            </Text>
            <Text style={styles.quoteText}>"{quote.quote}"</Text>
            <View style={styles.attribution}>
              <Text style={styles.author}>{quote.author}</Text>
              <Text style={styles.source}>{quote.source}</Text>
            </View>
            <View style={styles.interpretationBox}>
              <Text style={styles.interpretationLabel}>Counsel</Text>
              <Text style={styles.interpretationText}>{quote.interpretation}</Text>
            </View>
            <TouchableOpacity
              style={[styles.saveButton, saved.includes(quote.id) && styles.saveButtonActive]}
              onPress={() => toggleSave(quote)}
            >
              <Animated.View style={{ transform: [{ scale: getSaveAnim(quote.id) }] }}>
              <IconSymbol
                name={saved.includes(quote.id) ? 'bookmark.fill' : 'bookmark'}
                size={16}
                color={saved.includes(quote.id) ? '#0f0e0c' : '#c9b97a'}
              />
              </Animated.View>
              <Text style={[
                styles.saveButtonText,
                saved.includes(quote.id) && styles.saveButtonTextActive,
              ]}>
                {saved.includes(quote.id) ? 'Saved' : 'Save this wisdom'}
              </Text>
            </TouchableOpacity>
          </View>
        ))}
       </Animated.View>

        {/* Bottom Actions */}
        <View style={styles.bottomActions}>
          <TouchableOpacity
          style={styles.saveAllButton}
          onPress={saveAll}
        >
          <IconSymbol name="bookmark.fill" size={14} color="#0f0e0c" />
          <Text style={styles.saveAllButtonText}>Save all</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.doneButton}
          onPress={() => router.replace('/(tabs)/history')}
        >
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#0f0e0c',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2720',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f0ead6',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#c9b97a',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  container: {
    flex: 1,
    backgroundColor: '#0f0e0c',
  },
  content: {
    padding: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f0e0c',
    gap: 16,
  },
  category: {
    fontSize: 11,
    color: '#c9b97a',
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  date: {
    fontSize: 11,
    color: '#8a7e6e',
  },
  concernBox: {
    backgroundColor: '#1e1c18',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#2a2720',
  },
  concernLabel: {
    fontSize: 11,
    color: '#8a7e6e',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  concernText: {
    fontSize: 16,
    color: '#c4b99e',
    lineHeight: 24,
  },
  divider: {
    height: 1,
    backgroundColor: '#2a2720',
    marginBottom: 24,
  },
  quoteCard: {
    backgroundColor: '#1e1c18',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2a2720',
    borderLeftWidth: 3,
    borderLeftColor: '#c9b97a',
  },
  quoteNumber: {
    fontSize: 11,
    color: '#8a7e6e',
    letterSpacing: 1,
    marginBottom: 12,
  },
  quoteText: {
    fontSize: 16,
    color: '#f0ead6',
    lineHeight: 26,
    fontStyle: 'italic',
    marginBottom: 16,
  },
  attribution: {
    marginBottom: 16,
  },
  author: {
    fontSize: 14,
    color: '#c9b97a',
    fontWeight: '600',
  },
  source: {
    fontSize: 12,
    color: '#8a7e6e',
    marginTop: 2,
  },
  interpretationBox: {
    backgroundColor: '#0f0e0c',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  interpretationLabel: {
    fontSize: 11,
    color: '#8a7e6e',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  interpretationText: {
    fontSize: 14,
    color: '#c4b99e',
    lineHeight: 22,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#c9b97a',
  },
  saveButtonActive: {
    backgroundColor: '#c9b97a',
  },
  saveButtonText: {
    fontSize: 13,
    color: '#c9b97a',
    fontWeight: '600',
  },
  saveButtonTextActive: {
    color: '#0f0e0c',
  },
  againButton: {
    marginTop: 8,
    paddingVertical: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#6a6050',
    alignItems: 'center',
  },
  againButtonText: {
    fontSize: 16,
    color: '#8a7e6e',
    letterSpacing: 1,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#6a6050',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#6a6050',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 32,
  },
  savedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  savedIndicatorText: {
    fontSize: 12,
    color: '#4caf50',
  },
  bottomActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  saveAllButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 20,
    backgroundColor: '#c9b97a',
  },
  saveAllButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f0e0c',
  },
  doneButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#c9b97a',
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: 16,
    color: '#c9b97a',
    letterSpacing: 1,
  },
  savePrompt: {
    fontSize: 12,
    color: '#c9b97a',
    marginTop: 10,
    fontStyle: 'italic',
  },
});
