import React from 'react';
import { render } from '@testing-library/react-native';
import { IconSymbol } from './IconSymbol';

describe('IconSymbol', () => {
  it('renders without crashing', () => {
    const { toJSON } = render(<IconSymbol name="chevron.right" size={16} color="#c9b97a" />);
    expect(toJSON()).not.toBeNull();
  });
});
