import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type PressableProps } from 'react-native';

// Drop-in replacement for TouchableOpacity at icon-only buttons — same prop
// surface (onPress, accessibilityLabel, accessibilityRole, accessibilityState,
// hitSlop, style, disabled, children), so migrating a call site is a pure
// rename. Shows accessibilityLabel verbatim as a tooltip on two triggers:
//
// - Hover, for a pointer-driven surface (Simulator + trackpad/mouse, or the
//   web build) — a finger on a touchscreen has no hover state at all, so
//   this half is purely a testing/web convenience, never seen by a real
//   iPhone user.
// - Long-press, which is the real-device answer: touch and hold past
//   delayLongPress to preview the label, without triggering the button.
//   This relies on Pressable's own guarantee that onPress does NOT also
//   fire once onLongPress has fired for the same touch — so a quick tap
//   still activates the button exactly as before, and holding past the
//   threshold safely previews it instead of activating it. Lifting after
//   the preview does nothing; tapping again (a fresh, quick touch) is what
//   actually fires onPress.
//
// RN's own delayHoverIn/delayHoverOut Pressable props exist but are
// macos/windows-only per the installed react-native types, so the hover
// side's ~350ms pause before showing is a manual timer here instead.
const HOVER_DELAY_MS = 350;
const LONG_PRESS_DELAY_MS = 500;

// Every call site passes plain JSX (an IconSymbol), never the render-prop
// form Pressable's own type allows — narrowing children here keeps that
// out rather than propagating it into every rename call site.
type IconButtonProps = Omit<PressableProps, 'children'> & { children?: React.ReactNode };

export function IconButton({
  accessibilityLabel,
  style,
  children,
  onLongPress,
  onPressOut,
  ...rest
}: IconButtonProps) {
  const [hovered, setHovered] = useState(false);
  const [pressPreview, setPressPreview] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
  }, []);

  const handleHoverIn = () => {
    hoverTimerRef.current = setTimeout(() => setHovered(true), HOVER_DELAY_MS);
  };

  const handleHoverOut = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setHovered(false);
  };

  const showTooltip = hovered || pressPreview;

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      onHoverIn={handleHoverIn}
      onHoverOut={handleHoverOut}
      delayLongPress={LONG_PRESS_DELAY_MS}
      onLongPress={(e) => {
        setPressPreview(true);
        onLongPress?.(e);
      }}
      onPressOut={(e) => {
        setPressPreview(false);
        onPressOut?.(e);
      }}
      style={style}
      {...rest}
    >
      {children}
      {showTooltip && accessibilityLabel && (
        <View style={styles.tooltip} pointerEvents="none">
          <Text style={styles.tooltipText} numberOfLines={1}>{accessibilityLabel}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tooltip: {
    position: 'absolute',
    top: '100%',
    marginTop: 6,
    left: 0,
    backgroundColor: '#1e1c18',
    borderWidth: 1,
    borderColor: '#4a4540',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    zIndex: 1000,
    elevation: 8,
  },
  tooltipText: {
    color: '#f0ead6',
    fontSize: 12,
  },
});
