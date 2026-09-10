import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ScaledText } from './ScaledText';
import { FontScaleContext } from '@/contexts/FontScaleContext';

describe('ScaledText', () => {
  it('multiplies fontSize and lineHeight by the current font scale', () => {
    render(
      <FontScaleContext.Provider value={{ fontScale: 1.3, setFontScale: jest.fn() }}>
        <ScaledText style={{ fontSize: 20, lineHeight: 28, color: 'red' }}>Hello</ScaledText>
      </FontScaleContext.Provider>
    );

    const text = screen.getByText('Hello');
    const flatStyle = Array.isArray(text.props.style)
      ? Object.assign({}, ...text.props.style)
      : text.props.style;

    expect(flatStyle.fontSize).toBeCloseTo(26);
    expect(flatStyle.lineHeight).toBeCloseTo(36.4);
    expect(flatStyle.color).toBe('red');
  });

  it('leaves style untouched when no fontSize/lineHeight is provided', () => {
    render(
      <FontScaleContext.Provider value={{ fontScale: 1.3, setFontScale: jest.fn() }}>
        <ScaledText style={{ color: 'blue' }}>No size</ScaledText>
      </FontScaleContext.Provider>
    );

    const text = screen.getByText('No size');
    const flatStyle = Array.isArray(text.props.style)
      ? Object.assign({}, ...text.props.style)
      : text.props.style;

    expect(flatStyle.fontSize).toBeUndefined();
    expect(flatStyle.color).toBe('blue');
  });

  it('defaults to scale 1 (no change) outside a provider', () => {
    render(<ScaledText style={{ fontSize: 10 }}>Default</ScaledText>);

    const text = screen.getByText('Default');
    const flatStyle = Array.isArray(text.props.style)
      ? Object.assign({}, ...text.props.style)
      : text.props.style;

    expect(flatStyle.fontSize).toBe(10);
  });
});
