import React, { useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { IconSymbol } from '@/components/ui/IconSymbol';

interface SavedQuote {
  id: string;
  quote: string;
  author: string;
  source: string;
  interpretation: string;
  concern: string;
  saved_at: string;
  category: string;
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const [savedQuotes, setSavedQuotes] = useState<SavedQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadSavedQuotes();
    }, [])
  );

  const loadSavedQuotes = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data } = await supabase
      .from('saved_quotes')
      .select('*, entries(category)')
      .eq('user_id', session.user.id)
      .order('saved_at', { ascending: false });

    if (data) {
      const withCategory = data.map((q: any) => ({
        ...q,
        category: q.entries?.category ?? 'General',
      }));
      setSavedQuotes(withCategory);
      const unique = [...new Set(withCategory.map((q: SavedQuote) => q.category))].sort() as string[];
      setCategories(unique);
    }
    setLoading(false);
  };

  const deleteQuote = async (id: string) => {
    Alert.alert(
      'Remove from History',
      'Are you sure you want to remove this quote?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await supabase.from('saved_quotes').delete().eq('id', id);
            setSavedQuotes((prev) => prev.filter((q) => q.id !== id));
          },
        },
      ]
    );
  };


  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const filteredQuotes = filter
    ? savedQuotes.filter((q) => q.category === filter)
    : savedQuotes;

  const [showAllCategories, setShowAllCategories] = useState(false);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Saved Wisdom</Text>
          <Text style={styles.headerSubtitle}>Quotes you've chosen to keep</Text>
        </View>
      </View>
      {loading ? null : savedQuotes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <IconSymbol name="bookmark" size={48} color="#3a3730" />
          <Text style={styles.emptyTitle}>No saved wisdom yet</Text>
          <Text style={styles.emptySubtitle}>
            Tap "Save this wisdom" on any quote to add it here
          </Text>
        </View>
      ) : (
        <>
          {/* Category filter bar */}
            {categories.length > 0 && (
            <View style={styles.filterBarContainer}>
              <View style={styles.filterBar}>
                {[null, ...categories].slice(0, 6).map((cat) => {
                 const count = cat === null
                   ? savedQuotes.length
                   : savedQuotes.filter((q) => q.category === cat).length;
                 return (
                   <TouchableOpacity
                     key={cat ?? 'all'}
                     style={[styles.filterChip, filter === cat && styles.filterChipActive]}
                     onPress={() => setFilter(cat)}
                   >
                     <Text style={[styles.filterChipText, filter === cat && styles.filterChipTextActive]}>
                       {cat ?? 'All'} ({count})
                     </Text>
                   </TouchableOpacity>
                 );
               })}
              </View>
              {categories.length > 5 && (
                <TouchableOpacity
                  style={styles.showMoreButton}
                  onPress={() => setShowAllCategories(!showAllCategories)}
                >
                  <Text style={styles.showMoreText}>
                    {showAllCategories ? 'Show less' : `${categories.length - 5} more`}
                  </Text>
                  <IconSymbol
                    name={showAllCategories ? 'chevron.up' : 'chevron.down'}
                    size={12}
                    color="#5a5446"
                  />
                </TouchableOpacity>
              )}
              {showAllCategories && (
                <View style={[styles.filterBar, { marginTop: 8 }]}>
                  {categories.slice(5).map((cat) => {
                   const count = savedQuotes.filter((q) => q.category === cat).length;
                   return (
                     <TouchableOpacity
                       key={cat}
                       style={[styles.filterChip, filter === cat && styles.filterChipActive]}
                       onPress={() => setFilter(filter === cat ? null : cat)}
                     >
                       <Text style={[styles.filterChipText, filter === cat && styles.filterChipTextActive]}>
                         {cat} ({count})
                       </Text>
                     </TouchableOpacity>
                   );
                 })}
                </View>
              )}
            </View>
          )}

          {/* Quotes list */}
          <FlatList
            data={filteredQuotes}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyTitle}>No saved wisdom in this category</Text>
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.quoteCard}
                onPress={() => setExpanded(expanded === item.id ? null : item.id)}
                activeOpacity={0.8}
              >
                {/* Top row — category and date */}
                <View style={styles.cardHeader}>
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryText}>{item.category}</Text>
                  </View>
                  <View style={styles.cardHeaderRight}>
                    <Text style={styles.date}>{formatDate(item.saved_at)}</Text>
                    <TouchableOpacity
                      onPress={() => deleteQuote(item.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <IconSymbol name="trash" size={14} color="#c9b97a" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Quote */}
                <Text
                  style={styles.quoteText}
                  numberOfLines={expanded === item.id ? undefined : 3}
                >
                  "{item.quote}"
                </Text>

                {/* Author and source at bottom of quote */}
                <View style={styles.attribution}>
                  <Text style={styles.author}>— {item.author}</Text>
                  <Text style={styles.source}>{item.source}</Text>
                </View>

                {/* Expanded content */}
                {expanded === item.id && (
                  <>
                    {item.interpretation && (
                      <View style={styles.interpretationBox}>
                        <Text style={styles.interpretationLabel}>Counsel</Text>
                        <Text style={styles.interpretationText}>{item.interpretation}</Text>
                      </View>
                    )}
                    {item.concern && (
                      <View style={styles.concernBox}>
                        <Text style={styles.concernLabel}>Original concern</Text>
                        <Text style={styles.concernText}>{item.concern}</Text>
                      </View>
                    )}
                  </>
                )}

                {/* Expand indicator */}
                <View style={styles.expandRow}>
                  <IconSymbol
                    name={expanded === item.id ? 'chevron.up' : 'chevron.down'}
                    size={12}
                    color="#5a5446"
                  />
                </View>
              </TouchableOpacity>
            )}
          />
        </>
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
    justifyContent: 'space-between',
    alignItems: 'center',
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
  },
  signOutText: {
    fontSize: 14,
    color: '#5a5446',
  },
  filterBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3a3730',
    backgroundColor: '#1e1c18',
  },
  filterChipActive: {
    backgroundColor: '#c9b97a',
    borderColor: '#c9b97a',
  },
  filterChipText: {
    fontSize: 12,
    color: '#5a5446',
    fontWeight: '600',
    letterSpacing: 0.5,
    lineHeight: 16,
  },
  filterChipTextActive: {
    color: '#0f0e0c',
  },
  listContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 80,
    paddingHorizontal: 32,
    gap: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3a3730',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#3a3730',
    textAlign: 'center',
    lineHeight: 24,
  },
  quoteCard: {
    backgroundColor: '#1e1c18',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2720',
    borderLeftWidth: 3,
    borderLeftColor: '#c9b97a',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  categoryBadge: {
    backgroundColor: '#2a2720',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  categoryText: {
    fontSize: 10,
    color: '#c9b97a',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  date: {
    fontSize: 11,
    color: '#5a5446',
  },
  quoteText: {
    fontSize: 15,
    color: '#f0ead6',
    lineHeight: 24,
    fontStyle: 'italic',
    marginBottom: 10,
  },
  attribution: {
    marginBottom: 8,
  },
  author: {
    fontSize: 13,
    color: '#c9b97a',
    fontWeight: '600',
  },
  source: {
    fontSize: 11,
    color: '#5a5446',
    marginTop: 2,
  },
  interpretationBox: {
    backgroundColor: '#0f0e0c',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    marginBottom: 8,
  },
  interpretationLabel: {
    fontSize: 11,
    color: '#5a5446',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  interpretationText: {
    fontSize: 14,
    color: '#a89f88',
    lineHeight: 22,
  },
  concernBox: {
    backgroundColor: '#0f0e0c',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  concernLabel: {
    fontSize: 11,
    color: '#5a5446',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  concernText: {
    fontSize: 13,
    color: '#5a5446',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  expandRow: {
    alignItems: 'center',
    marginTop: 4,
  },
  filterBarContainer: {
    borderBottomWidth: 1, 
    borderBottomColor: '#2a2720',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  showMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    paddingVertical: 4,
  },
  showMoreText: {
    fontSize: 12,
    color: '#5a5446',
  },
});
