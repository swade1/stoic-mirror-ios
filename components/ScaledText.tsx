import React from 'react';
import { Text, StyleSheet, type TextProps, type TextStyle } from 'react-native';
import { useFontScale } from '@/contexts/FontScaleContext';

// Applies the user's in-app reading-size preference to fontSize AND
// lineHeight together — scaling only one reproduces the cramped/
// overlapping-line risk the accessibility pass audited for. Leaves
// allowFontScaling on (the default) so iOS's own Dynamic Type still
// applies on top for accessibility users, but caps the combined result
// so the two mechanisms can't compound into something absurd. Meant
// only for the specific reading-content call sites (quotes,
// interpretations, concern text) — not a general Text replacement.
export function ScaledText({ style, ...rest }: TextProps) {
  const { fontScale } = useFontScale();
  const flat: TextStyle = StyleSheet.flatten(style) || {};
  const scaledStyle: TextStyle = {};
  if (typeof flat.fontSize === 'number') scaledStyle.fontSize = flat.fontSize * fontScale;
  if (typeof flat.lineHeight === 'number') scaledStyle.lineHeight = flat.lineHeight * fontScale;

  return <Text style={[style, scaledStyle]} maxFontSizeMultiplier={1.3} {...rest} />;
}
