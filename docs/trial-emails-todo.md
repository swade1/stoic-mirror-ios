# TODO: trial reminder and cancellation emails

Status: **not built.** Blocked until RevenueCat (real App Store subscriptions) and the Resend email setup are both ready to use for this.

## What exists today

- The paywall says "We'll remind you 1 day before your trial ends."
- A **local notification** backs that promise: `scheduleTrialEndReminder` in `lib/notifications.ts`, scheduled from `app/trial-started.tsx` right after sign-up. It fires 24 hours before the trial ends.
- If the user declines notification permission, the "trial started" screen says no reminder will come.

## Why that is not enough

- The reminder lives on the phone. It is lost if the user deletes the app or switches devices.
- Deleting the app does **not** cancel the subscription. Apple still charges the Apple ID after the trial unless the user cancels in iPhone Settings.
- The app cannot know a user cancelled, so someone who already cancelled still gets "Your free trial ends tomorrow." That causes the "I cancelled, why is it reminding me?" worry.

## To build, once purchases work

1. **RevenueCat webhook.** A Supabase Edge Function (like `supabase/functions/subscribe`) receives RevenueCat events and records each user's trial start, trial end and cancellation status.
2. **Reminder email.** A daily job (pg_cron or a scheduled function) emails every user whose trial ends within a day and who has **not** cancelled. Send via Resend from `hello@stoicmirror.com`. Include how to manage or cancel in iPhone Settings.
3. **Cancellation email.** When the webhook reports a cancellation, send a friendly message such as "Thanks for trying The Stoic Mirror! Hope to see you back!" Because step 2 skips cancelled users, the reminder is never sent after a cancellation.
4. **Phone reminder as backup.** When the app opens and RevenueCat shows the subscription will not renew, cancel the scheduled local notification (`TRIAL_ENDING_ID`).
5. **Copy check.** Make sure the paywall wording ("We'll remind you...") stays true for the channel(s) actually sent.

## Needs from Susan

- Real subscription products in App Store Connect, connected in RevenueCat (replace the test API key in `app/_layout.tsx`).
- The RevenueCat webhook URL/secret configured, and the trial length set to 3 days in the store product.
