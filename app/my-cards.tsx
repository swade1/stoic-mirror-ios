import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, ActivityIndicator, Alert, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { IconButton } from '@/components/ui/IconButton';
import { listQuoteBackgrounds, resolveQuoteBackground, type QuoteBackground } from '@/lib/quoteBackgrounds';

type TextSource = 'quote' | 'counsel';

interface CardTile {
  key: string;
  quoteId: string;
  textSource: TextSource;
  text: string;
  author: string;
  backgroundPhotoId: string | null;
}

const COLUMN_COUNT = 2;
// Must match styles.grid's paddingHorizontal — the FlatList itself
// reports its full, unpadded outer width via onLayout, but tiles render
// inside that padded content area, so cell sizing needs to account for
// the padding directly rather than measuring after it's applied.
const GRID_HORIZONTAL_PADDING = 12;

export default function MyCardsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const [tiles, setTiles] = useState<CardTile[]>([]);
  const [backgrounds, setBackgrounds] = useState<QuoteBackground[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  // A removal is held for a few seconds before actually clearing the
  // slot's fields, the same undo-window pattern as the slideshow photo
  // grid's Remove action — the tile is already gone from `tiles`
  // (optimistic), this just tracks what to restore (including its
  // original position) if Undo is tapped, and the timer that commits the
  // real clear if it isn't.
  const [pendingRemove, setPendingRemove] = useState<{ tile: CardTile; index: number; timer: ReturnType<typeof setTimeout> } | null>(null);
  const pendingRemoveRef = useRef<typeof pendingRemove>(null);
  useEffect(() => {
    pendingRemoveRef.current = pendingRemove;
  }, [pendingRemove]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setTiles([]);
      setLoading(false);
      return;
    }

    const [{ data, error }, resolvedBackgrounds] = await Promise.all([
      supabase
        .from('saved_quotes')
        .select('id, quote, author, interpretation, background_photo_id, card_text_boxes, counsel_background_photo_id, counsel_card_text_boxes, saved_at')
        .eq('user_id', session.user.id)
        .or('card_text_boxes.not.is.null,counsel_card_text_boxes.not.is.null')
        .order('saved_at', { ascending: false }),
      listQuoteBackgrounds().catch(() => [] as QuoteBackground[]),
    ]);
    setBackgrounds(resolvedBackgrounds);

    if (error || !data) {
      setTiles([]);
      setLoading(false);
      return;
    }

    // One tile per built slot, not per row — a saved quote can have an
    // independent quote-slot card and counsel-slot card (the two-slot
    // architecture in app/quote-cards.tsx), and both should be browsable
    // and separately resumable here.
    const built: CardTile[] = [];
    data.forEach((row) => {
      if (row.card_text_boxes && row.card_text_boxes.length > 0) {
        built.push({
          key: `${row.id}-quote`,
          quoteId: row.id,
          textSource: 'quote',
          text: row.quote,
          author: row.author,
          backgroundPhotoId: row.background_photo_id,
        });
      }
      if (row.counsel_card_text_boxes && row.counsel_card_text_boxes.length > 0) {
        built.push({
          key: `${row.id}-counsel`,
          quoteId: row.id,
          textSource: 'counsel',
          text: row.interpretation,
          author: row.author,
          backgroundPhotoId: row.counsel_background_photo_id,
        });
      }
    });
    setTiles(built);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => {
    load();
    // Leaving the screen mid-undo-window commits the clear right away
    // rather than letting its timer fire later in the background —
    // otherwise coming back before that timer elapses would re-fetch and
    // show the "removed" card still built, since the database update
    // hadn't actually happened yet.
    return () => {
      const pending = pendingRemoveRef.current;
      if (pending) {
        clearTimeout(pending.timer);
        const payload = pending.tile.textSource === 'counsel'
          ? { counsel_background_photo_id: null, counsel_text_color: null, counsel_text_size_scale: null, counsel_text_font: null, counsel_scrim_enabled: null, counsel_card_text_boxes: null }
          : { background_photo_id: null, text_color: null, text_size_scale: null, text_font: null, scrim_enabled: null, card_text_boxes: null };
        supabase.from('saved_quotes').update(payload).eq('id', pending.tile.quoteId);
        setPendingRemove(null);
      }
    };
  }, [load]));

  // How long an accidental removal stays undoable before it actually hits
  // the database — same window as the slideshow photo grid's Remove.
  const UNDO_WINDOW_MS = 5000;

  // Clears just this tile's slot (the six card-styling fields for its
  // textSource) back to null — never deletes the saved_quotes row itself,
  // since the quote/interpretation text is separate saved content the
  // user kept for its own reasons, unrelated to whether a card exists.
  const commitRemoveCard = async (tile: CardTile) => {
    const payload = tile.textSource === 'counsel'
      ? { counsel_background_photo_id: null, counsel_text_color: null, counsel_text_size_scale: null, counsel_text_font: null, counsel_scrim_enabled: null, counsel_card_text_boxes: null }
      : { background_photo_id: null, text_color: null, text_size_scale: null, text_font: null, scrim_enabled: null, card_text_boxes: null };
    const { error } = await supabase.from('saved_quotes').update(payload).eq('id', tile.quoteId);
    if (error) {
      await load();
      Alert.alert('Remove Failed', error.message);
    }
    setPendingRemove((current) => (current?.tile.key === tile.key ? null : current));
  };

  const undoRemoveCard = () => {
    if (!pendingRemove) return;
    clearTimeout(pendingRemove.timer);
    const { tile, index } = pendingRemove;
    setTiles((prev) => {
      const next = [...prev];
      next.splice(Math.min(index, next.length), 0, tile);
      return next;
    });
    setPendingRemove(null);
  };

  const removeCard = (key: string) => {
    const index = tiles.findIndex((t) => t.key === key);
    if (index === -1) return;
    const removed = tiles[index];
    // Optimistic, but not committed yet — see pendingRemove above.
    setTiles((prev) => prev.filter((t) => t.key !== key));
    const timer = setTimeout(() => commitRemoveCard(removed), UNDO_WINDOW_MS);
    setPendingRemove({ tile: removed, index, timer });
  };

  const query = searchQuery.trim().toLowerCase();
  const filteredTiles = query.length === 0
    ? tiles
    : tiles.filter((t) => t.text.toLowerCase().includes(query) || t.author.toLowerCase().includes(query));

  const cellSize = (windowWidth - GRID_HORIZONTAL_PADDING * 2) / COLUMN_COUNT;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <IconButton
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back to History"
        >
          <IconSymbol name="chevron.left" size={16} color="#c9b97a" />
        </IconButton>
        <Text style={styles.headerTitle}>My Cards</Text>
        <View style={styles.headerSpacer} />
      </View>

      {tiles.length > 0 && (
        <View style={styles.searchContainer}>
          <IconSymbol name="magnifyingglass" size={16} color="#8a7e6e" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search your cards..."
            placeholderTextColor="#8a7e6e"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Search your cards"
          />
          {searchQuery.length > 0 && (
            <IconButton
              onPress={() => setSearchQuery('')}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <IconSymbol name="xmark.circle.fill" size={16} color="#8a7e6e" />
            </IconButton>
          )}
        </View>
      )}

      {loading ? (
        <ActivityIndicator style={styles.loading} color="#c9b97a" />
      ) : tiles.length === 0 ? (
        <View style={styles.emptyState}>
          <IconSymbol name="photo.on.rectangle" size={40} color="#6a6050" accessibilityElementsHidden importantForAccessibility="no" />
          <Text style={styles.emptyTitle}>No cards yet</Text>
          <Text style={styles.emptySubtitle}>
            Cards you build from a quote or its counsel will show up here, so you can find and reopen one without remembering which quote it came from.
          </Text>
        </View>
      ) : filteredTiles.length === 0 ? (
        <View style={styles.emptyState}>
          <IconSymbol name="magnifyingglass" size={40} color="#6a6050" accessibilityElementsHidden importantForAccessibility="no" />
          <Text style={styles.emptyTitle}>No matches</Text>
        </View>
      ) : (
        <FlatList
          data={filteredTiles}
          keyExtractor={(item) => item.key}
          numColumns={COLUMN_COUNT}
          contentContainerStyle={styles.grid}
          renderItem={({ item }) => {
            const background = resolveQuoteBackground(backgrounds, item.backgroundPhotoId);
            return (
              <TouchableOpacity
                style={[styles.tileSlot, { width: cellSize }]}
                onPress={() => router.push({
                  pathname: '/quote-cards',
                  params: { quoteId: item.quoteId, textSource: item.textSource, resume: '1', fromGallery: '1' },
                })}
                accessibilityRole="button"
                accessibilityLabel={`Open ${item.textSource === 'counsel' ? 'counsel' : 'quote'} card: ${item.text}`}
              >
                <View style={styles.tile}>
                  {background ? (
                    <Image source={{ uri: background.url }} style={styles.tileImage} contentFit="cover" />
                  ) : (
                    <View style={styles.tileMissing}>
                      <IconSymbol name="photo.on.rectangle" size={22} color="#6a6050" accessibilityElementsHidden importantForAccessibility="no" />
                    </View>
                  )}
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.75)']}
                    style={styles.tileScrim}
                    pointerEvents="none"
                  />
                  <View style={styles.tileBadge}>
                    <Text style={styles.tileBadgeText}>{item.textSource === 'counsel' ? 'Counsel' : 'Quote'}</Text>
                  </View>
                  <IconButton
                    style={styles.tileRemove}
                    onPress={() => removeCard(item.key)}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove this ${item.textSource === 'counsel' ? 'counsel' : 'quote'} card`}
                    hitSlop={8}
                  >
                    <IconSymbol name="xmark.circle.fill" size={20} color="#f0ead6" />
                  </IconButton>
                  <View style={styles.tileTextArea}>
                    <Text style={styles.tileText} numberOfLines={4}>{item.text}</Text>
                    <Text style={styles.tileAuthor} numberOfLines={1}>{item.author}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {pendingRemove && (
        <View style={[styles.undoBanner, { bottom: insets.bottom + 16 }]}>
          <Text style={styles.undoBannerText}>Card removed</Text>
          <TouchableOpacity onPress={undoRemoveCard} accessibilityRole="button" accessibilityLabel="Undo remove">
            <Text style={styles.undoBannerAction}>Undo</Text>
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#f0ead6',
  },
  headerSpacer: {
    width: 32,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e1c18',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: '#f0ead6',
    fontSize: 15,
  },
  loading: {
    marginTop: 60,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
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
  grid: {
    paddingHorizontal: 12,
    paddingBottom: 40,
  },
  tileSlot: {
    padding: 4,
  },
  tile: {
    aspectRatio: 3 / 4,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1e1c18',
  },
  tileImage: {
    ...StyleSheet.absoluteFillObject,
  },
  tileMissing: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileScrim: {
    ...StyleSheet.absoluteFillObject,
  },
  tileBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(15,14,12,0.7)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tileBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#c9b97a',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  tileRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  undoBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(15,14,12,0.95)',
    borderWidth: 1,
    borderColor: '#4a4540',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  undoBannerText: {
    fontSize: 14,
    color: '#f0ead6',
  },
  undoBannerAction: {
    fontSize: 14,
    fontWeight: '600',
    color: '#c9b97a',
  },
  tileTextArea: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    gap: 2,
  },
  tileText: {
    fontSize: 13,
    lineHeight: 17,
    color: '#f0ead6',
    fontWeight: '500',
  },
  tileAuthor: {
    fontSize: 11,
    color: '#c4b99e',
  },
});
