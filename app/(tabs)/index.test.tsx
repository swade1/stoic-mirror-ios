import React from 'react';
import { render, screen } from '@testing-library/react-native';
import CounselScreen from './index';

jest.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: {
    requestPermissionsAsync: jest.fn(),
    stop: jest.fn(),
    start: jest.fn(),
  },
  useSpeechRecognitionEvent: jest.fn(),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useFocusEffect: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
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
  it('exposes an accessible label for the mic button that reflects listening state', () => {
    render(<CounselScreen />);

    const micButton = screen.getByLabelText('Start voice input');
    expect(micButton.props.accessibilityRole).toBe('button');
    expect(micButton.props.accessibilityState).toEqual({ selected: false });
  });
});
