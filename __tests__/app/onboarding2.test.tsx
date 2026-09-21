import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import Onboarding2 from '@/app/onboarding2';
import { CONCERN_OPTIONS } from '@/lib/concerns';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

describe('Onboarding2', () => {
  it('exposes accessibilityState.checked on a reason chip that toggles with selection', () => {
    render(<Onboarding2 />);
    const reason = CONCERN_OPTIONS[0];

    const chip = screen.getByRole('checkbox', { name: reason });
    expect(chip.props.accessibilityState).toEqual({ checked: false });

    fireEvent.press(chip);

    expect(screen.getByRole('checkbox', { name: reason }).props.accessibilityState).toEqual({ checked: true });
  });
});
