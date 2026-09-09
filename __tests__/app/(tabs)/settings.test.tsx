import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import SettingsScreen from '@/app/(tabs)/settings';

const mockReact = React;

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useFocusEffect: (cb: () => void | (() => void)) => mockReact.useEffect(cb, []),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@/lib/exportData', () => ({
  exportUserData: jest.fn(),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(() =>
        Promise.resolve({
          data: {
            session: {
              user: { id: 'u1', email: 'test@example.com', created_at: '2026-01-01T00:00:00Z' },
            },
          },
        })
      ),
    },
    from: () => ({
      select: () => ({
        eq: () => Promise.resolve({ count: 0 }),
      }),
    }),
  },
}));

describe('SettingsScreen', () => {
  it('exposes a full-text accessibility label for the truncated subscription row', async () => {
    render(<SettingsScreen />);

    const subscriptionRow = await waitFor(
      () => screen.getByLabelText('Subscription: Free'),
      { timeout: 10000 }
    );
    expect(subscriptionRow.props.accessibilityRole).toBe('button');
  }, 15000);
});
