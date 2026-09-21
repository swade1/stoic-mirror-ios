import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { IconButton } from '@/components/ui/IconButton';

interface Props {
  id: string;
  uri: string;
  index: number;
  count: number;
  columnCount: number;
  cellSize: number;
  activeId: string | null;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDrop: (fromIndex: number, toIndex: number) => void;
  onRemove: (id: string) => void;
  // Fired on the very first touch-down (before activateAfterLongPress's
  // wait even begins) and again whenever that touch sequence ends for any
  // reason (drag, tap, or cancel) — see the pan gesture below for why the
  // parent needs these to lock the surrounding ScrollView.
  onTouchBegin: () => void;
  onTouchEnd: () => void;
  // Present only when this slide was added via "From Saved Quotes" (has a
  // linked saved_quotes row) — shows a second icon that opens it for
  // editing. Absent for a plain photo, since there's nothing to edit.
  onEdit?: () => void;
}

// One square tile in the slideshow's photo grid, draggable to reorder —
// mirroring DraggableTextBox's reasoning exactly: useSharedValue must be
// called a fixed number of times per component, so a variable-length grid
// of draggable tiles needs one component instance per tile, not
// hand-declared shared values in the parent.
//
// react-native-draggable-flatlist (tried first) turned out not to actually
// support numColumns — its drag math assumes one item per row, so dragging
// the first tile dragged the whole row with it. This hand-built version
// exists because that library's grid support doesn't.
export function DraggableGridTile({
  id,
  uri,
  index,
  count,
  columnCount,
  cellSize,
  activeId,
  onDragStart,
  onDragEnd,
  onDrop,
  onRemove,
  onTouchBegin,
  onTouchEnd,
  onEdit,
}: Props) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const isActive = activeId === id;

  // Drop-target math runs as a plain JS callback (via runOnJS), not inside
  // the worklet — it only needs to happen once, at release, using this
  // render's current index/cellSize/columnCount/count, the same way
  // DraggableTextBox's persistPosition reads its render's current
  // cardWidth/box.id after runOnJS hands off. Only the continuous
  // follow-the-finger motion in onUpdate needs to run as a true worklet.
  const handleRelease = (translationX: number, translationY: number) => {
    const originRow = Math.floor(index / columnCount);
    const originCol = index % columnCount;
    const targetCol = Math.min(columnCount - 1, Math.max(0, Math.round(originCol + translationX / cellSize)));
    const maxRow = Math.max(0, Math.ceil(count / columnCount) - 1);
    const targetRow = Math.min(maxRow, Math.max(0, Math.round(originRow + translationY / cellSize)));
    const targetIndex = Math.min(count - 1, targetRow * columnCount + targetCol);
    onDrop(index, targetIndex);
    onDragEnd();
  };

  const pan = Gesture.Pan()
    // Requires a brief hold before the pan engages, so a normal scroll
    // swipe on the surrounding ScrollView isn't captured by a tile's own
    // gesture — matches the screen's "Press and drag a photo to reorder"
    // hint, and is the same reason the ambient-playlist / text-box drags
    // elsewhere in this app don't fire on an ordinary tap.
    .activateAfterLongPress(250)
    // Only one tile can be mid-drag at a time; this disables every other
    // tile's pan for the duration, the same .enabled(!isEditing) technique
    // DraggableTextBox already uses to prevent simultaneous gestures.
    .enabled(activeId === null || isActive)
    // onBegin fires on touch-down, well before activateAfterLongPress's
    // 250ms is up — locking the ScrollView here, not in onStart, closes
    // the exact window where the ScrollView's own native scroll could
    // otherwise win the touch during that wait (a gesture-aware ScrollView
    // alone wasn't enough to stop that race). onFinalize covers every way
    // the touch can end — a completed drag, a released long-press that
    // never moved, or the OS cancelling it — so the lock never gets stuck.
    .onBegin(() => {
      runOnJS(onTouchBegin)();
    })
    .onFinalize(() => {
      runOnJS(onTouchEnd)();
    })
    .onStart(() => {
      runOnJS(onDragStart)(id);
    })
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
    })
    .onEnd((e) => {
      translateX.value = withTiming(0, { duration: 200 });
      translateY.value = withTiming(0, { duration: 200 });
      runOnJS(handleRelease)(e.translationX, e.translationY);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }, { scale: isActive ? 1.05 : 1 }],
    zIndex: isActive ? 10 : 0,
    opacity: isActive ? 0.9 : 1,
  }));

  return (
    <GestureDetector gesture={pan}>
      {/* Outer slot is the full cellSize — the grid-pitch used by handleRelease's
          math above — with an inner 4px inset so tiles visually gap the same
          way the old FlatList's margin: 4 per tile did. */}
      <Animated.View style={[styles.slot, { width: cellSize, height: cellSize }, animatedStyle]}>
        <Animated.View style={styles.tile}>
          <Image source={{ uri }} style={styles.tileImage} contentFit="cover" />
          <IconButton
            style={styles.tileRemove}
            onPress={() => onRemove(id)}
            accessibilityRole="button"
            accessibilityLabel="Remove from slideshow"
            hitSlop={8}
          >
            <IconSymbol name="xmark.circle.fill" size={20} color="#f0ead6" />
          </IconButton>
          {onEdit && (
            <IconButton
              style={styles.tileEdit}
              onPress={onEdit}
              accessibilityRole="button"
              accessibilityLabel="Edit this quote card"
              hitSlop={8}
            >
              <IconSymbol name="square.and.pencil" size={18} color="#f0ead6" />
            </IconButton>
          )}
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  slot: {
    padding: 4,
  },
  tile: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  tileImage: {
    width: '100%',
    height: '100%',
  },
  tileRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  tileEdit: {
    position: 'absolute',
    bottom: 4,
    right: 4,
  },
});
