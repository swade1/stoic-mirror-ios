import type { TextStyle } from 'react-native';

export const TEXT_COLOR_OPTIONS = [
  { label: 'Cream', value: '#f0ead6' },
  { label: 'White', value: '#ffffff' },
  { label: 'Black', value: '#0f0e0c' },
  { label: 'Gold', value: '#c9b97a' },
  { label: 'Charcoal', value: '#2a2620' },
  { label: 'Sand', value: '#d9c7a3' },
  { label: 'Terracotta', value: '#c17a52' },
  { label: 'Rust', value: '#9c4a3c' },
  { label: 'Wine', value: '#6b3244' },
  { label: 'Dusty Rose', value: '#c99b8e' },
  { label: 'Forest', value: '#4a5d43' },
  { label: 'Slate', value: '#5c6b7a' },
] as const;

export const DEFAULT_TEXT_COLOR: string = TEXT_COLOR_OPTIONS[0].value;

export const TEXT_SIZE_STEPS = [
  { label: 'Small', value: 0.8 },
  { label: 'Medium', value: 1.0 },
  { label: 'Large', value: 1.25 },
] as const;

export const DEFAULT_TEXT_SIZE_SCALE = 1.0;

export const TEXT_ALIGN_OPTIONS = [
  { label: 'Left', value: 'left' },
  { label: 'Center', value: 'center' },
  { label: 'Right', value: 'right' },
] as const;

export type TextAlignValue = (typeof TEXT_ALIGN_OPTIONS)[number]['value'];

export const DEFAULT_TEXT_ALIGN: TextAlignValue = 'center';

export interface TextFontOption {
  label: string;
  // null is "Classic" — the app's original look, no custom font loaded.
  value: string | null;
  fontFamily: string | undefined;
  fontStyle: 'normal' | 'italic';
  fontWeight: TextStyle['fontWeight'];
}

// A custom fontFamily already bakes in its own weight and style (the
// exact Google Fonts export loaded in app/_layout.tsx, e.g.
// "PlayfairDisplay_600SemiBold_Italic") — pairing it with a *different*
// fontWeight/fontStyle here would make iOS look for a variant of that
// exact PostScript name that doesn't exist and silently fall back to a
// system font instead of the one just picked. Only "Classic" (no custom
// fontFamily) uses fontWeight/fontStyle to style the system font, same as
// this app always has.
export const TEXT_FONT_OPTIONS: TextFontOption[] = [
  { label: 'Classic', value: null, fontFamily: undefined, fontStyle: 'italic', fontWeight: '600' },
  { label: 'Playfair', value: 'playfair', fontFamily: 'PlayfairDisplay_600SemiBold_Italic', fontStyle: 'normal', fontWeight: 'normal' },
  { label: 'Cormorant', value: 'cormorant', fontFamily: 'Cormorant_600SemiBold_Italic', fontStyle: 'normal', fontWeight: 'normal' },
  { label: 'Cinzel', value: 'cinzel', fontFamily: 'Cinzel_600SemiBold', fontStyle: 'normal', fontWeight: 'normal' },
  { label: 'Baskerville', value: 'baskerville', fontFamily: 'LibreBaskerville_600SemiBold_Italic', fontStyle: 'normal', fontWeight: 'normal' },
];

export const DEFAULT_TEXT_FONT: string | null = null;

export function resolveTextFontOption(value: string | null): TextFontOption {
  return TEXT_FONT_OPTIONS.find((f) => f.value === value) ?? TEXT_FONT_OPTIONS[0];
}
