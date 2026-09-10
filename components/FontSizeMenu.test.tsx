import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { FontSizeMenu } from './FontSizeMenu';
import { FontScaleContext } from '@/contexts/FontScaleContext';

describe('FontSizeMenu', () => {
  it('marks the current scale as selected and calls setFontScale when another step is chosen', () => {
    const setFontScale = jest.fn();

    render(
      <FontScaleContext.Provider value={{ fontScale: 1.0, setFontScale }}>
        <FontSizeMenu visible onClose={jest.fn()} anchorTop={100} />
      </FontScaleContext.Provider>
    );

    const defaultOption = screen.getByRole('radio', { name: 'Default' });
    expect(defaultOption.props.accessibilityState).toEqual({ selected: true });

    const largeOption = screen.getByRole('radio', { name: 'Large' });
    expect(largeOption.props.accessibilityState).toEqual({ selected: false });

    fireEvent.press(largeOption);
    expect(setFontScale).toHaveBeenCalledWith(1.15);
  });

  it('closes when the backdrop is pressed', () => {
    const onClose = jest.fn();

    render(
      <FontScaleContext.Provider value={{ fontScale: 1.0, setFontScale: jest.fn() }}>
        <FontSizeMenu visible onClose={onClose} anchorTop={100} />
      </FontScaleContext.Provider>
    );

    fireEvent.press(screen.getByLabelText('Close text size menu'));
    expect(onClose).toHaveBeenCalled();
  });
});
