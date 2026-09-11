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
import * as MediaLibrary from 'expo-media-library';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, runOnJS } from 'react-native-reanimated';
import { supabase } from '@/lib/supabase';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { listQuoteBackgrounds, resolveQuoteBackground, type QuoteBackground } from '@/lib/quoteBackgrounds';
import { DEFAULT_TEXT_POSITION, pixelsToFraction, fractionToPixels } from '@/lib/textPosition';
import {
  TEXT_COLOR_OPTIONS,
  DEFAULT_TEXT_COLOR,
  TEXT_SIZE_STEPS,
  DEFAULT_TEXT_SIZE_SCALE,
  TEXT_ALIGN_OPTIONS,
  DEFAULT_TEXT_ALIGN,
  type TextAlignValue,
} from '@/lib/textStyleOptions';
import { splitIntoWords, groupWordsIntoLines, indexWordsByLine } from '@/lib/quoteLineBreaks';
import { pushUndoState, popUndoState } from '@/lib/undoStack';

interface SavedQuote {
  id: string;
  quote: string;
  author: string;
  source: string;
  background_photo_id: string | null;
  text_offset_x: number | null;
  text_offset_y: number | null;
  text_color: string | null;
  text_size_scale: number | null;
  card_line_breaks: number[] | null;
  text_align: string | null;
}

// Only used for the legacy single-block (no custom line breaks) rendering
// path, to give word-wrap a reasonable max width. Once custom line breaks
// are in play, the box's size is measured live instead (see
// textBlockSize/onLayout below) — a fixed estimate can't work once each
// line's width is deliberately different from the others.
const TEXT_BOX_MARGIN = 24;

export default function QuoteCardsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { quoteId } = useLocalSearchParams<{ quoteId?: string }>();

  const [quote, setQuote] = useState<SavedQuote | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [backgrounds, setBackgrounds] = useState<QuoteBackground[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(true);
  // Editing happens in place on the visible card, not on a separate screen —
  // the whole point is judging line length against the photo's shape, which
  // is impossible if the photo isn't on screen while editing.
  const [editingLines, setEditingLines] = useState(false);
  const [editingBreaks, setEditingBreaks] = useState<Set<number>>(new Set());
  // Undo history for the current editing session only — not persisted, and
  // reset each time editing is (re)entered, same as editingBreaks itself.
  const [breakHistory, setBreakHistory] = useState<Set<number>[]>([]);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showTextStylePanel, setShowTextStylePanel] = useState(false);
  const [cardSize, setCardSize] = useState({ width: 0, height: 0 });
  // The text block's real rendered size, measured via onLayout rather than
  // approximated — needed now that custom line breaks make both width and
  // height unpredictable from a fixed formula.
  const [textBlockSize, setTextBlockSize] = useState({ width: 0, height: 0 });

  const cardRef = useRef<View>(null);

  const textColor = quote?.text_color ?? DEFAULT_TEXT_COLOR;
  const sizeScale = quote?.text_size_scale ?? DEFAULT_TEXT_SIZE_SCALE;
  const textAlign = (quote?.text_align ?? DEFAULT_TEXT_ALIGN) as TextAlignValue;
  // Controls how lines sit relative to each other in the block (a shared
  // edge), not just how text is justified within a single line — that's
  // what lets a left-aligned block keep every line flush against the same
  // margin while only the opposite edge tapers to follow a photo's shape.
  const boxAlignItems = textAlign === 'left' ? 'flex-start' : textAlign === 'right' ? 'flex-end' : 'center';
  // The persisted horizontal fraction anchors to whichever edge the current
  // alignment holds fixed (0 = left edge, 1 = right edge, 0.5 = center) —
  // not always the box's midpoint. Anchoring to the midpoint made sense
  // when every line was always centered, but for left/right alignment the
  // box's measured width isn't stable (a fixed-width legacy block vs. a
  // shrink-wrapped row of tappable words during editing render at
  // different widths), and re-deriving position from a midpoint fraction
  // on every width change visibly dragged the block toward the center of
  // the screen. Anchoring to the aligned edge instead means a width change
  // never moves that edge, only the opposite (ragged) one.
  const boxAnchorX = textAlign === 'left' ? 0 : textAlign === 'right' ? 1 : 0.5;
  // The un-dragged starting position also has to depend on alignment — a
  // freshly left-aligned block anchored to a fraction meant for a centered
  // block (0.5) would sit with its left edge at screen center, not near the
  // left margin. These roughly match TEXT_BOX_MARGIN's inset from each edge.
  const defaultAnchorX = textAlign === 'left' ? 0.06 : textAlign === 'right' ? 0.94 : DEFAULT_TEXT_POSITION.x;
  const legacyMaxWidth = Math.max(0, Math.min(280, cardSize.width - TEXT_BOX_MARGIN * 2));

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const cardWidthShared = useSharedValue(0);
  const cardHeightShared = useSharedValue(0);
  const textBlockWidthShared = useSharedValue(0);
  const textBlockHeightShared = useSharedValue(0);

  // Shared values have stable identity across renders — only their .value
  // changes, which doesn't need to appear in this dependency array — so
  // this only actually re-runs when the real inputs change, despite the
  // lint warning.
  useEffect(() => {
    cardWidthShared.value = cardSize.width;
    cardHeightShared.value = cardSize.height;
    textBlockWidthShared.value = textBlockSize.width;
    textBlockHeightShared.value = textBlockSize.height;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardSize.width, cardSize.height, textBlockSize.width, textBlockSize.height]);

  const background = quote ? resolveQuoteBackground(backgrounds, quote.background_photo_id) : null;
  const showEditor = !showPicker && !!background;
  const words = quote ? splitIntoWords(quote.quote) : [];
  const hasCustomBreaks = !!quote?.card_line_breaks && quote.card_line_breaks.length > 0;
  const customLines = hasCustomBreaks ? groupWordsIntoLines(words, quote!.card_line_breaks!) : null;
  // While editing, lines are grouped from the live draft (editingBreaks) so
  // the shape on screen updates the instant a word is tapped — this is the
  // preview, there's no separate "Done" step to see the result.
  const editingLinesGrouped = editingLines ? indexWordsByLine(words, Array.from(editingBreaks)) : null;
  // Both the persisted custom-line layout and the live editing layout need
  // each line to size to its own content instead of stretching to a shared
  // box width, and during editing the box is also capped at the legacy
  // auto-wrap width so a not-yet-broken line still wraps sensibly.
  const useCenteredBox = hasCustomBreaks || editingLines;

  // Position the draggable box once we know both the card's real
  // dimensions and the text block's real measured size — using the
  // quote's persisted fraction if it has one, otherwise a sensible
  // default (centered, lower third). Deliberately keyed on quote?.id, not
  // the whole quote object: chooseBackground mutates quote.background_photo_id
  // on the same object, and re-running this on that change would reset
  // the drag position every time the photo changes, which should persist
  // independently. Re-running on textBlockSize changes (from a size, line-
  // break, or any other change that affects the block's rendered
  // dimensions) re-derives the top-left position from the unchanged
  // center fraction, keeping the visual center anchored rather than
  // letting it drift when the block's shape changes.
  useEffect(() => {
    if (!quote || cardSize.width === 0 || cardSize.height === 0) return;
    if (textBlockSize.width === 0 || textBlockSize.height === 0) return;
    const fx = quote.text_offset_x ?? defaultAnchorX;
    const fy = quote.text_offset_y ?? DEFAULT_TEXT_POSITION.y;
    translateX.value = fractionToPixels(fx, cardSize.width) - textBlockSize.width * boxAnchorX;
    translateY.value = fractionToPixels(fy, cardSize.height) - textBlockSize.height / 2;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote?.id, cardSize.width, cardSize.height, textBlockSize.width, textBlockSize.height, boxAnchorX, defaultAnchorX]);

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
            .select('id, quote, author, source, background_photo_id, text_offset_x, text_offset_y, text_color, text_size_scale, card_line_breaks, text_align')
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
            // Always open on the picker, even if this quote already has a
            // chosen background — the user wants to see the quote +
            // gallery first every time, not silently resume straight to a
            // previously composed card.
            setShowPicker(true);
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

  const handleTextBlockLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    setTextBlockSize({ width: w, height: h });
  };

  const persistPosition = (x: number, y: number) => {
    if (!quote || cardSize.width === 0 || cardSize.height === 0) return;
    if (textBlockSize.width === 0 || textBlockSize.height === 0) return;
    const fx = pixelsToFraction(x + textBlockSize.width * boxAnchorX, cardSize.width);
    const fy = pixelsToFraction(y + textBlockSize.height / 2, cardSize.height);
    // Local state only (see the draft-formatting note above) — but still
    // needs the functional setQuote form, not a stale closed-over `quote`,
    // otherwise a later size/color/line-break change spreads a stale quote
    // object (still showing the pre-drag offset) back into state, and the
    // position-reset effect falls back to the default position, discarding
    // wherever the user actually dragged the text to.
    setQuote((prev) => (prev ? { ...prev, text_offset_x: fx, text_offset_y: fy } : prev));
  };

  const pan = Gesture.Pan()
    .enabled(!editingLines)
    .onStart(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate((e) => {
      const maxX = Math.max(0, cardWidthShared.value - textBlockWidthShared.value);
      const maxY = Math.max(0, cardHeightShared.value - textBlockHeightShared.value);
      translateX.value = Math.min(maxX, Math.max(0, startX.value + e.translationX));
      translateY.value = Math.min(maxY, Math.max(0, startY.value + e.translationY));
    })
    .onEnd(() => {
      runOnJS(persistPosition)(translateX.value, translateY.value);
    });

  const animatedTextStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
  }));

  // Background, color, size, align, position, and line breaks are all
  // draft-only — they only touch local state here. Nothing is written to
  // Supabase until the user actually commits (Save to Photos or Share, via
  // commitFormatting below), so navigating away from an in-progress attempt
  // leaves the database untouched, and useFocusEffect's load() will fetch
  // the last truly-saved state fresh next time this screen is opened.
  const chooseBackground = (bg: QuoteBackground) => {
    if (!quote) return;
    // A new photo invalidates the old formatting — position, line breaks,
    // color, size, and alignment were all tailored to the previous photo's
    // specific shape and don't carry any meaning on a different one.
    const changed = quote.background_photo_id !== bg.id;
    setQuote({
      ...quote,
      background_photo_id: bg.id,
      ...(changed ? {
        text_offset_x: null,
        text_offset_y: null,
        text_color: null,
        text_size_scale: null,
        card_line_breaks: null,
        text_align: null,
      } : {}),
    });
    setShowPicker(false);
    setImageLoaded(false);
  };

  const chooseTextColor = (color: string) => {
    if (!quote) return;
    setQuote({ ...quote, text_color: color });
  };

  const chooseTextSize = (scale: number) => {
    if (!quote) return;
    setQuote({ ...quote, text_size_scale: scale });
  };

  const chooseTextAlign = (align: TextAlignValue) => {
    if (!quote) return;
    // A dragged x-position means something different under each alignment
    // (the block's center vs. its left/right edge) — carrying the same raw
    // fraction across a change in alignment reinterprets it under the new
    // anchor and lands somewhere nonsensical (e.g. a block dragged to the
    // left margin under Left, then switched to Center, ends up centered
    // *on* the left margin instead of the screen). Clearing it lets the
    // block snap to that alignment's own sensible starting position;
    // vertical position is unaffected since alignment is horizontal-only.
    setQuote({ ...quote, text_align: align, text_offset_x: null });
  };

  const toggleLineEditing = () => {
    if (editingLines) {
      handleDoneEditingLines();
    } else {
      setEditingBreaks(new Set(quote?.card_line_breaks ?? []));
      setBreakHistory([]);
      setShowTextStylePanel(false);
      setEditingLines(true);
    }
  };

  // Routes every change to editingBreaks (a toggle or a Reset) through one
  // place so each records the state it's replacing — that's what makes
  // Undo work for both, not just individual word taps. Takes an updater
  // function rather than a plain value and reads the previous state from
  // React's own state queue (the callback form of setEditingBreaks) rather
  // than the editingBreaks closed over by this render — two taps handled in
  // the same batch would otherwise both compute their "next" set from the
  // same stale pre-tap value, silently losing whichever one lost the race.
  const applyBreaksChange = (compute: (prev: Set<number>) => Set<number>) => {
    setEditingBreaks((prev) => {
      setBreakHistory((history) => pushUndoState(history, prev));
      return compute(prev);
    });
  };

  const toggleBreak = (index: number) => {
    applyBreaksChange((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleUndoBreak = () => {
    setBreakHistory((history) => {
      const popped = popUndoState(history);
      if (!popped) return history;
      setEditingBreaks(popped.value);
      return popped.history;
    });
  };

  const handleDoneEditingLines = () => {
    if (!quote) return;
    const sorted = Array.from(editingBreaks).sort((a, b) => a - b);
    const breaks = sorted.length > 0 ? sorted : null;
    setQuote({ ...quote, card_line_breaks: breaks });
    setEditingLines(false);
  };

  // The one place formatting actually gets written — called from Save to
  // Photos and Share, the two actions that mean "I'm keeping this." Every
  // other formatting handler above only touches local state.
  const commitFormatting = async () => {
    if (!quote) return;
    await supabase.from('saved_quotes').update({
      background_photo_id: quote.background_photo_id,
      text_offset_x: quote.text_offset_x,
      text_offset_y: quote.text_offset_y,
      text_color: quote.text_color,
      text_size_scale: quote.text_size_scale,
      card_line_breaks: quote.card_line_breaks,
      text_align: quote.text_align,
    }).eq('id', quote.id);
  };

  const handleShare = async () => {
    if (!cardRef.current || sharing) return;
    setSharing(true);
    try {
      await commitFormatting();
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

  const handleSaveToPhotos = async () => {
    if (!cardRef.current || saving) return;
    setSaving(true);
    try {
      await commitFormatting();
      // writeOnly: true — only ever need to add a photo, never read the
      // user's existing library, so this triggers iOS's lighter "Add
      // Photos Only" permission prompt instead of full library access.
      const { status } = await MediaLibrary.requestPermissionsAsync(true);
      if (status !== 'granted') {
        Alert.alert(
          'Permission Needed',
          'Allow The Stoic Mirror to save photos in your device Settings to save quote cards.'
        );
        return;
      }
      const uri = await captureRef(cardRef, { format: 'png', quality: 1 });
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert('Saved', 'This quote card was saved to your photos.');
    } catch (err) {
      Alert.alert('Save Failed', err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSaving(false);
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
              backgrounds.map((bg) => {
                const selected = quote.background_photo_id === bg.id;
                return (
                  <TouchableOpacity
                    key={bg.id}
                    onPress={() => chooseBackground(bg)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`Use background photo ${bg.id}`}
                    style={[styles.thumbnailWrapper, selected && styles.thumbnailSelected]}
                  >
                    <Image source={{ uri: bg.url }} style={styles.thumbnail} contentFit="cover" />
                  </TouchableOpacity>
                );
              })
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

            {cardSize.width > 0 && (() => {
              // While editing, the word Touchables render inside this same
              // block. Even with the pan gesture disabled via .enabled(),
              // a mounted GestureDetector can still intercept the touch
              // stream ahead of RN's legacy responder system that
              // TouchableOpacity relies on, making individual word taps
              // unreliable (the reported symptom: an added break vanishing
              // again, or state that looks like it never updated). Not
              // mounting the GestureDetector at all while editing removes
              // that competition outright, rather than trusting a runtime
              // "disabled" flag to fully step aside.
              const textBlock = (
                <Animated.View
                  style={[
                    styles.textBox,
                    !useCenteredBox ? { width: legacyMaxWidth } : { alignItems: boxAlignItems },
                    editingLines && { maxWidth: legacyMaxWidth },
                    animatedTextStyle,
                  ]}
                  onLayout={handleTextBlockLayout}
                >
                  {editingLines ? (
                    editingLinesGrouped!.map((line, i) => (
                      <View key={i} style={[styles.editableLineRow, { justifyContent: boxAlignItems }]}>
                        {line.map(({ word, index }) => {
                          const isLastOverall = index === words.length - 1;
                          const hasBreak = editingBreaks.has(index);
                          const display = `${index === 0 ? '“' : ''}${word}${isLastOverall ? '”' : ''}`;
                          const wordNode = (
                            <Text
                              style={[
                                styles.quoteText,
                                { color: textColor, fontSize: 22 * sizeScale, lineHeight: 30 * sizeScale },
                              ]}
                            >
                              {display}{!isLastOverall ? ' ' : ''}
                            </Text>
                          );
                          if (isLastOverall) {
                            return <React.Fragment key={index}>{wordNode}</React.Fragment>;
                          }
                          return (
                            <TouchableOpacity
                              key={index}
                              onPress={() => toggleBreak(index)}
                              accessibilityRole="button"
                              accessibilityState={{ selected: hasBreak }}
                              accessibilityLabel={hasBreak ? `Remove line break after ${word}` : `Add line break after ${word}`}
                            >
                              {wordNode}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    ))
                  ) : hasCustomBreaks ? (
                    customLines!.map((line, i) => {
                      const isFirst = i === 0;
                      const isLast = i === customLines!.length - 1;
                      return (
                        <Text
                          key={i}
                          style={[
                            styles.quoteText,
                            { color: textColor, fontSize: 22 * sizeScale, lineHeight: 30 * sizeScale },
                          ]}
                        >
                          {isFirst ? '“' : ''}{line}{isLast ? '”' : ''}
                        </Text>
                      );
                    })
                  ) : (
                    <Text style={[styles.quoteText, { color: textColor, fontSize: 22 * sizeScale, lineHeight: 30 * sizeScale, textAlign }]}>
                      &ldquo;{quote.quote}&rdquo;
                    </Text>
                  )}
                  <Text style={[styles.attribution, { color: textColor, fontSize: 13 * sizeScale }]}>
                    — {quote.author}, {quote.source}
                  </Text>
                </Animated.View>
              );
              return editingLines ? (
                textBlock
              ) : (
                <GestureDetector gesture={pan}>{textBlock}</GestureDetector>
              );
            })()}
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

          {editingLines && (
            <View style={[styles.lineEditBar, { bottom: insets.bottom + 4 }]}>
              <Text style={styles.lineEditBarText}>Tap between words to break the line</Text>
              <View style={styles.lineEditActions}>
                <TouchableOpacity
                  onPress={handleUndoBreak}
                  disabled={breakHistory.length === 0}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Undo last line break change"
                  accessibilityState={{ disabled: breakHistory.length === 0 }}
                >
                  <IconSymbol
                    name="arrow.uturn.backward"
                    size={16}
                    color={breakHistory.length === 0 ? '#4a4540' : '#c9b97a'}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => applyBreaksChange(() => new Set())}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Reset to automatic line wrapping"
                >
                  <Text style={styles.resetText}>Reset</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {showTextStylePanel && (
            <View style={[styles.textStylePanel, { bottom: insets.bottom + 108 }]}>
              <Text style={styles.textStylePanelLabel}>Color</Text>
              <View style={styles.swatchRow}>
                {TEXT_COLOR_OPTIONS.map((option) => {
                  const selected = textColor === option.value;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      onPress={() => chooseTextColor(option.value)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`Text color ${option.label}`}
                      style={[
                        styles.swatch,
                        { backgroundColor: option.value },
                        selected && styles.swatchSelected,
                      ]}
                    />
                  );
                })}
              </View>

              <Text style={styles.textStylePanelLabel}>Size</Text>
              <View style={styles.sizeRow}>
                {TEXT_SIZE_STEPS.map((step) => {
                  const selected = sizeScale === step.value;
                  return (
                    <TouchableOpacity
                      key={step.label}
                      onPress={() => chooseTextSize(step.value)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      style={[styles.sizeOption, selected && styles.sizeOptionSelected]}
                    >
                      <Text style={[styles.sizeOptionText, selected && styles.sizeOptionTextSelected]}>
                        {step.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.textStylePanelLabel}>Align</Text>
              <View style={styles.alignRow}>
                {TEXT_ALIGN_OPTIONS.map((option) => {
                  const selected = textAlign === option.value;
                  const iconName =
                    option.value === 'left' ? 'text.alignleft' :
                    option.value === 'right' ? 'text.alignright' :
                    'text.aligncenter';
                  return (
                    <TouchableOpacity
                      key={option.value}
                      onPress={() => chooseTextAlign(option.value)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`Align text ${option.label}`}
                      style={[styles.alignOption, selected && styles.alignOptionSelected]}
                    >
                      <IconSymbol name={iconName} size={18} color={selected ? '#f0ead6' : '#a89f88'} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          <View style={[styles.actionRow, { bottom: insets.bottom + 52 }]}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setShowPicker(true)}
              accessibilityRole="button"
              accessibilityLabel="Change background photo"
            >
              <IconSymbol name="photo.on.rectangle" size={18} color="#c9b97a" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, showTextStylePanel && styles.actionButtonActive]}
              onPress={() => setShowTextStylePanel((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel="Text color and size"
            >
              <IconSymbol name="textformat" size={18} color="#c9b97a" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, editingLines && styles.actionButtonActive]}
              onPress={toggleLineEditing}
              accessibilityRole="button"
              accessibilityLabel={editingLines ? 'Done editing line breaks' : 'Edit line breaks'}
            >
              <IconSymbol name="arrow.turn.down.left" size={18} color="#c9b97a" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, (!imageLoaded || saving) && styles.actionButtonDisabled]}
              onPress={handleSaveToPhotos}
              disabled={!imageLoaded || saving}
              accessibilityRole="button"
              accessibilityLabel="Save this quote card to Photos"
            >
              <IconSymbol name="square.and.arrow.down" size={18} color={imageLoaded ? '#c9b97a' : '#6a6050'} />
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
    marginTop: 24,
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
  thumbnailSelected: {
    borderWidth: 2,
    borderColor: '#c9b97a',
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
  actionButtonActive: {
    backgroundColor: 'rgba(201,185,122,0.25)',
  },
  textStylePanel: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: 'rgba(15,14,12,0.9)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#4a4540',
    padding: 16,
    gap: 8,
  },
  textStylePanelLabel: {
    fontSize: 11,
    color: '#8a7e6e',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  swatchRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#4a4540',
  },
  swatchSelected: {
    borderWidth: 2,
    borderColor: '#c9b97a',
  },
  sizeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  sizeOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#4a4540',
  },
  sizeOptionSelected: {
    borderColor: '#c9b97a',
    backgroundColor: 'rgba(201,185,122,0.15)',
  },
  sizeOptionText: {
    fontSize: 13,
    color: '#a89f88',
  },
  sizeOptionTextSelected: {
    color: '#f0ead6',
    fontWeight: '600',
  },
  alignRow: {
    flexDirection: 'row',
    gap: 10,
  },
  alignOption: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#4a4540',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alignOptionSelected: {
    borderColor: '#c9b97a',
    backgroundColor: 'rgba(201,185,122,0.15)',
  },
  editableLineRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  lineEditBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(15,14,12,0.75)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  lineEditBarText: {
    flexShrink: 1,
    marginRight: 12,
    fontSize: 12,
    color: '#c9b97a',
  },
  lineEditActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  resetText: {
    fontSize: 13,
    color: '#f0ead6',
    fontWeight: '600',
  },
});
