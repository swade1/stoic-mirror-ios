import React, { useState, useEffect } from 'react';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Image,
  TextInput,
  ActivityIndicator,
  FlatList,
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
  const [filter, setFilter] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [expandedConcern, setExpandedConcern] = useState(false);
  const scrollRef = React.useRef<ScrollView>(null);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setCurrentIndex(0);
    setExpandedConcern(false);
  }, [searchQuery, filter]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const loadSavedQuotes = async () => {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || cancelled) { setLoading(false); return; }

        const { data } = await supabase
          .from('saved_quotes')
          .select('*, entries(category)')
          .eq('user_id', session.user.id)
          .order('saved_at', { ascending: false });

        if (!cancelled) {
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
        }
      };

      loadSavedQuotes();
      return () => { cancelled = true; };
    }, [])
  );

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
            setCurrentIndex((prev) => Math.max(0, prev - 1));
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

  const getFirstSentence = (text: string) => {
    const match = text.match(/^[^.!?]+[.!?]/);
    return match ? match[0] : text;
  };

  const filteredQuotes = savedQuotes
    .filter((q) => filter === null || q.category === filter)
    .filter((q) => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return (
        q.concern.toLowerCase().includes(query) ||
        q.quote.toLowerCase().includes(query) ||
        q.author.toLowerCase().includes(query) ||
        q.interpretation.toLowerCase().includes(query)
      );
    });

  const currentQuote = filteredQuotes[currentIndex];
  const total = filteredQuotes.length;

  const goNext = () => {
    setCurrentIndex((prev) => Math.min(prev + 1, total - 1));
    setExpandedConcern(false);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const goPrev = () => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
    setExpandedConcern(false);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* Header */}
      <View style={styles.header}>
        <Image
          source={require('../../assets/images/mirror-small.png')}
          style={styles.wreathSmall}
        />
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Saved Wisdom</Text>
          <Text style={styles.headerSubtitle}>Quotes you've chosen to keep</Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            setSearchVisible(!searchVisible);
            setSearchQuery('');
          }}
        >
          <IconSymbol
            name={searchVisible ? 'xmark' : 'magnifyingglass'}
            size={20}
            color="#c9b97a"
          />
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      {searchVisible && (
        <View style={styles.searchContainer}>
          <IconSymbol name="magnifyingglass" size={16} color="#8a7e6e" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search concerns, quotes, authors..."
            placeholderTextColor="#8a7e6e"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <IconSymbol name="xmark.circle.fill" size={16} color="#8a7e6e" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Search results count */}
      {searchVisible && searchQuery.trim().length > 0 && (
        <Text style={styles.searchResults}>
          {filteredQuotes.length} {filteredQuotes.length === 1 ? 'result' : 'results'}
        </Text>
      )}

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
                  onPress={() => {
                    setFilter(cat);
                    setCurrentIndex(0);
                    setExpandedConcern(false);
                  }}
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
                color="#8a7e6e"
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
                    onPress={() => {
                      setFilter(filter === cat ? null : cat);
                      setCurrentIndex(0);
                      setExpandedConcern(false);
                    }}
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

      {loading ? (
        <ActivityIndicator size="large" color="#c9b97a" style={{ marginTop: 60 }} />
      ) : filteredQuotes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <IconSymbol name="bookmark" size={48} color="#6a6050" />
          <Text style={styles.emptyTitle}>No saved wisdom yet</Text>
          <Text style={styles.emptySubtitle}>
            Tap "Save this wisdom" on any quote to add it here
          </Text>
        </View>
      ) : (
        <View style={styles.pageContainer}>

          {/* Page content */}
          <ScrollView
            ref={scrollRef}
            style={styles.pageScroll}
            contentContainerStyle={styles.pageContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Top row — category, date, delete */}
            <View style={styles.pageHeader}>
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryText}>{currentQuote.category}</Text>
              </View>
              <View style={styles.pageHeaderRight}>
                <Text style={styles.date}>{formatDate(currentQuote.saved_at)}</Text>
                <TouchableOpacity
                  onPress={() => deleteQuote(currentQuote.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <IconSymbol name="trash" size={16} color="#c9b97a" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Concern */}
            <View style={styles.concernBox}>
              <View style={styles.sectionLabelRow}>
                <IconSymbol name="person.fill" size={12} color="#8a7e6e" />
                <Text style={styles.concernLabel}>Concern</Text>
              </View>
              <Text style={styles.concernText}>
                {expandedConcern
                  ? currentQuote.concern
                  : getFirstSentence(currentQuote.concern)}
                {!expandedConcern && currentQuote.concern.length > getFirstSentence(currentQuote.concern).length && (
                  <Text
                    style={styles.showMore}
                    onPress={() => setExpandedConcern(true)}
                  > ...Show more</Text>
                )}
              </Text>
            </View>

            {/* Counsel */}
            <View style={styles.counselBox}>
              <View style={styles.sectionLabelRow}>
                <IconSymbol name="lightbulb.fill" size={12} color="#c4b99e" />
                <Text style={styles.counselLabel}>Counsel</Text>
              </View>
              <Text style={styles.counselText}>{currentQuote.interpretation}</Text>
            </View>

            {/* Quote */}
            <View style={styles.quoteBox}>
              <View style={styles.sectionLabelRow}>
                <IconSymbol name="text.quote" size={12} color="#c9b97a" />
                <Text style={styles.quoteLabel}>The Philosophers</Text>
              </View>
              <Text style={styles.quoteText}>"{currentQuote.quote}"</Text>
              <Text style={styles.author}>— {currentQuote.author}</Text>
              <Text style={styles.source}>{currentQuote.source}</Text>
            </View>

            {/* Page dots */}
            <View style={[styles.dotsRow, { justifyContent: 'center', paddingBottom: insets.bottom + 80 }]}>
              {filteredQuotes.slice(
                Math.max(0, currentIndex - 2),
                Math.min(total, currentIndex + 3)
              ).map((_, i) => {
                const actualIndex = Math.max(0, currentIndex - 2) + i;
                return (
                  <View
                    key={actualIndex}
                    style={[
                      styles.dot,
                      actualIndex === currentIndex && styles.dotActive,
                    ]}
                  />
                );
              })}
            </View>
          </ScrollView>

          {/* Fixed left arrow */}
          <TouchableOpacity
            style={[styles.fixedNavLeft, currentIndex === 0 && styles.navButtonDisabled]}
            onPress={goPrev}
            disabled={currentIndex === 0}
          >
            <IconSymbol name="chevron.left" size={16} color={currentIndex === 0 ? '#6a6050' : '#c9b97a'} />
          </TouchableOpacity>

          {/* Fixed right arrow */}
          <TouchableOpacity
            style={[styles.fixedNavRight, currentIndex === total - 1 && styles.navButtonDisabled]}
            onPress={goNext}
            disabled={currentIndex === total - 1}
          >
            <IconSymbol name="chevron.right" size={16} color={currentIndex === total - 1 ? '#6a6050' : '#c9b97a'} />
          </TouchableOpacity>

        </View>
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
  },
  headerText: {
    flex: 1,
  },
  wreathSmall: {
    width: 68,
    height: 68,
    marginRight: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e1c18',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: '#4a4540',
  },
  searchInput: {
    flex: 1,
    color: '#f0ead6',
    fontSize: 15,
  },
  searchResults: {
    fontSize: 12,
    color: '#8a7e6e',
    paddingHorizontal: 28,
    paddingBottom: 4,
  },
  filterBarContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#4a4540',
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    borderColor: '#6a6050',
    backgroundColor: '#1e1c18',
  },
  filterChipActive: {
    backgroundColor: '#c9b97a',
    borderColor: '#c9b97a',
  },
  filterChipText: {
    fontSize: 12,
    color: '#8a7e6e',
    fontWeight: '600',
    letterSpacing: 0.5,
    lineHeight: 16,
  },
  filterChipTextActive: {
    color: '#0f0e0c',
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
    color: '#8a7e6e',
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
    color: '#6a6050',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#6a6050',
    textAlign: 'center',
    lineHeight: 24,
  },
  pageContainer: {
    position: 'relative',
    flex: 1,
  },
  pageScroll: {
    flex: 1,
  },
  pageContent: {
    padding: 24,
    gap: 16,
  },
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  pageHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  date: {
    fontSize: 11,
    color: '#8a7e6e',
  },
  concernBox: {
    backgroundColor: '#1e1c18',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2a2720',
    borderLeftWidth: 3,
    borderLeftColor: '#8a7e6e',
  },
  concernLabel: {
    fontSize: 11,
    color: '#8a7e6e',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  concernText: {
    fontSize: 15,
    color: '#c4b99e',
    lineHeight: 24,
  },
  showMore: {
    fontSize: 15,
    color: '#c9b97a',
    fontWeight: '600',
  },
  counselBox: {
    flex: 1,
    backgroundColor: '#1e1c18',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#4a4540',
    borderLeftWidth: 3,
    borderLeftColor: '#c4b99e',
  },
  counselLabel: {
    fontSize: 11,
    color: '#c4b99e',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  counselText: {
    fontSize: 15,
    color: '#c4b99e',
    lineHeight: 24,
  },
  quoteBox: {
    backgroundColor: '#1e1c18',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2a2720',
    borderLeftWidth: 3,
    borderLeftColor: '#c9b97a',
  },
  quoteLabel: {
    fontSize: 11,
    color: '#c9b97a',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  quoteText: {
    fontSize: 15,
    color: '#f0ead6',
    lineHeight: 24,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  author: {
    fontSize: 13,
    color: '#c9b97a',
    fontWeight: '600',
  },
  source: {
    fontSize: 11,
    color: '#8a7e6e',
    marginTop: 2,
  },
  navButtonDisabled: {
    opacity: 0.3,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#6a6050',
  },
  dotActive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#c9b97a',
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  fixedNavLeft: {
    position: 'absolute',
    left: 4,
    top: '50%',
    transform: [{ translateY: -12 }],
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  fixedNavRight: {
    position: 'absolute',
    right: 4,
    top: '50%',
    transform: [{ translateY: -12 }],
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
});
