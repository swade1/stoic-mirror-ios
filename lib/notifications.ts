import * as Notifications from 'expo-notifications';
import { supabase } from '@/lib/supabase';
import { getDailyQuoteId } from '@/lib/dailyQuote';

export const DAILY_REMINDER_ID = 'daily-reminder';
export const REENGAGEMENT_ID = 'reengagement-nudge';

/** True for notification request identifiers this module schedules, so
 * a tap on either can be routed to the right place in the app. */
export function isReminderNotificationId(identifier: string | undefined | null): boolean {
  return identifier === DAILY_REMINDER_ID || identifier === REENGAGEMENT_ID;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export interface NotificationPrefs {
  daily_reminder_enabled: boolean;
  daily_reminder_hour: number;
  daily_reminder_minute: number;
  reengagement_enabled: boolean;
  reengagement_days: number;
}

export async function requestNotificationPermission(): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  const result = await Notifications.requestPermissionsAsync();
  return result.granted;
}

/**
 * Same deterministic day -> daily_quotes row selection used by the
 * Counsel tab's "quote of the day" (app/(tabs)/index.tsx), via the
 * shared lib/dailyQuote.ts helper so scheduling doesn't depend on that
 * screen being mounted, and the two can't drift apart.
 */
async function getTodaysQuote(): Promise<string | null> {
  const { count } = await supabase
    .from('daily_quotes')
    .select('*', { count: 'exact', head: true });
  if (!count) return null;

  const index = getDailyQuoteId(new Date(), count);

  const { data } = await supabase
    .from('daily_quotes')
    .select('quote, author')
    .eq('id', index)
    .single();

  return data ? `"${data.quote}" — ${data.author}` : null;
}

export async function cancelDailyReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(DAILY_REMINDER_ID);
}

export async function cancelReengagementNudge(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(REENGAGEMENT_ID);
}

export async function scheduleDailyReminder(hour: number, minute: number): Promise<void> {
  await cancelDailyReminder();
  const quoteLine = await getTodaysQuote();
  await Notifications.scheduleNotificationAsync({
    identifier: DAILY_REMINDER_ID,
    content: {
      title: 'Your daily reflection',
      body: quoteLine ?? 'Today\'s reflection is ready in The Stoic Mirror.',
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}

export async function scheduleReengagementNudge(days: number): Promise<void> {
  await cancelReengagementNudge();
  await Notifications.scheduleNotificationAsync({
    identifier: REENGAGEMENT_ID,
    content: {
      title: 'The Stoic Mirror',
      body: "It's been a while — take a moment to check in with yourself.",
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.max(1, days) * 86400,
      repeats: false,
    },
  });
}

/**
 * Not yet wired up anywhere — trial-ending reminders depend on a real
 * trial-start event from RevenueCat, which isn't live yet. Once it is,
 * call this at the moment a trial actually starts.
 */
export async function scheduleTrialReminders(_trialStartDate: Date): Promise<void> {
  // TODO: schedule Day 5 / Day 7 style local reminders relative to
  // _trialStartDate once RevenueCat provides a real trial-start event.
}

/**
 * Reads the signed-in user's notification preferences and brings the
 * device's scheduled local notifications in line with them. Call this
 * on sign-in and whenever the app returns to the foreground, so the
 * daily reminder's quote text stays fresh and the re-engagement nudge
 * keeps getting pushed out while the user is actually using the app.
 */
export async function syncNotificationSchedule(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const { data: profile } = await supabase
    .from('profiles')
    .select('daily_reminder_enabled, daily_reminder_hour, daily_reminder_minute, reengagement_enabled, reengagement_days')
    .eq('id', session.user.id)
    .single<NotificationPrefs>();
  if (!profile) return;

  if (profile.daily_reminder_enabled) {
    await scheduleDailyReminder(profile.daily_reminder_hour, profile.daily_reminder_minute);
  } else {
    await cancelDailyReminder();
  }

  if (profile.reengagement_enabled) {
    await scheduleReengagementNudge(profile.reengagement_days);
  } else {
    await cancelReengagementNudge();
  }
}
