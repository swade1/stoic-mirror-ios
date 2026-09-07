import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import Login from './login';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
      resetPasswordForEmail: jest.fn(),
    },
  },
}));

describe('Login', () => {
  it('exposes an accessible label for the password toggle that reflects its state', () => {
    render(<Login />);

    const toggle = screen.getByLabelText('Show password');
    expect(toggle.props.accessibilityRole).toBe('button');

    fireEvent.press(toggle);

    expect(screen.getByLabelText('Hide password')).toBeTruthy();
  });
});
