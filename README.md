# Starter Story Build Course Boilerplate (iOS + Cursor Bootcamp)

This is the official boilerplate for the **Starter Story Build Course** (iOS + Cursor Bootcamp). It provides a modern Expo + Expo Router + Supabase + Jotai starter template for students to learn and build production-quality mobile apps.

## Features

- **Onboarding Flow Example:** Multi-step onboarding with explainer screens, personalization questions, and animated transitions.
- **Authentication Example:** Sign up and login with Supabase Auth. Auth state persists and controls navigation.
- **Personalization Example:** User answers are stored with Jotai and used to demonstrate global state management.
- **Modern UI:** Consistent, mobile-friendly design with custom components and theming.
- **File-based Routing:** Easy navigation and screen management with Expo Router.

## Getting Started

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Start the app**
   ```bash
   npx expo start
   ```
   - Open in iOS Simulator, Android Emulator, or Expo Go as prompted.

3. **Configure Supabase**
   - Add your Supabase project URL and anon key to `lib/supabase.ts` if not already set.

## Project Structure

- `app/` — All screens and navigation (file-based routing)
- `app/_layout.tsx` — Root layout, handles auth state and navigation stack
- `app/(tabs)/` — Main app tabs (shown when signed in)
- `app/onboarding*.tsx` — Onboarding screens (example)
- `app/personalization.tsx` — Personalization questions (example)
- `app/PersonalizingScreen.tsx` — Animated personalizing screen (example)
- `app/signup.tsx`, `app/login.tsx` — Auth screens (example)
- `lib/atoms.ts` — Jotai atoms for global state
- `lib/supabase.ts` — Supabase client setup

## State Management
- **Jotai** is used for global state (e.g., storing personalization answers as an example).
- **Supabase Auth** persists user sessions and controls which navigation stack is shown.

## Customization
- Edit screens in `app/` to change onboarding, questions, or main app content.
- Update styles in each screen's `StyleSheet` for branding or assignments.

## Learn More
- [Expo documentation](https://docs.expo.dev/)
- [Expo Router docs](https://expo.github.io/router/docs/)
- [Supabase docs](https://supabase.com/docs)
- [Jotai docs](https://jotai.org/docs)

---

Built for the Starter Story Build Course (iOS + Cursor Bootcamp) 🚀
