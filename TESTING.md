# Manual Regression Checklist

There's no end-to-end test automation for this app yet (see CI — `.github/workflows/ci.yml` — for what *is* automated: type checking, lint, and unit tests for the pure-logic pieces in `lib/`). Everything below has to be walked through by hand.

Run this before any TestFlight build or App Store submission, and after any change that touches auth, navigation, or the counsel/payment flow — those are where a fix in one place has repeatedly broken something else this session.

Use a throwaway test account (Gmail `+alias` trick) for anything that creates or deletes an account, never your real one.

## Onboarding → account creation

- [ ] Fresh install, no account: lands on `onboarding1`, not any tab
- [ ] `onboarding1` → `onboarding2` → pick 1+ concerns → `onboarding3` shows personalized copy matching the concern picked
- [ ] `onboarding2`'s "Skip" goes to `onboarding3` (not straight to signup)
- [ ] `onboarding3` → "See my plan" → paywall
- [ ] Paywall's "Start free trial" → signup
- [ ] Login screen's "Don't have an account? Create one" → `onboarding1` (not straight to signup)
- [ ] Signup with a new email → lands in the Counsel tab
- [ ] Signup with an email that's already registered → "Account Already Exists" alert, not silent failure
- [ ] If email confirmation is enabled in Supabase: signup shows "Check Your Email" and routes to login, not silent failure
- [ ] Cannot reach `(tabs)`, `/loading`, `/detail`, or `/concerns` while signed out, by any path

## Sign in / sign out / account

- [ ] Sign in with correct credentials → Counsel tab
- [ ] Sign in with wrong password → clear error
- [ ] Forgot password → reset email flow
- [ ] Sign out → login screen, cannot navigate back into tabs
- [ ] Change Password: wrong current password → rejected; correct → succeeds, returns to Settings (not Counsel tab)
- [ ] Delete Account: confirmation alert mentions exporting data first; after confirming, account and all rows (`entries`, `entry_quotes`, `saved_quotes`, `profiles`) are gone; lands on login

## Core counsel flow

- [ ] Submit a concern with a network connection → passages + interpretations appear, entry saved
- [ ] Submit a concern with no network → "No Connection" message, not a raw error
- [ ] Save a quote → appears in History
- [ ] Save all quotes → all appear in History
- [ ] Un-save a quote → disappears from History
- [ ] Submitting similar concerns repeatedly doesn't repeat the same passages verbatim (passage exclusion working)
- [ ] After the 3rd entry: App Store rating prompt fires once (physical device only — doesn't reliably show in Simulator)

## Settings

- [ ] "Your concerns" reflects and saves the current selection
- [ ] "Export your data" produces a readable Markdown file via the share sheet, with concerns/entries/saved quotes all in plaintext (not ciphertext)
- [ ] "Notifications" toggles and time/day pickers save and persist across a re-open of the screen
- [ ] "Subscription" row opens Apple's subscription management (physical device only)
- [ ] "Delete Account" is in its own section, visually separated from "Sign Out"

## Notifications (local, no server needed)

- [ ] Daily reminder fires at the chosen time with today's quote
- [ ] Re-engagement nudge reschedules further out every time the app is foregrounded; fires if left untouched
- [ ] Tapping either notification opens the app directly to the Counsel tab, regardless of what screen was last open

## Website (stoicmirror.com)

- [ ] Privacy Policy and Terms of Service links resolve and match the in-app copy
- [ ] Account deletion wording matches actual in-app behavior (self-service, not "contact us")

## Before every release build specifically

- [ ] `npx tsc --noEmit -p .` and `npx expo lint` both clean (CI already gates this on push, but confirm locally if working on a branch)
- [ ] `npm test` passing
- [ ] Full rebuild (`npx expo run:ios`), not just a reload — catches native-linking issues a JS reload would hide
