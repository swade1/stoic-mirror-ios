import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ScrollView,
  Alert,
  LayoutChangeEvent,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import * as ImagePicker from 'expo-image-picker';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { supabase } from '@/lib/supabase';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { DraggableTextBox, type TextBox } from '@/components/DraggableTextBox';
import {
  listQuoteBackgrounds,
  resolveQuoteBackground,
  getBackgroundCategories,
  type QuoteBackground,
} from '@/lib/quoteBackgrounds';
import { DEFAULT_TEXT_POSITION } from '@/lib/textPosition';
import { flattenManualLineBreaks } from '@/lib/quoteCardText';
import {
  TEXT_COLOR_OPTIONS,
  DEFAULT_TEXT_COLOR,
  TEXT_SIZE_STEPS,
  DEFAULT_TEXT_SIZE_SCALE,
  TEXT_ALIGN_OPTIONS,
  DEFAULT_TEXT_ALIGN,
  TEXT_FONT_OPTIONS,
  DEFAULT_TEXT_FONT,
  DEFAULT_SCRIM_ENABLED,
  resolveTextFontOption,
  type TextAlignValue,
} from '@/lib/textStyleOptions';

interface SavedQuote {
  id: string;
  quote: string;
  author: string;
  source: string;
  interpretation: string;
  background_photo_id: string | null;
  text_color: string | null;
  text_font: string | null;
  text_size_scale: number | null;
  // Whether the semi-transparent backdrop panel behind the text is shown
  // — null means "use the default" (see DEFAULT_SCRIM_ENABLED), same
  // nullable-override convention as text_color/text_size_scale/text_font.
  scrim_enabled: boolean | null;
  // Free-form text pieces composed onto the card — each independently
  // positioned/draggable and freely typed, like a sticker in Instagram
  // Stories or Canva. Untouched (never edited/dragged/added to), this
  // stays null and the card shows one default piece (deriveDefaultBoxes)
  // with the quote + attribution, at the default position — the same
  // "materialize on first change" laziness the old position fields had.
  card_text_boxes: TextBox[] | null;
}

// Margin from the card's edge a box's width is capped against, so a box
// never runs edge-to-edge with no breathing room.
const TEXT_BOX_MARGIN = 24;

const newBoxId = () => `box-${Date.now()}-${Math.random().toString(36).slice(2)}`;

// A new photo invalidates position, alignment, line breaks, and how many
// pieces the card is split into — all of that was tailored to the old
// photo's specific shape. Wording survives, though: losing your photo
// shouldn't mean losing what you wrote. Collapsing every box's text back
// into one single default-positioned block (rather than keeping each
// box, just with its position/alignment reset) avoids every old box
// reappearing stacked on top of each other at the same default spot.
// Joined with a single space, not a blank line — joining with a blank
// line would visually recreate the exact "split into pieces" look this
// is meant to undo, just inside one box instead of across several.
function mergeBoxesForNewPhoto(boxes: TextBox[] | null): TextBox[] | null {
  if (!boxes || boxes.length === 0) return null;
  return [
    {
      id: newBoxId(),
      text: boxes.map((b) => flattenManualLineBreaks(b.text)).join(' '),
      align: DEFAULT_TEXT_ALIGN,
      offsetX: null,
      offsetY: null,
      color: null,
      scrimEnabled: null,
    },
  ];
}

export default function QuoteCardsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // textSource picks which of the saved quote's two texts seeds a fresh
  // card's default box — the philosopher's quote (the long-standing
  // default, and the fallback if this param is ever missing) or the
  // personalized counsel written for it. Set by which photo icon was
  // tapped in History (app/(tabs)/history.tsx) — one next to the Quote
  // section, one next to Counsel.
  // collectionId: present when reached via a slideshow's "From Saved
  // Quotes" picker (app/slideshow-add-quote.tsx) — Save then adds (or, with
  // editSlideId, updates) a slideshow_photos row linked to this quote,
  // instead of just saving a plain photo the way History's flow always has.
  // editSlideId: present when reached via an existing linked slide's own
  // Edit icon (app/slideshow-photos.tsx) — that specific slideshow_photos
  // row to update in place on Save, and the signal to skip the
  // reset-to-fresh load behavior below (see its comment).
  const { quoteId, textSource, collectionId, editSlideId } = useLocalSearchParams<{
    quoteId?: string;
    textSource?: string;
    collectionId?: string;
    editSlideId?: string;
  }>();

  // Defined inside the component (not module-level, as it used to be) so
  // it can close over textSource above — every call site already lives in
  // this component, so nothing else needed to change.
  const deriveDefaultBoxes = useCallback((quote: SavedQuote): TextBox[] => {
    const text = textSource === 'counsel' ? quote.interpretation : `${quote.quote}\n\n— ${quote.author}, ${quote.source}`;
    return [
      {
        id: 'default',
        text,
        align: DEFAULT_TEXT_ALIGN,
        offsetX: null,
        offsetY: null,
        color: null,
        scrimEnabled: null,
      },
    ];
  }, [textSource]);

  const [quote, setQuote] = useState<SavedQuote | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [backgrounds, setBackgrounds] = useState<QuoteBackground[]>([]);
  // null = "All". Reset whenever the quote reloads, matching how the
  // picker itself always reopens fresh rather than resuming a filter.
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(true);
  // A photo picked from the user's own library. Deliberately session-only
  // (never written to Supabase, never copied to app storage) — the
  // finished card is what needs to survive, via Save to Photos or Share,
  // not the source photo, and this screen already discards any unsaved
  // draft on exit and never silently resumes a previous choice anyway.
  const [personalPhotoUri, setPersonalPhotoUri] = useState<string | null>(null);
  // Natural pixel dimensions of the picked photo, needed to compute how
  // far it can be panned/zoomed before its edge would reveal empty space.
  const [personalPhotoSize, setPersonalPhotoSize] = useState<{ width: number; height: number } | null>(null);
  // Which text box (by id) currently has its keyboard open, if any — null
  // means every box is showing as plain, draggable, read-only text.
  const [editingBoxId, setEditingBoxId] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showTextStylePanel, setShowTextStylePanel] = useState(false);
  // Which box the style panel's Color/Backdrop rows apply to — null means
  // "the card's default," set when reached via a box's own "Style this
  // text" action so the panel edits that box's override instead.
  const [stylingBoxId, setStylingBoxId] = useState<string | null>(null);
  const [cardSize, setCardSize] = useState({ width: 0, height: 0 });

  const cardRef = useRef<View>(null);
  // Remembers horizontal scroll position in the background thumbnail
  // strip so reopening the picker (e.g. via the "change background" icon
  // after trying a photo) returns to where the user was browsing, instead
  // of jumping back to the first thumbnail every time. A ref rather than
  // state since it only needs to survive remounts, never trigger a
  // re-render on its own.
  const backgroundScrollRef = useRef<ScrollView>(null);
  const backgroundScrollX = useRef(0);

  const textColor = quote?.text_color ?? DEFAULT_TEXT_COLOR;
  const sizeScale = quote?.text_size_scale ?? DEFAULT_TEXT_SIZE_SCALE;
  const fontOption = resolveTextFontOption(quote?.text_font ?? DEFAULT_TEXT_FONT);
  const scrimEnabled = quote?.scrim_enabled ?? DEFAULT_SCRIM_ENABLED;
  // Alignment is per-box now (see TextBox.align) — each DraggableTextBox
  // derives its own position-anchor edge from its own alignment.
  const boxMaxWidth = Math.max(0, cardSize.width - TEXT_BOX_MARGIN * 2);

  const cardWidthShared = useSharedValue(0);
  const cardHeightShared = useSharedValue(0);

  // Personal-photo pan/zoom — session-only, reset whenever a new photo is
  // picked or the quote reloads, same as personalPhotoUri itself.
  const photoTranslateX = useSharedValue(0);
  const photoTranslateY = useSharedValue(0);
  const photoScale = useSharedValue(1);
  const photoStartX = useSharedValue(0);
  const photoStartY = useSharedValue(0);
  const photoStartScale = useSharedValue(1);
  const photoImageWidthShared = useSharedValue(0);
  const photoImageHeightShared = useSharedValue(0);

  // Shared values have stable identity across renders — only their .value
  // changes, which doesn't need to appear in this dependency array — so
  // this only actually re-runs when the real inputs change, despite the
  // lint warning.
  useEffect(() => {
    cardWidthShared.value = cardSize.width;
    cardHeightShared.value = cardSize.height;
    photoImageWidthShared.value = personalPhotoSize?.width ?? 0;
    photoImageHeightShared.value = personalPhotoSize?.height ?? 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardSize.width, cardSize.height, personalPhotoSize]);

  // A personal photo, when picked, takes precedence over the curated
  // lookup — reuses the same {id, url} shape so every downstream use of
  // background!.url (the Image source, capture/share/save) needs no
  // changes at all; expo-image and captureRef don't care whether that's
  // an https:// or a file:// URI.
  const background = personalPhotoUri
    ? { id: 'personal', url: personalPhotoUri }
    : quote ? resolveQuoteBackground(backgrounds, quote.background_photo_id) : null;
  const showEditor = !showPicker && !!background;

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
            .select('id, quote, author, source, interpretation, background_photo_id, text_color, text_size_scale, text_font, scrim_enabled, card_text_boxes')
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
            // card_text_boxes is discarded on every fresh load, even when
            // the row has previously-saved boxes — Susan decided a card is
            // a single quick sitting, not something worth resuming days
            // later, so any typed-over wording (or split/position/color
            // customization) should never resurface as a surprise the next
            // time this quote is opened from History; it just starts over
            // from the quote text, same as an untouched card always has.
            // If nothing gets edited this time, saving will persist this
            // null and clear out whatever was there before.
            //
            // editSlideId is the one exception: reaching this screen via an
            // existing slide's own Edit icon means seeing what's actually
            // on that slide, the opposite intent from History's "quick
            // one-sitting" default — so its card_text_boxes are kept as-is.
            setQuote(editSlideId ? quoteRow : { ...quoteRow, card_text_boxes: null });
            // Always open on the picker, even if this quote already has a
            // chosen background — the user wants to see the quote +
            // gallery first every time, not silently resume straight to a
            // previously composed card. editSlideId skips this too, for
            // the same reason it skips the card_text_boxes reset above —
            // if the slide's background was a personal photo rather than
            // a curated one, this naturally falls back to the picker
            // anyway, since a personal photo's URI is deliberately never
            // persisted anywhere to restore it from.
            setShowPicker(!editSlideId);
            setImageLoaded(false);
            setPersonalPhotoUri(null);
            setPersonalPhotoSize(null);
            photoTranslateX.value = 0;
            photoTranslateY.value = 0;
            photoScale.value = 1;
            setEditingBoxId(null);
            setStylingBoxId(null);
            setShowTextStylePanel(false);
            setSelectedCategory(null);
            backgroundScrollX.current = 0;
          }
          setLoading(false);
        }
      };

      load();
      return () => { cancelled = true; };
      // photoTranslateX/Y and photoScale are shared values — stable
      // identity across renders, only their .value changes, so they
      // don't need to appear here (same reasoning as the shared-value
      // sync effect above).
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [quoteId])
  );

  const handleCardLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    setCardSize({ width: w, height: h });
  };

  const MAX_PHOTO_ZOOM = 4;

  // Bounds math is inlined here rather than calling the (tested, but
  // cross-module) computePhotoPanBounds/clamp from lib/photoTransform.ts
  // — matching how the text-drag gesture in DraggableTextBox does its own
  // clamp math inline, rather than risk a worklet imported from another
  // file silently miscompiling/misbehaving on the UI thread with no error.
  const photoPan = Gesture.Pan()
    // Without a minimum distance, Pan can claim a stationary tap before
    // the double-tap gesture (raced against it below) gets a chance to
    // see the second tap — a standard conflict when combining Pan with
    // Tap, normally avoided exactly this way.
    .minDistance(10)
    .onStart(() => {
      photoStartX.value = photoTranslateX.value;
      photoStartY.value = photoTranslateY.value;
    })
    .onUpdate((e) => {
      const cardW = cardWidthShared.value;
      const cardH = cardHeightShared.value;
      const imgW = photoImageWidthShared.value;
      const imgH = photoImageHeightShared.value;
      let maxX = 0;
      let maxY = 0;
      if (cardW > 0 && cardH > 0 && imgW > 0 && imgH > 0) {
        const coverScale = Math.max(cardW / imgW, cardH / imgH);
        const displayedWidth = imgW * coverScale * photoScale.value;
        const displayedHeight = imgH * coverScale * photoScale.value;
        maxX = Math.max(0, (displayedWidth - cardW) / 2);
        maxY = Math.max(0, (displayedHeight - cardH) / 2);
      }
      photoTranslateX.value = Math.min(maxX, Math.max(-maxX, photoStartX.value + e.translationX));
      photoTranslateY.value = Math.min(maxY, Math.max(-maxY, photoStartY.value + e.translationY));
    });

  const photoPinch = Gesture.Pinch()
    .onStart(() => {
      photoStartScale.value = photoScale.value;
    })
    .onUpdate((e) => {
      const newScale = Math.min(MAX_PHOTO_ZOOM, Math.max(1, photoStartScale.value * e.scale));
      photoScale.value = newScale;
      // Zooming can shrink the valid pan range — re-clamp the current
      // offset so the image edge never pulls away from the card edge.
      const cardW = cardWidthShared.value;
      const cardH = cardHeightShared.value;
      const imgW = photoImageWidthShared.value;
      const imgH = photoImageHeightShared.value;
      let maxX = 0;
      let maxY = 0;
      if (cardW > 0 && cardH > 0 && imgW > 0 && imgH > 0) {
        const coverScale = Math.max(cardW / imgW, cardH / imgH);
        const displayedWidth = imgW * coverScale * newScale;
        const displayedHeight = imgH * coverScale * newScale;
        maxX = Math.max(0, (displayedWidth - cardW) / 2);
        maxY = Math.max(0, (displayedHeight - cardH) / 2);
      }
      photoTranslateX.value = Math.min(maxX, Math.max(-maxX, photoTranslateX.value));
      photoTranslateY.value = Math.min(maxY, Math.max(-maxY, photoTranslateY.value));
    });

  const photoDoubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      photoTranslateX.value = 0;
      photoTranslateY.value = 0;
      photoScale.value = 1;
    });

  const photoGesture = Gesture.Race(photoDoubleTap, Gesture.Simultaneous(photoPan, photoPinch));

  const animatedPhotoStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: photoTranslateX.value / photoScale.value },
      { translateY: photoTranslateY.value / photoScale.value },
      { scale: photoScale.value },
    ],
  }));

  // Background, color, size, align, and every text box are all
  // draft-only — they only touch local state here. Nothing is written to
  // Supabase until the user actually commits (Save to Photos or Share, via
  // commitFormatting below), so navigating away from an in-progress attempt
  // leaves the database untouched, and useFocusEffect's load() will fetch
  // the last truly-saved state fresh next time this screen is opened.
  const chooseBackground = (bg: QuoteBackground) => {
    if (!quote) return;
    // A new photo invalidates the old positions — every box's spot was
    // tailored to the previous photo's specific shape and doesn't carry
    // any meaning on a different one. Typed wording survives, though:
    // losing your photo isn't the same as losing what you wrote. A
    // previously-active personal photo counts as "changed" too, since
    // quote.background_photo_id is null while one is active.
    const changed = quote.background_photo_id !== bg.id;
    setPersonalPhotoUri(null);
    setPersonalPhotoSize(null);
    photoTranslateX.value = 0;
    photoTranslateY.value = 0;
    photoScale.value = 1;
    setQuote({
      ...quote,
      background_photo_id: bg.id,
      ...(changed ? {
        card_text_boxes: mergeBoxesForNewPhoto(quote.card_text_boxes),
        text_color: null,
        text_size_scale: null,
        text_font: null,
        scrim_enabled: null,
      } : {}),
    });
    setShowPicker(false);
    setImageLoaded(false);
  };

  // Cycles to the next/previous background within whatever category is
  // currently filtered (filteredBackgrounds, defined below) — lets the
  // user quickly compare photos without reopening the picker each time.
  // Wraps around at either end rather than stopping, since the point is
  // fast back-and-forth comparison, not a bounded list.
  const advanceBackground = (direction: 1 | -1) => {
    if (!quote || filteredBackgrounds.length === 0) return;
    const currentIndex = filteredBackgrounds.findIndex((bg) => bg.id === quote.background_photo_id);
    const baseIndex = currentIndex === -1 ? 0 : currentIndex;
    const nextIndex = (baseIndex + direction + filteredBackgrounds.length) % filteredBackgrounds.length;
    chooseBackground(filteredBackgrounds[nextIndex]);
  };

  const choosePersonalPhoto = async () => {
    if (!quote) return;
    // No allowsEditing here — on iOS that option is Android-only for
    // aspect (iOS crop is always square regardless) and, worse, silently
    // swaps the modern no-permission PHPickerViewController for the
    // legacy UIImagePickerController, which needs full library access we
    // never request. Cropping/reframing happens in-app instead, via the
    // pan/pinch gesture on the photo itself once it's picked.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (result.canceled) return;
    setPersonalPhotoUri(result.assets[0].uri);
    // Not using result.assets[0].width/height here — those can be the
    // photo's raw pixel dimensions before EXIF rotation is applied, which
    // don't necessarily match how expo-image actually displays it. The
    // Image's own onLoad event reports the true rendered dimensions,
    // which is what the pan/zoom bounds math needs to agree with.
    setPersonalPhotoSize(null);
    photoTranslateX.value = 0;
    photoTranslateY.value = 0;
    photoScale.value = 1;
    // Same formatting reset as chooseBackground — a personal photo is
    // always a change of background, so this always resets positions.
    setQuote({
      ...quote,
      background_photo_id: null,
      card_text_boxes: mergeBoxesForNewPhoto(quote.card_text_boxes),
      text_color: null,
      text_size_scale: null,
      text_font: null,
      scrim_enabled: null,
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

  const chooseScrimEnabled = (enabled: boolean) => {
    if (!quote) return;
    setQuote({ ...quote, scrim_enabled: enabled });
  };

  const chooseTextFont = (font: string | null) => {
    if (!quote) return;
    setQuote({ ...quote, text_font: font });
  };

  // Alignment is per-box, so this changes just the one box currently
  // being edited, not the whole card.
  const changeBoxAlign = (id: string, align: TextAlignValue) => {
    setQuote((prev) => {
      if (!prev) return prev;
      const boxes = prev.card_text_boxes ?? deriveDefaultBoxes(prev);
      // A dragged x-position means something different under each
      // alignment (the box's center vs. its left/right edge) — carrying
      // the same raw fraction across a change in alignment reinterprets
      // it under the new anchor and lands somewhere nonsensical (e.g. a
      // box dragged to the left margin under Left, then switched to
      // Center, ends up centered *on* the left margin instead of the
      // screen). Clearing this box's x position lets it snap to the new
      // alignment's own sensible starting position; vertical position is
      // unaffected since alignment is horizontal-only.
      return {
        ...prev,
        card_text_boxes: boxes.map((b) => (b.id === id ? { ...b, align, offsetX: null } : b)),
      };
    });
  };

  const changeBoxColor = (id: string, color: string) => {
    setQuote((prev) => {
      if (!prev) return prev;
      const boxes = prev.card_text_boxes ?? deriveDefaultBoxes(prev);
      return { ...prev, card_text_boxes: boxes.map((b) => (b.id === id ? { ...b, color } : b)) };
    });
  };

  const changeBoxScrim = (id: string, scrimEnabled: boolean) => {
    setQuote((prev) => {
      if (!prev) return prev;
      const boxes = prev.card_text_boxes ?? deriveDefaultBoxes(prev);
      return { ...prev, card_text_boxes: boxes.map((b) => (b.id === id ? { ...b, scrimEnabled } : b)) };
    });
  };

  // Reached from the main "Aa" action button — always edits the card's
  // defaults, not any one box, so any leftover per-box targeting from a
  // previous "Style this text" visit is cleared.
  const toggleTextStylePanel = () => {
    if (!showTextStylePanel && editingBoxId) {
      finishEditingBox(editingBoxId);
    }
    setStylingBoxId(null);
    setShowTextStylePanel((v) => !v);
  };

  // Reached from one box's own floating toolbar — exits that box's text
  // editing and opens the same style panel, but targeted at this box's
  // own Color/Backdrop override instead of the card's defaults.
  const openBoxStyling = (id: string) => {
    finishEditingBox(id);
    setStylingBoxId(id);
    setShowTextStylePanel(true);
  };

  // Materializes the derived default box(es) into real state the first
  // time anything is touched, same laziness the old position fields had —
  // untouched cards keep writing nothing to Supabase.
  const startEditingBox = (id: string) => {
    if (!quote) return;
    setQuote((prev) => (prev && !prev.card_text_boxes ? { ...prev, card_text_boxes: deriveDefaultBoxes(prev) } : prev));
    setShowTextStylePanel(false);
    setStylingBoxId(null);
    setEditingBoxId(id);
  };

  const changeBoxText = (id: string, text: string) => {
    setQuote((prev) => {
      if (!prev) return prev;
      const boxes = prev.card_text_boxes ?? deriveDefaultBoxes(prev);
      return { ...prev, card_text_boxes: boxes.map((b) => (b.id === id ? { ...b, text } : b)) };
    });
  };

  const persistBoxPosition = (id: string, offsetX: number, offsetY: number) => {
    setQuote((prev) => {
      if (!prev) return prev;
      const boxes = prev.card_text_boxes ?? deriveDefaultBoxes(prev);
      return { ...prev, card_text_boxes: boxes.map((b) => (b.id === id ? { ...b, offsetX, offsetY } : b)) };
    });
  };

  const deleteBox = (id: string) => {
    setQuote((prev) => {
      if (!prev) return prev;
      const boxes = prev.card_text_boxes ?? deriveDefaultBoxes(prev);
      return { ...prev, card_text_boxes: boxes.filter((b) => b.id !== id) };
    });
    setEditingBoxId((current) => (current === id ? null : current));
    setStylingBoxId((current) => (current === id ? null : current));
  };

  // A box left empty when editing ends is just discarded rather than
  // kept as an invisible, un-tappable ghost — matching how an empty text
  // layer in Instagram/Canva simply disappears if you tap away without
  // typing anything.
  const finishEditingBox = (id: string) => {
    setEditingBoxId((current) => (current === id ? null : current));
    setQuote((prev) => {
      if (!prev || !prev.card_text_boxes) return prev;
      const box = prev.card_text_boxes.find((b) => b.id === id);
      if (!box || box.text.trim().length > 0) return prev;
      return { ...prev, card_text_boxes: prev.card_text_boxes.filter((b) => b.id !== id) };
    });
  };

  const addTextBox = () => {
    if (!quote) return;
    const boxes = quote.card_text_boxes ?? deriveDefaultBoxes(quote);
    const id = newBoxId();
    // A concrete starting position, not null-falls-back-to-default — the
    // default position is where the first box already sits, and stacking
    // a brand new box exactly on top of it would look like nothing
    // happened when the button was tapped.
    setQuote({
      ...quote,
      card_text_boxes: [...boxes, { id, text: '', align: DEFAULT_TEXT_ALIGN, offsetX: null, offsetY: 0.5, color: null, scrimEnabled: null }],
    });
    setShowTextStylePanel(false);
    setEditingBoxId(id);
  };

  // The one place formatting actually gets written — called from Save to
  // Photos and Share, the two actions that mean "I'm keeping this." Every
  // other formatting handler above only touches local state.
  const commitFormatting = async () => {
    if (!quote) return;
    await supabase.from('saved_quotes').update({
      background_photo_id: quote.background_photo_id,
      text_color: quote.text_color,
      text_size_scale: quote.text_size_scale,
      text_font: quote.text_font,
      scrim_enabled: quote.scrim_enabled,
      card_text_boxes: quote.card_text_boxes,
    }).eq('id', quote.id);
  };

  const handleShare = async () => {
    if (!cardRef.current || sharing || editingBoxId) return;
    setSharing(true);
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) throw new Error('Sharing is not available on this device');
      const uri = await captureRef(cardRef, { format: 'png', quality: 1 });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share Quote' });
      // Committing only after the share sheet actually completes — not
      // before attempting it — so a failed capture or an unavailable
      // share sheet can never write an in-progress draft to Supabase.
      await commitFormatting();
    } catch (err) {
      Alert.alert('Share Failed', err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSharing(false);
    }
  };

  const handleSaveToPhotos = async () => {
    if (!cardRef.current || saving || editingBoxId || !quote) return;
    setSaving(true);
    try {
      const uri = await captureRef(cardRef, { format: 'png', quality: 1 });

      if (collectionId) {
        // Linking a slide back to this saved_quotes row needs the new
        // asset's id, which saveToLibraryAsync deliberately never returns
        // (see app/quote-cards.tsx's plan notes) — createAssetAsync is the
        // only API that hands it back, at the cost of the broader
        // permission below instead of the plain flow's lighter one.
        const { status } = await MediaLibrary.requestPermissionsAsync(false);
        if (status !== 'granted') {
          Alert.alert(
            'Permission Needed',
            'Allow The Stoic Mirror to access photos in your device Settings to add this to your slideshow.'
          );
          return;
        }
        const asset = await MediaLibrary.createAssetAsync(uri);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        if (editSlideId) {
          const { error } = await supabase
            .from('slideshow_photos')
            .update({ asset_id: asset.id })
            .eq('id', editSlideId);
          if (error) throw error;
        } else {
          const { data: existing } = await supabase
            .from('slideshow_photos')
            .select('sort_order')
            .eq('collection_id', collectionId)
            .order('sort_order', { ascending: false })
            .limit(1);
          const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;
          const { error } = await supabase.from('slideshow_photos').insert({
            user_id: session.user.id,
            collection_id: collectionId,
            asset_id: asset.id,
            saved_quote_id: quote.id,
            sort_order: nextOrder,
          });
          if (error) throw error;
        }
        await commitFormatting();
        Alert.alert('Saved', editSlideId ? 'This slide was updated.' : 'Added to your slideshow.');
      } else {
        // Unchanged plain save — writeOnly: true only ever needs to add a
        // photo, never read the user's existing library, so this triggers
        // iOS's lighter "Add Photos Only" permission prompt instead of
        // full library access.
        const { status } = await MediaLibrary.requestPermissionsAsync(true);
        if (status !== 'granted') {
          Alert.alert(
            'Permission Needed',
            'Allow The Stoic Mirror to save photos in your device Settings to save quote cards.'
          );
          return;
        }
        await MediaLibrary.saveToLibraryAsync(uri);
        // Committing only after the photo is actually saved — a denied
        // permission or a failed capture returns/throws above and never
        // reaches here, so an in-progress draft can never get written to
        // Supabase just because the user tapped the button.
        await commitFormatting();
        Alert.alert('Saved', 'This quote card was saved to your photos.');
      }
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

  const backgroundCategories = getBackgroundCategories(backgrounds);
  const filteredBackgrounds = selectedCategory
    ? backgrounds.filter((bg) => bg.category === selectedCategory)
    : backgrounds;
  const boxes = quote.card_text_boxes ?? deriveDefaultBoxes(quote);
  const editingBox = editingBoxId ? boxes.find((b) => b.id === editingBoxId) ?? null : null;
  // The box the style panel's Color/Backdrop rows target, when reached via
  // that box's own "Style this text" action rather than the main "Aa"
  // button — its own override if set, else falls back to the card default,
  // the same resolution DraggableTextBox itself applies when rendering.
  const stylingBox = stylingBoxId ? boxes.find((b) => b.id === stylingBoxId) ?? null : null;
  const activeTextColor = stylingBox ? stylingBox.color ?? textColor : textColor;
  const activeScrimEnabled = stylingBox ? stylingBox.scrimEnabled ?? scrimEnabled : scrimEnabled;

  return (
    <View style={styles.container}>
      {!showEditor ? (
        <View style={[styles.pickerScreen, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity
            style={styles.backButtonInline}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Select a new quote"
          >
            <IconSymbol name="chevron.left" size={16} color="#c9b97a" />
            <Text style={styles.backButtonText}>Select a new quote</Text>
          </TouchableOpacity>

          {textSource === 'counsel' ? (
            <Text style={styles.pickerQuote}>{quote.interpretation}</Text>
          ) : (
            <>
              <Text style={styles.pickerQuote}>&ldquo;{quote.quote}&rdquo;</Text>
              <Text style={styles.pickerAttribution}>— {quote.author}, {quote.source}</Text>
            </>
          )}

          <Text style={styles.pickerLabel}>Choose a background</Text>
          {backgroundCategories.length > 0 && (
            <View style={styles.categoryChipContent}>
              {['all', ...backgroundCategories].map((cat) => {
                const value = cat === 'all' ? null : cat;
                const selected = selectedCategory === value;
                const label = cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1);
                return (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => {
                      // A deliberate category change starts that category
                      // fresh — only returning to an unchanged filter
                      // (via the picker closing and reopening) restores a
                      // remembered position.
                      backgroundScrollX.current = 0;
                      backgroundScrollRef.current?.scrollTo({ x: 0, animated: true });
                      setSelectedCategory(value);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`Filter backgrounds: ${label}`}
                    style={[styles.categoryChip, selected && styles.categoryChipSelected]}
                  >
                    <Text style={[styles.categoryChipText, selected && styles.categoryChipTextSelected]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
          <ScrollView
            ref={backgroundScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pickerStripContent}
            onScroll={(e) => { backgroundScrollX.current = e.nativeEvent.contentOffset.x; }}
            scrollEventThrottle={16}
            onContentSizeChange={() => {
              backgroundScrollRef.current?.scrollTo({ x: backgroundScrollX.current, animated: false });
            }}
          >
            <TouchableOpacity
              onPress={choosePersonalPhoto}
              accessibilityRole="button"
              accessibilityLabel="Choose a photo from your library"
              style={styles.personalPhotoTile}
            >
              <IconSymbol name="photo.badge.plus" size={28} color="#c9b97a" />
              <Text style={styles.personalPhotoTileText}>Your Photo</Text>
            </TouchableOpacity>
            {filteredBackgrounds.length === 0 ? (
              <Text style={styles.pickerEmptyText}>
                {backgrounds.length === 0
                  ? 'No background photos yet — add some to the quote-backgrounds bucket.'
                  : 'No backgrounds in this category yet.'}
              </Text>
            ) : (
              filteredBackgrounds.map((bg) => {
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
            {personalPhotoUri ? (() => {
              // contentFit="cover" crops internally at render time, within
              // whatever frame the Image is given — it never actually
              // produces pixels beyond that frame for a transform to
              // reveal later. Panning a card-sized "cover" image just
              // slides an already-cropped picture off to one side,
              // exposing the card's own background on the other — which
              // is exactly the black-bar bug. Giving the Image its true
              // cover-scaled *layout* size (genuinely larger than the
              // card on one axis) means there's real content for the
              // gesture to pan/zoom into, with the card's own
              // overflow:'hidden' clipping it back down to the visible
              // area, same as any oversized child would be.
              const coverScale = personalPhotoSize && cardSize.width > 0 && cardSize.height > 0
                ? Math.max(cardSize.width / personalPhotoSize.width, cardSize.height / personalPhotoSize.height)
                : 1;
              const scaledWidth = personalPhotoSize ? personalPhotoSize.width * coverScale : cardSize.width;
              const scaledHeight = personalPhotoSize ? personalPhotoSize.height * coverScale : cardSize.height;
              const baseLeft = (cardSize.width - scaledWidth) / 2;
              const baseTop = (cardSize.height - scaledHeight) / 2;
              return (
                // Curated backgrounds are hand-picked to already look
                // right center-cropped; a personal photo wasn't, so it
                // gets its own pan/pinch/double-tap-to-reset gesture to
                // let the user reframe it themselves instead.
                <GestureDetector gesture={photoGesture}>
                  <Animated.View
                    style={[
                      { position: 'absolute', left: baseLeft, top: baseTop, width: scaledWidth, height: scaledHeight },
                      animatedPhotoStyle,
                    ]}
                  >
                    <Image
                      source={{ uri: background!.url }}
                      style={{ width: '100%', height: '100%' }}
                      contentFit="cover"
                      onLoad={(e) => {
                        setImageLoaded(true);
                        // True rendered dimensions (EXIF-orientation-
                        // corrected), not the picker's possibly-raw
                        // values — see the note in choosePersonalPhoto.
                        setPersonalPhotoSize({ width: e.source.width, height: e.source.height });
                      }}
                    />
                  </Animated.View>
                </GestureDetector>
              );
            })() : (
              <Image
                source={{ uri: background!.url }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                onLoad={() => setImageLoaded(true)}
              />
            )}
            {/* Purely decorative — pointerEvents="none" so it doesn't sit
                in the way of the photo pan/pinch gesture layered beneath it
                (the text boxes' gestures are layered above this, unaffected). */}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.5)']}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />

            {/* Tapping empty card area while a box is being edited commits
                and exits that edit, matching Instagram/Canva's
                tap-outside-to-finish behavior. Only present while editing,
                so it never intercepts a tap meant for the photo gesture
                underneath the rest of the time. */}
            {editingBoxId && (
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={() => finishEditingBox(editingBoxId)}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              />
            )}

            {cardSize.width > 0 && boxes.map((box) => (
              <DraggableTextBox
                key={box.id}
                box={box}
                cardWidth={cardSize.width}
                cardHeight={cardSize.height}
                maxWidth={boxMaxWidth}
                defaultOffsetY={DEFAULT_TEXT_POSITION.y}
                isEditing={editingBoxId === box.id}
                cardTextColor={textColor}
                cardScrimEnabled={scrimEnabled}
                fontSize={22 * sizeScale}
                lineHeight={30 * sizeScale}
                fontFamily={fontOption.fontFamily}
                fontStyle={fontOption.fontStyle}
                fontWeight={fontOption.fontWeight}
                onStartEditing={startEditingBox}
                onChangeText={changeBoxText}
                onPersistPosition={persistBoxPosition}
              />
            ))}
          </View>

          {!personalPhotoUri && filteredBackgrounds.length > 1 && (
            <>
              <TouchableOpacity
                style={styles.backgroundNavButton}
                onPress={() => advanceBackground(-1)}
                accessibilityRole="button"
                accessibilityLabel="Previous background photo"
              >
                <IconSymbol name="chevron.left" size={20} color="#c9b97a" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.backgroundNavButton, styles.backgroundNavButtonRight]}
                onPress={() => advanceBackground(1)}
                accessibilityRole="button"
                accessibilityLabel="Next background photo"
              >
                <IconSymbol name="chevron.right" size={20} color="#c9b97a" />
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity
            style={[styles.backButtonFloating, { top: insets.top + 12 }]}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Select a new quote"
          >
            <IconSymbol name="chevron.left" size={16} color="#c9b97a" />
            <Text style={styles.backButtonText}>Select a new quote</Text>
          </TouchableOpacity>

          {personalPhotoUri && (
            <View style={[styles.photoHint, { top: insets.top + 12 }]}>
              <Text style={styles.photoHintText}>{'Pinch and drag to reposition\nDouble-tap to reset'}</Text>
            </View>
          )}

          {editingBoxId && editingBox && (
            // Wrapped in a KeyboardAvoidingView — the box being edited
            // autofocuses a TextInput (the keyboard comes up immediately,
            // especially for a brand-new box from "+"), and this toolbar's
            // bottom-anchored position would otherwise sit hidden behind
            // that keyboard, with no way to reach its palette/align/delete/
            // Done icons until the keyboard was dismissed some other way.
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={styles.textBoxEditBarWrapper}
              pointerEvents="box-none"
            >
              <View style={[styles.textBoxEditBar, { marginBottom: insets.bottom - 8 }]}>
                <View style={styles.textBoxEditActions}>
                  {TEXT_ALIGN_OPTIONS.map((option) => {
                    const selected = editingBox.align === option.value;
                    const iconName =
                      option.value === 'left' ? 'text.alignleft' :
                      option.value === 'right' ? 'text.alignright' :
                      'text.aligncenter';
                    return (
                      <TouchableOpacity
                        key={option.value}
                        onPress={() => changeBoxAlign(editingBoxId, option.value)}
                        hitSlop={8}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        accessibilityLabel={`Align this text ${option.label}`}
                      >
                        <IconSymbol name={iconName} size={16} color={selected ? '#f0ead6' : '#a89f88'} />
                      </TouchableOpacity>
                    );
                  })}
                  <TouchableOpacity
                    onPress={() => openBoxStyling(editingBoxId)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Color and backdrop for this text"
                  >
                    <IconSymbol name="paintpalette" size={16} color="#a89f88" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => deleteBox(editingBoxId)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Delete this text"
                  >
                    <IconSymbol name="xmark.circle.fill" size={18} color="#c9b97a" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => finishEditingBox(editingBoxId)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Done editing text"
                  >
                    <Text style={styles.resetText}>Done</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          )}

          {showTextStylePanel && (
            <View style={[styles.textStylePanel, { bottom: insets.bottom + 108 }]}>
              <Text style={styles.textStylePanelLabel}>Font</Text>
              <View style={styles.fontRow}>
                {TEXT_FONT_OPTIONS.map((option) => {
                  const selected = (quote.text_font ?? null) === option.value;
                  return (
                    <TouchableOpacity
                      key={option.label}
                      onPress={() => chooseTextFont(option.value)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`Font ${option.label}`}
                      style={[styles.sizeOption, selected && styles.sizeOptionSelected]}
                    >
                      <Text
                        style={[
                          styles.sizeOptionText,
                          selected && styles.sizeOptionTextSelected,
                          { fontFamily: option.fontFamily, fontStyle: option.fontStyle, fontWeight: option.fontWeight },
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.textStylePanelLabel}>{stylingBox ? 'Color (this text)' : 'Color'}</Text>
              <View style={styles.swatchRow}>
                {TEXT_COLOR_OPTIONS.map((option) => {
                  const selected = activeTextColor === option.value;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      onPress={() => (stylingBox ? changeBoxColor(stylingBox.id, option.value) : chooseTextColor(option.value))}
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

              <Text style={styles.textStylePanelLabel}>{stylingBox ? 'Backdrop (this text)' : 'Backdrop'}</Text>
              <View style={styles.sizeRow}>
                {[{ label: 'On', value: true }, { label: 'Off', value: false }].map((option) => {
                  const selected = activeScrimEnabled === option.value;
                  return (
                    <TouchableOpacity
                      key={option.label}
                      onPress={() => (stylingBox ? changeBoxScrim(stylingBox.id, option.value) : chooseScrimEnabled(option.value))}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`Backdrop ${option.label}`}
                      style={[styles.sizeOption, selected && styles.sizeOptionSelected]}
                    >
                      <Text style={[styles.sizeOptionText, selected && styles.sizeOptionTextSelected]}>
                        {option.label}
                      </Text>
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
              onPress={toggleTextStylePanel}
              accessibilityRole="button"
              accessibilityLabel="Text color and size"
            >
              <IconSymbol name="textformat" size={18} color="#c9b97a" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={addTextBox}
              accessibilityRole="button"
              accessibilityLabel="Add text"
            >
              <IconSymbol name="plus" size={18} color="#c9b97a" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, (!imageLoaded || saving || !!editingBoxId) && styles.actionButtonDisabled]}
              onPress={handleSaveToPhotos}
              disabled={!imageLoaded || saving || !!editingBoxId}
              accessibilityRole="button"
              accessibilityLabel="Save this quote card to Photos"
            >
              <IconSymbol name="square.and.arrow.down" size={18} color={imageLoaded ? '#c9b97a' : '#6a6050'} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, (!imageLoaded || sharing || !!editingBoxId) && styles.actionButtonDisabled]}
              onPress={handleShare}
              disabled={!imageLoaded || sharing || !!editingBoxId}
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
  categoryChipContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 12,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#4a4540',
  },
  categoryChipSelected: {
    borderColor: '#c9b97a',
    backgroundColor: 'rgba(201,185,122,0.15)',
  },
  categoryChipText: {
    fontSize: 13,
    color: '#a89f88',
  },
  categoryChipTextSelected: {
    color: '#f0ead6',
    fontWeight: '600',
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
  personalPhotoTile: {
    width: 88,
    height: 88,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#6a6050',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  personalPhotoTileText: {
    fontSize: 11,
    color: '#c9b97a',
  },
  card: {
    flex: 1,
    backgroundColor: '#0f0e0c',
    overflow: 'hidden',
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
  backgroundNavButton: {
    position: 'absolute',
    left: 12,
    top: '50%',
    marginTop: -20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(15,14,12,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backgroundNavButtonRight: {
    left: undefined,
    right: 12,
  },
  backButtonText: {
    fontSize: 14,
    color: '#c9b97a',
  },
  photoHint: {
    position: 'absolute',
    right: 16,
    backgroundColor: 'rgba(15,14,12,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  photoHintText: {
    fontSize: 11,
    color: '#c9b97a',
    textAlign: 'right',
  },
  actionRow: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'center',
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
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 8,
  },
  fontRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
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
  textBoxEditBarWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
  },
  textBoxEditBar: {
    marginHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(15,14,12,0.75)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  textBoxEditActions: {
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
