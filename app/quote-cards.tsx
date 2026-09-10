import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  useWindowDimensions,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { supabase } from '@/lib/supabase';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { listQuoteBackgrounds, resolveQuoteBackground, type QuoteBackground } from '@/lib/quoteBackgrounds';

interface SavedQuote {
  id: string;
  quote: string;
  author: string;
  source: string;
  background_photo_id: string | null;
}

export default function QuoteCardsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { quoteId } = useLocalSearchParams<{ quoteId?: string }>();

  const [savedQuotes, setSavedQuotes] = useState<SavedQuote[]>([]);
  const [backgrounds, setBackgrounds] = useState<QuoteBackground[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Tracked per-index, not as a single flag reset on swipe: expo-image's
  // onLoad only fires once per mount, and this ScrollView mounts every
  // card at once (pagingEnabled, not virtualized) — a card whose image
  // finished loading while off-screen would never fire onLoad again once
  // swiped into view, permanently disabling Share for it under a
  // single-boolean scheme.
  const [loadedIndices, setLoadedIndices] = useState<Set<number>>(new Set());
  const [sharing, setSharing] = useState(false);

  const cardRefs = useRef<(View | null)[]>([]);
  const scrollRef = useRef<ScrollView>(null);
  // Set once per load, so the scroll-into-place effect below only fires
  // right after fetching — not on every currentIndex change from normal
  // swiping, which would fight the user's own scroll.
  const [pendingScrollIndex, setPendingScrollIndex] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const load = async () => {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || cancelled) { setLoading(false); return; }

        const [{ data: quotes }, backgroundList] = await Promise.all([
          supabase
            .from('saved_quotes')
            .select('id, quote, author, source, background_photo_id')
            .eq('user_id', session.user.id)
            .order('saved_at', { ascending: false }),
          listQuoteBackgrounds().catch(() => [] as QuoteBackground[]),
        ]);

        if (!cancelled) {
          const loadedQuotes = quotes ?? [];
          setSavedQuotes(loadedQuotes);
          setBackgrounds(backgroundList);
          setLoading(false);

          // Open on whichever quote History was showing when the user
          // tapped in, not always the most recently saved one.
          const matchIndex = quoteId ? loadedQuotes.findIndex((q) => q.id === quoteId) : -1;
          const targetIndex = matchIndex >= 0 ? matchIndex : 0;
          setCurrentIndex(targetIndex);
          setPendingScrollIndex(targetIndex);
        }
      };

      load();
      return () => { cancelled = true; };
    }, [quoteId])
  );

  // Runs after the ScrollView has laid out its (now-known) pages, so the
  // jump lands correctly instead of racing the initial render.
  useEffect(() => {
    if (pendingScrollIndex === null || loading) return;
    const id = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ x: pendingScrollIndex * width, animated: false });
    });
    setPendingScrollIndex(null);
    return () => cancelAnimationFrame(id);
  }, [pendingScrollIndex, loading, width]);

  const currentQuote = savedQuotes[currentIndex];
  const currentBackground = currentQuote
    ? resolveQuoteBackground(backgrounds, currentQuote.background_photo_id)
    : null;
  // Nothing to wait for if this card has no background photo at all
  // (empty bucket) — it's still a valid, shareable plain card.
  const imageReady = !currentBackground || loadedIndices.has(currentIndex);

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / width);
    if (index !== currentIndex) {
      setCurrentIndex(index);
      setPickerOpen(false);
    }
  };

  const chooseBackground = async (background: QuoteBackground) => {
    if (!currentQuote) return;
    setSavedQuotes((prev) =>
      prev.map((q) => (q.id === currentQuote.id ? { ...q, background_photo_id: background.id } : q))
    );
    setLoadedIndices((prev) => {
      const next = new Set(prev);
      next.delete(currentIndex);
      return next;
    });
    setPickerOpen(false);
    await supabase
      .from('saved_quotes')
      .update({ background_photo_id: background.id })
      .eq('id', currentQuote.id);
  };

  const handleShare = async () => {
    const ref = cardRefs.current[currentIndex];
    if (!ref || sharing) return;
    setSharing(true);
    try {
      const uri = await captureRef(ref, { format: 'png', quality: 1 });
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) throw new Error('Sharing is not available on this device');
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share Quote' });
    } catch (err) {
      Alert.alert('Share Failed', err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSharing(false);
    }
  };

  if (loading) {
    return <View style={[styles.container, { paddingTop: insets.top }]} />;
  }

  if (savedQuotes.length === 0) {
    return (
      <View style={[styles.container, styles.emptyContainer, { paddingTop: insets.top }]}>
        <IconSymbol name="text.quote" size={48} color="#6a6050" accessibilityElementsHidden importantForAccessibility="no" />
        <Text style={styles.emptyTitle}>No saved wisdom yet</Text>
        <Text style={styles.emptySubtitle}>
          Save a quote from History to turn it into a card here.
        </Text>
        <TouchableOpacity
          style={styles.backButtonFloating}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back to History"
        >
          <IconSymbol name="chevron.left" size={16} color="#c9b97a" />
          <Text style={styles.backButtonText}>History</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
      >
        {savedQuotes.map((quote, index) => {
          const background = resolveQuoteBackground(backgrounds, quote.background_photo_id);
          return (
            <View
              key={quote.id}
              ref={(el) => { cardRefs.current[index] = el; }}
              style={[styles.card, { width }]}
              collapsable={false}
            >
              {background ? (
                <Image
                  source={{ uri: background.url }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  onLoad={() => setLoadedIndices((prev) => new Set(prev).add(index))}
                />
              ) : (
                <View style={[StyleSheet.absoluteFill, styles.noBackgroundFill]} />
              )}
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.75)']}
                style={styles.scrim}
              />
              <View style={[styles.cardContent, { paddingBottom: insets.bottom + 32 }]}>
                {!background && (
                  <Text style={styles.noBackgroundHint}>
                    No background photos yet — add some to the quote-backgrounds bucket.
                  </Text>
                )}
                <Text style={styles.quoteText}>&ldquo;{quote.quote}&rdquo;</Text>
                <Text style={styles.attribution}>— {quote.author}, {quote.source}</Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <TouchableOpacity
        style={[styles.backButtonFloating, { top: insets.top + 12 }]}
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Back to History"
      >
        <IconSymbol name="chevron.left" size={16} color="#c9b97a" />
        <Text style={styles.backButtonText}>History</Text>
      </TouchableOpacity>

      <View style={[styles.indexBadge, { top: insets.top + 12 }]}>
        <Text style={styles.indexBadgeText}>{currentIndex + 1} of {savedQuotes.length}</Text>
      </View>

      <View style={[styles.actionRow, { bottom: insets.bottom + 32 }]}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => setPickerOpen((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel="Choose background photo"
        >
          <IconSymbol name="photo.on.rectangle" size={18} color="#c9b97a" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, (!imageReady || sharing) && styles.actionButtonDisabled]}
          onPress={handleShare}
          disabled={!imageReady || sharing}
          accessibilityRole="button"
          accessibilityLabel="Share this quote card"
        >
          <IconSymbol name="paperplane.fill" size={18} color={imageReady ? '#c9b97a' : '#6a6050'} />
        </TouchableOpacity>
      </View>

      {pickerOpen && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.pickerStrip, { bottom: insets.bottom + 88 }]}
          contentContainerStyle={styles.pickerStripContent}
        >
          {backgrounds.length === 0 ? (
            <Text style={styles.pickerEmptyText}>No background photos available yet.</Text>
          ) : (
            backgrounds.map((bg) => {
              const selected = currentBackground?.id === bg.id;
              return (
                <TouchableOpacity
                  key={bg.id}
                  onPress={() => chooseBackground(bg)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Background photo ${bg.id}`}
                  style={[styles.thumbnailWrapper, selected && styles.thumbnailSelected]}
                >
                  <Image source={{ uri: bg.url }} style={styles.thumbnail} contentFit="cover" />
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0e0c',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
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
    lineHeight: 22,
  },
  card: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
    backgroundColor: '#0f0e0c',
    overflow: 'hidden',
  },
  noBackgroundFill: {
    backgroundColor: '#1e1c18',
  },
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '55%',
  },
  cardContent: {
    paddingHorizontal: 28,
    gap: 12,
  },
  noBackgroundHint: {
    fontSize: 12,
    color: '#a89f88',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  quoteText: {
    fontSize: 24,
    lineHeight: 34,
    color: '#f0ead6',
    fontStyle: 'italic',
    fontWeight: '600',
  },
  attribution: {
    fontSize: 14,
    color: '#c9b97a',
    letterSpacing: 0.5,
  },
  backButtonFloating: {
    position: 'absolute',
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15,14,12,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  backButtonText: {
    fontSize: 14,
    color: '#c9b97a',
  },
  indexBadge: {
    position: 'absolute',
    right: 16,
    backgroundColor: 'rgba(15,14,12,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  indexBadgeText: {
    fontSize: 12,
    color: '#a89f88',
  },
  actionRow: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(15,14,12,0.7)',
    borderWidth: 1,
    borderColor: '#c9b97a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonDisabled: {
    borderColor: '#4a4540',
  },
  pickerStrip: {
    position: 'absolute',
    left: 0,
    right: 0,
    maxHeight: 76,
  },
  pickerStripContent: {
    paddingHorizontal: 16,
    gap: 10,
    alignItems: 'center',
  },
  pickerEmptyText: {
    fontSize: 13,
    color: '#a89f88',
    fontStyle: 'italic',
  },
  thumbnailWrapper: {
    width: 56,
    height: 56,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbnailSelected: {
    borderColor: '#c9b97a',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
});
