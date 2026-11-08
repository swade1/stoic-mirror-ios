import * as Notifications from 'expo-notifications';
import { scheduleTrialEndReminder, TRIAL_ENDING_ID } from '@/lib/notifications';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/lib/dailyQuote', () => ({ getDailyQuoteId: jest.fn() }));
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  SchedulableTriggerInputTypes: { DATE: 'date', DAILY: 'daily', TIME_INTERVAL: 'timeInterval' },
}));

const mockN = Notifications as jest.Mocked<typeof Notifications>;
const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => {
  jest.clearAllMocks();
  mockN.getPermissionsAsync.mockResolvedValue({ granted: true } as never);
});

describe('scheduleTrialEndReminder', () => {
  it('schedules a reminder 24 hours before the trial ends', async () => {
    const trialEnd = new Date(Date.now() + 3 * DAY);
    await expect(scheduleTrialEndReminder(trialEnd)).resolves.toBe('scheduled');
    const request = mockN.scheduleNotificationAsync.mock.calls[0][0] as {
      identifier: string;
      trigger: { date: Date };
    };
    expect(request.identifier).toBe(TRIAL_ENDING_ID);
    expect(request.trigger.date.getTime()).toBe(trialEnd.getTime() - DAY);
  });

  it('asks for permission and schedules nothing when it is declined', async () => {
    mockN.getPermissionsAsync.mockResolvedValue({ granted: false } as never);
    mockN.requestPermissionsAsync.mockResolvedValue({ granted: false } as never);
    await expect(scheduleTrialEndReminder(new Date(Date.now() + 3 * DAY))).resolves.toBe('denied');
    expect(mockN.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('skips a reminder whose time has already passed', async () => {
    await expect(scheduleTrialEndReminder(new Date(Date.now() + DAY / 2))).resolves.toBe('too-late');
    expect(mockN.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});
