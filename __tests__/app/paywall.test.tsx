import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import PaywallScreen from '@/app/paywall';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe('PaywallScreen', () => {
  it('exposes accessibilityState.selected on plan cards, tracking the chosen plan', () => {
    render(<PaywallScreen />);

    const annualCard = screen.getByLabelText(/Annual plan/);
    const monthlyCard = screen.getByLabelText(/Monthly plan/);

    // Annual is selected by default
    expect(annualCard.props.accessibilityState).toEqual({ selected: true });
    expect(monthlyCard.props.accessibilityState).toEqual({ selected: false });

    fireEvent.press(monthlyCard);

    expect(screen.getByLabelText(/Monthly plan/).props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByLabelText(/Annual plan/).props.accessibilityState).toEqual({ selected: false });
  });
});
