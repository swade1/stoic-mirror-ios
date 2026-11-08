import * as Notifications from 'expo-notifications';
import { supabase } from '@/lib/supabase';
import { getDailyQuoteId } from '@/lib/dailyQuote';
import { formatTrialDate } from '@/lib/trial';

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

  // index is a 1-indexed position among all rows ordered by id, not a
  // literal id value — see the matching note in app/(tabs)/index.tsx.
  const { data } = await supabase
    .from('daily_quotes')
    .select('quote, author')
    .order('id', { ascending: true })
    .range(index - 1, index - 1)
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

export const TRIAL_ENDING_ID = 'trial-ending-reminder';
// Apple renews unless the user cancels at least 24 hours before the trial
// ends, so a reminder sent exactly 24 hours before would arrive at the
// deadline. 48 hours before leaves a full day to act on it.
const TRIAL_REMINDER_LEAD_MS = 48 * 60 * 60 * 1000;

/**
 * Schedules the "your free trial ends in 2 days" reminder, the one the
 * paywall promises ("We'll remind you before your trial ends"). Fires 48
 * hours before `trialEnd`. Asks for notification permission if
 * it hasn't been granted yet. Says what happened, so the caller can tell the
 * user when notifications are off: 'scheduled', 'denied' (permission
 * declined), or 'too-late' (the reminder time has already passed).
 */
export type TrialReminderResult = 'scheduled' | 'denied' | 'too-late';

export async function scheduleTrialEndReminder(trialEnd: Date): Promise<TrialReminderResult> {
  const fireAt = new Date(trialEnd.getTime() - TRIAL_REMINDER_LEAD_MS);
  if (fireAt.getTime() <= Date.now()) return 'too-late';
  if (!(await requestNotificationPermission())) return 'denied';

  await Notifications.cancelScheduledNotificationAsync(TRIAL_ENDING_ID);
  await Notifications.scheduleNotificationAsync({
    identifier: TRIAL_ENDING_ID,
    content: {
      title: 'Your free trial ends in 2 days',
      body: `Cancel by the end of today to avoid being charged. You'll keep full access until ${formatTrialDate(trialEnd)}.`,
      sound: true,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt },
  });
  return 'scheduled';
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
