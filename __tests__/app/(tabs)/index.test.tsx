import React from 'react';
import { render, screen } from '@testing-library/react-native';
import CounselScreen from '@/app/(tabs)/index';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useFocusEffect: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@react-navigation/bottom-tabs', () => ({
  useBottomTabBarHeight: () => 0,
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Medium: 'medium' },
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ count: 0 }),
    }),
  },
}));

jest.mock('@/lib/dailyQuote', () => ({
  getDailyQuoteId: jest.fn(() => 0),
}));

describe('CounselScreen', () => {
  it('offers an accessible text box that points users to keyboard dictation', () => {
    render(<CounselScreen />);

    const input = screen.getByLabelText('Describe your concern');
    expect(input.props.placeholder).toMatch(/microphone on your keyboard/i);
  });
});
