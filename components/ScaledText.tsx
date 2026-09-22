import React, { useState } from 'react';
import { Text, StyleSheet, type TextProps, type TextStyle, type NativeSyntheticEvent, type TextLayoutEventData } from 'react-native';
import { useFontScale } from '@/contexts/FontScaleContext';

// Applies the user's in-app reading-size preference to fontSize AND
// lineHeight together — scaling only one reproduces the cramped/
// overlapping-line risk the accessibility pass audited for. Leaves
// allowFontScaling on (the default) so iOS's own Dynamic Type still
// applies on top for accessibility users, but caps the combined result
// so the two mechanisms can't compound into something absurd.
//
// Also guards against a real bug found in an auto-growing container
// around this text: word-wrapping isn't smooth as font size changes — it
// jumps a whole line at specific thresholds — and at one such threshold
// (confirmed at this app's "Large" in-app text-size step specifically,
// not Small/Default/Extra Large) the container's own layout pass
// undercounted the newly-added line, silently clipping it with no visual
// sign anything was wrong. onTextLayout's reported line count has proven
// reliable across every test (unlike the height/position values RN
// reports alongside it), so minHeight below is driven from that count
// times a theoretical per-line height plus a 10% safety margin, rather
// than trusting any single measured height figure. Meant only for the
// specific reading-content call sites (quotes, interpretations, concern
// text) — not a general Text replacement.
export function ScaledText({ style, onTextLayout, ...rest }: TextProps) {
  const { fontScale } = useFontScale();
  const flat: TextStyle = StyleSheet.flatten(style) || {};
  const scaledStyle: TextStyle = {};
  if (typeof flat.fontSize === 'number') scaledStyle.fontSize = flat.fontSize * fontScale;
  if (typeof flat.lineHeight === 'number') scaledStyle.lineHeight = flat.lineHeight * fontScale;

  const [minHeight, setMinHeight] = useState<number | undefined>(undefined);

  const handleTextLayout = (e: NativeSyntheticEvent<TextLayoutEventData>) => {
    if (typeof flat.lineHeight === 'number') {
      const theoreticalLineHeight = flat.lineHeight * fontScale;
      const safeHeight = e.nativeEvent.lines.length * theoreticalLineHeight * 1.1;
      // Only updates on a real change — onTextLayout re-fires once
      // minHeight itself is applied, and re-setting the same value on
      // every one of those would otherwise loop.
      setMinHeight((prev) => (prev === safeHeight ? prev : safeHeight));
    }
    onTextLayout?.(e);
  };

  return (
    <Text
      style={[style, scaledStyle, minHeight !== undefined && { minHeight }]}
      onTextLayout={handleTextLayout}
      maxFontSizeMultiplier={1.3}
      {...rest}
    />
  );
}
