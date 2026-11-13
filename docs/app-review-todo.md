# TODO: App Store review readiness

Status: **not done.** Started 2026-11-11. This is a checklist of things that commonly get an app rejected or delayed, with what the code looks like today. Apple's rules change, so re-read the current App Review Guidelines before submitting.

## Likely blockers

- [ ] **Real purchases (guideline 3.1.1 / 3.1.2).** Reviewers will try the free trial and purchase. Today the paywall button only goes to sign-up; RevenueCat is not wired to real entitlements, and Settings shows a hard-coded "Free". Needs the real purchase flow, the 3-day trial set in App Store Connect and RevenueCat, and a working path past the paywall. See `docs/trial-emails-todo.md`.
- [ ] **Restore Purchases.** There is no Restore Purchases button in the app (checked `app/paywall.tsx` and Settings). Apple expects one for subscriptions.
- [ ] **Subscription disclosures on the paywall.** Show price, trial length, renewal terms and cancellation clearly, with working **Terms of Use** and **Privacy Policy** links on the paywall itself (none there today; the pages exist at `app/terms.tsx`, `app/privacy.tsx`).
- [ ] **Disclose AI sharing and ask permission (guideline 5.1.2).** As I understand Apple's updated rules, an app that sends personal data to a third-party AI service must say so clearly and get the user's permission first. Counsel sends the user's concern text to Anthropic (and a derived embedding request to Voyage). The privacy policy already names both, but there is no consent step before the first counsel request. Consider a short one-time consent screen. **Verify the current wording of the guideline.**
- [ ] **Reviewer access.** Put a demo account (or clear steps) and a note about the free trial and the photos/notification prompts in App Review Notes. Reviewers should not have to buy anything to see the app.

## Cleanup

- [ ] **Remove unused microphone and speech-recognition permissions.** `NSMicrophoneUsageDescription` and `NSSpeechRecognitionUsageDescription` are declared in `app.json` and `Info.plist`, and the `expo-speech-recognition` plugin is still installed, but nothing uses them since the one-tap mic was removed. Also check whether the `expo-audio` plugin adds its own microphone string by default (turn that off; the app only plays audio). Needs a fresh Xcode build afterwards.
- [ ] **Permission wording.** Each purpose string should say exactly why. Photos: the current text only mentions choosing a photo for a quote card, but the app also saves cards to Photos and uses photos in slideshows (see `NSPhotoLibraryUsageDescription` and `NSPhotoLibraryAddUsageDescription`).
- [ ] **Export compliance.** `ITSAppUsesNonExemptEncryption` is not set in `app.json` or `Info.plist`. The app encrypts concerns on the phone, so answer the encryption questions in App Store Connect (and set the key) deliberately.

## Before launch, optional

- [ ] **Sign in with Apple.** Not required for review (email and password alone passes), but it likely improves sign-ups from the launch wave, since it is one tap with no password. Estimated about a day of work plus one fresh Xcode build. Adding Google or another third-party login later would make Apple sign-in mandatory.
  - **Code:** install `expo-apple-authentication` and add the entitlement in `app.json`; add the "Continue with Apple" button to `app/login.tsx` and `app/signup.tsx`; call `supabase.auth.signInWithIdToken`; run the trial setup (pending trial welcome note and profile row, now in `app/signup.tsx`) for first-time Apple users; add Jest tests.
  - **No changes needed:** concern encryption (keyed on the Supabase user ID), account deletion (`delete_own_account`) and navigation after sign-in (`onAuthStateChange` in `app/_layout.tsx`).
  - **Susan's tasks:** enable Sign in with Apple for `com.stoicmirror.app` in the Apple Developer account; enable the Apple provider in Supabase with the bundle ID as the client ID.
  - **Watch for:** people who hide their email get an Apple relay address, so trial emails through Resend need the sending domain registered with Apple; it only works on a physical device, not the Simulator; check Supabase's account-linking setting for people who already have an email account with the same address.

## Verify in App Store Connect

- [ ] **App Privacy ("nutrition labels").** Must match reality: email, saved concerns (encrypted on the phone), usage, and data sent to Anthropic and Voyage.
- [ ] **Privacy Policy URL** and **Support URL** set and working (`stoicmirror.com`).
- [ ] **Age rating questionnaire** answered honestly (reflection on personal struggles).
- [ ] **Screenshots and description** match the real app. No "coming soon" text, no features the app doesn't have.
- [ ] **Music and image rights.** Keep records that the ambient tracks and background photos can be used commercially. Any modern Stoic translations (re-ingest is on hold) must be public domain or licensed. The current passages use George Long's public-domain translations.

## Already in good shape (re-check before submitting)

- Account deletion exists in Settings (`app/(tabs)/settings.tsx`), which Apple requires for apps with accounts.
- Sign in with Apple is not required: the app uses email and password only, no third-party login.
- Medical disclaimer is in the Terms, Privacy Policy and Settings ("not a substitute for professional mental health support", with emergency guidance).
- `PrivacyInfo.xcprivacy` is present. After the microphone cleanup, rebuild and confirm it still matches.
- Minimum iOS is 15.1; keep testing on a physical device (yours is iOS 15.8.8).

## Worth considering

- **AI-content safety (guideline 1.2 mindset).** Counsel is AI-generated. Some reviewers like a way to report a bad response, and a gentle crisis note if someone writes about self-harm. The Terms cover this in words; an in-app nudge would be stronger.
- **TestFlight first.** A TestFlight round with a few people before submitting catches crashes, which are the most common rejection of all.
