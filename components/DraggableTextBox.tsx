import React, { useEffect, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, TextInput, type TextStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { DEFAULT_TEXT_POSITION, fractionToPixels, pixelsToFraction } from '@/lib/textPosition';
import { isLightTextColor, type TextAlignValue } from '@/lib/textStyleOptions';

export interface TextBox {
  id: string;
  text: string;
  align: TextAlignValue;
  // Fraction-of-card position, same meaning as the card's old text_offset_x/y
  // — null means "never dragged," fall back to this box's alignment-derived
  // default position.
  offsetX: number | null;
  offsetY: number | null;
}

interface Props {
  box: TextBox;
  cardWidth: number;
  cardHeight: number;
  maxWidth: number;
  defaultOffsetY: number;
  isEditing: boolean;
  textColor: string;
  fontSize: number;
  lineHeight: number;
  fontFamily: string | undefined;
  fontStyle: 'normal' | 'italic';
  fontWeight: TextStyle['fontWeight'];
  onStartEditing: (id: string) => void;
  onChangeText: (id: string, text: string) => void;
  onPersistPosition: (id: string, offsetX: number, offsetY: number) => void;
}

// One free-form, independently draggable and editable piece of text on a
// quote card — the sticker-style building block the card is composed
// from, matching how Instagram Stories/Canva text layers work. Each
// instance owns its own Reanimated position state; that's not just
// convenient, it's required — useSharedValue/useAnimatedStyle must be
// called a fixed number of times per component, so a variable-length list
// of draggable pieces has to be one component instance per piece rather
// than hand-declared shared-value pairs in a parent (translateX,
// translateX2, ...), which is what made the two previous approaches to
// this feature so easy to get wrong.
export function DraggableTextBox({
  box,
  cardWidth,
  cardHeight,
  maxWidth,
  defaultOffsetY,
  isEditing,
  textColor,
  fontSize,
  lineHeight,
  fontFamily,
  fontStyle,
  fontWeight,
  onStartEditing,
  onChangeText,
  onPersistPosition,
}: Props) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  // The persisted horizontal fraction anchors to whichever edge this
  // box's own alignment holds fixed (0 = left edge, 1 = right edge, 0.5 =
  // center) — not always the box's midpoint, since a box's measured width
  // isn't stable as its text changes, and re-deriving position from a
  // midpoint fraction on every width change would visibly drag the box
  // toward the center of the screen. Anchoring to the aligned edge instead
  // means a width change never moves that edge, only the opposite one.
  const boxAnchorX = box.align === 'left' ? 0 : box.align === 'right' ? 1 : 0.5;
  // The un-dragged starting x also has to depend on alignment — a freshly
  // left-aligned box anchored to a fraction meant for a centered box (0.5)
  // would sit with its left edge at screen center, not near the left
  // margin. These roughly match the card's own edge margin.
  const defaultOffsetX = box.align === 'left' ? 0.06 : box.align === 'right' ? 0.94 : DEFAULT_TEXT_POSITION.x;

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const cardWidthShared = useSharedValue(0);
  const cardHeightShared = useSharedValue(0);
  const widthShared = useSharedValue(0);
  const heightShared = useSharedValue(0);

  useEffect(() => {
    cardWidthShared.value = cardWidth;
    cardHeightShared.value = cardHeight;
    widthShared.value = size.width;
    heightShared.value = size.height;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardWidth, cardHeight, size.width, size.height]);

  // Positions the box from its persisted fraction whenever that fraction,
  // the card, or the box's own measured size changes — including an
  // external reset (e.g. the card's background photo changed, which nulls
  // every box's offset back to the default) even while this exact
  // component instance stays mounted.
  useEffect(() => {
    if (cardWidth === 0 || cardHeight === 0 || size.width === 0 || size.height === 0) return;
    const fx = box.offsetX ?? defaultOffsetX;
    const fy = box.offsetY ?? defaultOffsetY;
    translateX.value = fractionToPixels(fx, cardWidth) - size.width * boxAnchorX;
    translateY.value = fractionToPixels(fy, cardHeight) - size.height / 2;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [box.offsetX, box.offsetY, cardWidth, cardHeight, size.width, size.height, boxAnchorX, defaultOffsetX, defaultOffsetY]);

  const persistPosition = (x: number, y: number) => {
    if (cardWidth === 0 || cardHeight === 0 || size.width === 0 || size.height === 0) return;
    const fx = pixelsToFraction(x + size.width * boxAnchorX, cardWidth);
    const fy = pixelsToFraction(y + size.height / 2, cardHeight);
    onPersistPosition(box.id, fx, fy);
  };

  const pan = Gesture.Pan()
    .enabled(!isEditing)
    // Without a minimum distance, Pan can claim a stationary tap before
    // the Tap gesture (raced against it below) sees it — the same fix
    // already used for the photo pan/double-tap conflict and the
    // slideshow tap/swipe conflict elsewhere in this app.
    .minDistance(10)
    .onStart(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate((e) => {
      const maxX = Math.max(0, cardWidthShared.value - widthShared.value);
      const maxY = Math.max(0, cardHeightShared.value - heightShared.value);
      translateX.value = Math.min(maxX, Math.max(0, startX.value + e.translationX));
      translateY.value = Math.min(maxY, Math.max(0, startY.value + e.translationY));
    })
    .onEnd(() => {
      runOnJS(persistPosition)(translateX.value, translateY.value);
    });

  const tap = Gesture.Tap().onEnd(() => {
    runOnJS(onStartEditing)(box.id);
  });

  const gesture = Gesture.Race(pan, tap);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
  }));

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width, height });
  };

  // A soft legibility shadow, always on rather than a user-facing toggle —
  // it's the cheapest available help against a busy or low-contrast patch
  // of background photo, and falls on whichever side actually adds
  // contrast for the chosen text color (see isLightTextColor).
  const shadowColor = isLightTextColor(textColor) ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.75)';
  const textStyle = {
    color: textColor,
    fontSize,
    lineHeight,
    textAlign: box.align,
    fontFamily,
    fontStyle,
    fontWeight,
    textShadowColor: shadowColor,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  };

  // While editing, the TextInput is deliberately NOT wrapped in a
  // GestureDetector at all — not even a disabled one. Even a disabled
  // gesture's underlying native recognizer can still intercept the
  // initial touch on iOS before yielding, which is enough to disrupt the
  // TextInput's own selection recognizers (cursor placement, drag-to-
  // select, the Cut/Copy/Paste menu). Dragging the box only makes sense
  // when it isn't focused anyway, so nothing is lost by only mounting the
  // gesture wrapper for the read-only state.
  if (isEditing) {
    return (
      <Animated.View style={[styles.box, { maxWidth }, animatedStyle]} onLayout={handleLayout}>
        <TextInput
          style={[styles.text, textStyle]}
          value={box.text}
          onChangeText={(text) => onChangeText(box.id, text)}
          multiline
          autoFocus
          placeholder="Type something…"
          placeholderTextColor="#6a6050"
        />
      </Animated.View>
    );
  }

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.box, { maxWidth }, animatedStyle]} onLayout={handleLayout}>
        <Text style={[styles.text, textStyle]}>{box.text}</Text>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  box: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  text: {
    padding: 0,
  },
});
