import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, runOnJS } from 'react-native-reanimated';
import { supabase } from '@/lib/supabase';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { listQuoteBackgrounds, resolveQuoteBackground, type QuoteBackground } from '@/lib/quoteBackgrounds';
import { DEFAULT_TEXT_POSITION, pixelsToFraction, fractionToPixels } from '@/lib/textPosition';

interface SavedQuote {
  id: string;
  quote: string;
  author: string;
  source: string;
  background_photo_id: string | null;
  text_offset_x: number | null;
  text_offset_y: number | null;
}

// The draggable text box has a fixed width and an ESTIMATED max height for
// clamping purposes, rather than measuring the actual rendered text height
// live. Good enough to keep a long quote roughly on-card in most cases
// without the extra complexity of a live onLayout-driven clamp — a
// deliberate v1 simplification, not an oversight.
const TEXT_BOX_MARGIN = 24;
const ESTIMATED_BOX_HEIGHT = 170;

export default function QuoteCardsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { quoteId } = useLocalSearchParams<{ quoteId?: string }>();

  const [quote, setQuote] = useState<SavedQuote | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [backgrounds, setBackgrounds] = useState<QuoteBackground[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [cardSize, setCardSize] = useState({ width: 0, height: 0 });

  const cardRef = useRef<View>(null);

  const boxWidth = Math.max(0, Math.min(280, cardSize.width - TEXT_BOX_MARGIN * 2));
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const cardWidthShared = useSharedValue(0);
  const cardHeightShared = useSharedValue(0);
  const boxWidthShared = useSharedValue(0);

  // Shared values (cardWidthShared etc.) have stable identity across
  // renders — only their .value changes, which doesn't need to appear in
  // this dependency array — so this only actually re-runs when the real
  // inputs (cardSize, boxWidth) change, despite the lint warning.
  useEffect(() => {
    cardWidthShared.value = cardSize.width;
    cardHeightShared.value = cardSize.height;
    boxWidthShared.value = boxWidth;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardSize.width, cardSize.height, boxWidth]);

  const background = quote ? resolveQuoteBackground(backgrounds, quote.background_photo_id) : null;
  const showEditor = !showPicker && !!background;

  // Position the draggable box once we know both the card's real
  // dimensions (from onLayout) and which quote we're showing — using the
  // quote's persisted fraction if it has one, otherwise a sensible
  // default (centered, lower third). Deliberately keyed on quote?.id, not
  // the whole quote object: chooseBackground mutates quote.background_photo_id
  // on the same object, and re-running this on that change would reset
  // the drag position every time the photo changes, which should persist
  // independently. translateX/Y/boxWidth are stable-identity shared
  // values or render-derived from deps already listed.
  useEffect(() => {
    if (!quote || cardSize.width === 0 || cardSize.height === 0) return;
    const fx = quote.text_offset_x ?? DEFAULT_TEXT_POSITION.x;
    const fy = quote.text_offset_y ?? DEFAULT_TEXT_POSITION.y;
    translateX.value = fractionToPixels(fx, cardSize.width) - boxWidth / 2;
    translateY.value = fractionToPixels(fy, cardSize.height) - ESTIMATED_BOX_HEIGHT / 2;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote?.id, cardSize.width, cardSize.height]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const load = async () => {
        setLoading(true);
        setNotFound(false);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || cancelled) { setLoading(false); return; }

        if (!quoteId) {
          if (!cancelled) { setNotFound(true); setLoading(false); }
          return;
        }

        const [{ data: quoteRow, error }, backgroundList] = await Promise.all([
          supabase
            .from('saved_quotes')
            .select('id, quote, author, source, background_photo_id, text_offset_x, text_offset_y')
            .eq('id', quoteId)
            .eq('user_id', session.user.id)
            .single(),
          listQuoteBackgrounds().catch(() => [] as QuoteBackground[]),
        ]);

        if (!cancelled) {
          setBackgrounds(backgroundList);
          if (error || !quoteRow) {
            setNotFound(true);
          } else {
            setQuote(quoteRow);
            setShowPicker(false);
            setImageLoaded(false);
          }
          setLoading(false);
        }
      };

      load();
      return () => { cancelled = true; };
    }, [quoteId])
  );

  const handleCardLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    setCardSize({ width: w, height: h });
  };

  const persistPosition = (x: number, y: number) => {
    if (!quote || cardSize.width === 0 || cardSize.height === 0) return;
    const fx = pixelsToFraction(x + boxWidth / 2, cardSize.width);
    const fy = pixelsToFraction(y + ESTIMATED_BOX_HEIGHT / 2, cardSize.height);
    supabase
      .from('saved_quotes')
      .update({ text_offset_x: fx, text_offset_y: fy })
      .eq('id', quote.id);
  };

  const pan = Gesture.Pan()
    .onStart(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate((e) => {
      const maxX = Math.max(0, cardWidthShared.value - boxWidthShared.value);
      const maxY = Math.max(0, cardHeightShared.value - ESTIMATED_BOX_HEIGHT);
      translateX.value = Math.min(maxX, Math.max(0, startX.value + e.translationX));
      translateY.value = Math.min(maxY, Math.max(0, startY.value + e.translationY));
    })
    .onEnd(() => {
      runOnJS(persistPosition)(translateX.value, translateY.value);
    });

  const animatedTextStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
  }));

  const chooseBackground = async (bg: QuoteBackground) => {
    if (!quote) return;
    setQuote({ ...quote, background_photo_id: bg.id });
    setShowPicker(false);
    setImageLoaded(false);
    await supabase.from('saved_quotes').update({ background_photo_id: bg.id }).eq('id', quote.id);
  };

  const handleShare = async () => {
    if (!cardRef.current || sharing) return;
    setSharing(true);
    try {
      const uri = await captureRef(cardRef, { format: 'png', quality: 1 });
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

  if (notFound || !quote) {
    return (
      <View style={[styles.container, styles.emptyContainer, { paddingTop: insets.top }]}>
        <IconSymbol name="text.quote" size={48} color="#6a6050" accessibilityElementsHidden importantForAccessibility="no" />
        <Text style={styles.emptyTitle}>Quote not found</Text>
        <Text style={styles.emptySubtitle}>
          Go back to History and pick a saved quote to turn into a card.
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
      {!showEditor ? (
        <View style={[styles.pickerScreen, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity
            style={styles.backButtonInline}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back to History"
          >
            <IconSymbol name="chevron.left" size={16} color="#c9b97a" />
            <Text style={styles.backButtonText}>History</Text>
          </TouchableOpacity>

          <Text style={styles.pickerQuote}>&ldquo;{quote.quote}&rdquo;</Text>
          <Text style={styles.pickerAttribution}>— {quote.author}, {quote.source}</Text>

          <Text style={styles.pickerLabel}>Choose a background</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pickerStripContent}
          >
            {backgrounds.length === 0 ? (
              <Text style={styles.pickerEmptyText}>
                No background photos yet — add some to the quote-backgrounds bucket.
              </Text>
            ) : (
              backgrounds.map((bg) => (
                <TouchableOpacity
                  key={bg.id}
                  onPress={() => chooseBackground(bg)}
                  accessibilityRole="button"
                  accessibilityLabel={`Use background photo ${bg.id}`}
                  style={styles.thumbnailWrapper}
                >
                  <Image source={{ uri: bg.url }} style={styles.thumbnail} contentFit="cover" />
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      ) : (
        <>
          <View ref={cardRef} style={styles.card} onLayout={handleCardLayout} collapsable={false}>
            <Image
              source={{ uri: background!.url }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              onLoad={() => setImageLoaded(true)}
            />
            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.5)']} style={StyleSheet.absoluteFill} />

            {cardSize.width > 0 && (
              <GestureDetector gesture={pan}>
                <Animated.View style={[styles.textBox, { width: boxWidth }, animatedTextStyle]}>
                  <Text style={styles.quoteText}>&ldquo;{quote.quote}&rdquo;</Text>
                  <Text style={styles.attribution}>— {quote.author}, {quote.source}</Text>
                </Animated.View>
              </GestureDetector>
            )}
          </View>

          <TouchableOpacity
            style={[styles.backButtonFloating, { top: insets.top + 12 }]}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back to History"
          >
            <IconSymbol name="chevron.left" size={16} color="#c9b97a" />
            <Text style={styles.backButtonText}>History</Text>
          </TouchableOpacity>

          <View style={[styles.actionRow, { bottom: insets.bottom + 32 }]}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setShowPicker(true)}
              accessibilityRole="button"
              accessibilityLabel="Change background photo"
            >
              <IconSymbol name="photo.on.rectangle" size={18} color="#c9b97a" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, (!imageLoaded || sharing) && styles.actionButtonDisabled]}
              onPress={handleShare}
              disabled={!imageLoaded || sharing}
              accessibilityRole="button"
              accessibilityLabel="Share this quote card"
            >
              <IconSymbol name="paperplane.fill" size={18} color={imageLoaded ? '#c9b97a' : '#6a6050'} />
            </TouchableOpacity>
          </View>
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
  pickerScreen: {
    flex: 1,
    paddingHorizontal: 24,
  },
  backButtonInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginBottom: 24,
  },
  pickerQuote: {
    fontSize: 22,
    lineHeight: 30,
    color: '#f0ead6',
    fontStyle: 'italic',
    fontWeight: '600',
    marginBottom: 12,
  },
  pickerAttribution: {
    fontSize: 14,
    color: '#c9b97a',
    marginBottom: 40,
  },
  pickerLabel: {
    fontSize: 11,
    color: '#8a7e6e',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  pickerStripContent: {
    gap: 12,
    paddingBottom: 24,
  },
  pickerEmptyText: {
    fontSize: 13,
    color: '#a89f88',
    fontStyle: 'italic',
  },
  thumbnailWrapper: {
    width: 88,
    height: 88,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#4a4540',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  card: {
    flex: 1,
    backgroundColor: '#0f0e0c',
    overflow: 'hidden',
  },
  textBox: {
    position: 'absolute',
    left: 0,
    top: 0,
    gap: 10,
  },
  quoteText: {
    fontSize: 22,
    lineHeight: 30,
    color: '#f0ead6',
    fontStyle: 'italic',
    fontWeight: '600',
  },
  attribution: {
    fontSize: 13,
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
});
