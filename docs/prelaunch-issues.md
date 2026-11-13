# TODO: outstanding issues before launch

Status: **open.** Collected 2026-11-13. The click-through video for stoicmirror.com does not depend on these (see the last section). Everything below must be settled before the App Store submission. The App Review checklist has more detail: `docs/app-review-todo.md`.

## Screens that must change

- [ ] **Paywall.** Add Restore Purchases and Terms/Privacy links. The button currently only goes to sign-up; it must start a real purchase.
- [ ] **Settings, Subscription row.** Shows a hard-coded "Free". Wire it to the real RevenueCat entitlement.
- [ ] **AI consent screen.** One-time screen before the first counsel request, explaining that concerns go to Anthropic (and Voyage). Verify Apple's current wording.
- [ ] **Microphone and speech permissions.** Remove the unused declarations and the `expo-speech-recognition` plugin; check `expo-audio` for its own microphone string. Needs a fresh Xcode build.

## Decisions waiting on Susan

- [ ] **"Already used for a slide" indicator.** Waiting on Susan's user. Options: an "On a slide" tag in History, a marker in the Saved Quotes picker (`app/slideshow-add-quote.tsx`), or both.
- [ ] **History list view.** Planned and prototyped, deferred. Susan said "later", not "no".
- [ ] **Sign in with Apple.** Optional item in `docs/app-review-todo.md`.

## Check on a physical iPhone

- [ ] Subscription row in Settings.
- [ ] Personal audio picker (document picker).
- [ ] Long-press tooltip on icons (never appeared in the Simulator).
- [ ] Video export speed.
- [ ] "Open Settings" line when Photos access is limited (set Settings → Photos → Selected Photos, then add a photo that was not shared).

## Smaller items

- [ ] Counsel takes about 8–9 seconds. Watch during TestFlight; investigate if it feels slow.
- [ ] `docs/stoicmirror-com-content.md` still says a 7-day trial. The trial is 3 days.
- [ ] Trial reminder and cancellation emails (`docs/trial-emails-todo.md`): RevenueCat webhook and Resend.
- [ ] Set the 3-day trial in App Store Connect and RevenueCat.
- [ ] Modern translations re-ingest is on hold; Epictetus passage rows have a blank `section`.

## Not blocking the click-through video

The recording plan in `docs/video-shot-list.md` uses a test account and skips sign-up. It covers Counsel, History and the slideshow flow. It does not show the paywall, Settings, Subscription or the AI consent screen, so none of the screen changes above need to be done first.
