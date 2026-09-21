import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { IconButton } from './IconButton';

describe('IconButton', () => {
  it('shows the tooltip once onLongPress fires, and hides it on release', () => {
    render(
      <IconButton accessibilityLabel="Back to History" accessibilityRole="button" onPress={() => {}}>
        <Text>icon</Text>
      </IconButton>
    );

    expect(screen.queryByText('Back to History')).toBeNull();

    fireEvent(screen.getByRole('button'), 'longPress');
    expect(screen.getByText('Back to History')).toBeTruthy();

    fireEvent(screen.getByRole('button'), 'pressOut');
    expect(screen.queryByText('Back to History')).toBeNull();
  });

  it('still calls onPress for a normal tap', () => {
    const onPress = jest.fn();
    render(
      <IconButton accessibilityLabel="Back to History" accessibilityRole="button" onPress={onPress}>
        <Text>icon</Text>
      </IconButton>
    );

    fireEvent(screen.getByRole('button'), 'press');
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
