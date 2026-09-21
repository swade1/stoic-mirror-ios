import React, { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { IconSymbol } from '@/components/ui/IconSymbol';

interface SavedQuoteRow {
  id: string;
  quote: string;
  author: string;
  saved_at: string;
}

// "From Saved Quotes" — the picker behind that option on a slideshow's Add
// button (app/slideshow-photos.tsx). Picking a row hands off to the quote
// card editor with this slideshow's collectionId attached, which is what
// makes handleSaveToPhotos there add (or, editing an existing slide,
// update) a slideshow_photos row linked back to this saved_quotes row —
// see app/quote-cards.tsx's collectionId/editSlideId params.
export default function SlideshowAddQuoteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { collectionId } = useLocalSearchParams<{ collectionId: string }>();
  const [quotes, setQuotes] = useState<SavedQuoteRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setQuotes([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('saved_quotes')
      .select('id, quote, author, saved_at')
      .eq('user_id', session.user.id)
      .order('saved_at', { ascending: false });
    setQuotes(data ?? []);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back">
          <IconSymbol name="chevron.left" size={16} color="#c9b97a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Choose a Quote</Text>
        <View style={{ width: 16 }} />
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loading} color="#c9b97a" />
      ) : (
        <FlatList
          data={quotes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <IconSymbol name="text.quote" size={40} color="#6a6050" accessibilityElementsHidden importantForAccessibility="no" />
              <Text style={styles.emptyTitle}>No saved quotes yet</Text>
              <Text style={styles.emptySubtitle}>Save a quote from a Seek Counsel session first.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => router.push({ pathname: '/quote-cards', params: { quoteId: item.id, collectionId } })}
              accessibilityRole="button"
              accessibilityLabel={`Use this quote: ${item.quote}`}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowQuote} numberOfLines={3}>&ldquo;{item.quote}&rdquo;</Text>
                <Text style={styles.rowMeta}>— {item.author} · {formatDate(item.saved_at)}</Text>
              </View>
              <IconSymbol name="chevron.right" size={14} color="#8a7e6e" />
            </TouchableOpacity>
          )}
        />
      )}
    </View>
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#f0ead6',
  },
  loading: {
    marginTop: 60,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 10,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 80,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#6a6050',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6a6050',
    textAlign: 'center',
    lineHeight: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1e1c18',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#4a4540',
    padding: 14,
  },
  rowText: {
    flex: 1,
    gap: 4,
  },
  rowQuote: {
    fontSize: 14,
    color: '#f0ead6',
    fontStyle: 'italic',
    lineHeight: 20,
  },
  rowMeta: {
    fontSize: 12,
    color: '#8a7e6e',
  },
});
