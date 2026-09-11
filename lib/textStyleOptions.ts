export const TEXT_COLOR_OPTIONS = [
  { label: 'Cream', value: '#f0ead6' },
  { label: 'White', value: '#ffffff' },
  { label: 'Black', value: '#0f0e0c' },
  { label: 'Gold', value: '#c9b97a' },
] as const;

export const DEFAULT_TEXT_COLOR: string = TEXT_COLOR_OPTIONS[0].value;

export const TEXT_SIZE_STEPS = [
  { label: 'Small', value: 0.8 },
  { label: 'Medium', value: 1.0 },
  { label: 'Large', value: 1.25 },
] as const;

export const DEFAULT_TEXT_SIZE_SCALE = 1.0;
