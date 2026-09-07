import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import Onboarding2 from './onboarding2';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

describe('Onboarding2', () => {
  it('exposes accessibilityState.checked on a reason chip that toggles with selection', () => {
    render(<Onboarding2 />);

    const chip = screen.getByRole('checkbox', { name: 'Anxiety & worry' });
    expect(chip.props.accessibilityState).toEqual({ checked: false });

    fireEvent.press(chip);

    expect(screen.getByRole('checkbox', { name: 'Anxiety & worry' }).props.accessibilityState).toEqual({ checked: true });
  });
});
