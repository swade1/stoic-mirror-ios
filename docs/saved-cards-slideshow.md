# Custom photo slideshow

Scoped 2026-09-11, revised 2026-09-19, not yet built. Originally scoped as an in-app "saved cards" gallery that would regenerate each card live from its stored fields. Superseded by a much simpler design once personal photos (session-only, never persisted) made that original approach unable to include them — see "Why this replaced the original design" below.

## The design

Every composed card — curated background or personal photo — already ends up as a flattened PNG in the system Photos library via the existing Save to Photos button. There's no need for the app to store or regenerate anything about the card itself. The slideshow is just: let the user pick, from their own Photos library, which already-saved card images to include, and remember that selection.

**Picking:** a "Build Slideshow" screen launches `expo-image-picker`'s `launchImageLibraryAsync` with `allowsMultipleSelection: true` — the same privacy-friendly, no-broad-permission picker already used for personal photos, just in multi-select mode.

**What gets stored:** not the images — the stable `assetId` each picked `ImagePickerAsset` carries (distinct from its `uri`, which is a temporary file path not reliable across app relaunches). `assetId` references a specific asset in the device's Photos library.

**Where it's stored:** Supabase, in a new table:

```sql
create table slideshow_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  asset_id text not null,
  sort_order integer not null,
  added_at timestamptz not null default now()
);
```
RLS scoped to `user_id = auth.uid()`, matching the existing pattern on `saved_quotes`.

Storing this in Supabase rather than local-only device storage is a deliberate choice: the data is tiny and non-sensitive (just ID strings), and it survives the user deleting and reinstalling *just this app* on the same phone — local storage (AsyncStorage) would lose the list in that case, even though the underlying Photos library (and its asset IDs) would be untouched.

**Known, accepted limitation:** `assetId`s are tied to a specific device's Photos library. Apple doesn't guarantee they survive a full device restore or a switch to a different phone, even with the same iCloud Photo Library — storing the list in Supabase doesn't change that, since it's the *identifiers themselves* that are device-bound, not where the list of them happens to live. The photos are still safe in Photos either way; only the slideshow's specific selection would need rebuilding in that scenario. This is inherent to referencing the system Photos library rather than app-owned storage, not a gap in this design.

**Playback:** fetch the user's `slideshow_photos` rows (ordered by `sort_order`), resolve each `asset_id` to a fresh local URI via `expo-media-library`'s `getAssetInfoAsync` (already installed, already used for Save to Photos), and display full-screen in rotation. An asset that fails to resolve (deleted from Photos since being added) is skipped gracefully — and worth pruning from the table when detected, so the list stays clean.

- Full-screen, one photo at a time, auto-advancing on a timer (~6-8s) with a cross-fade (Reanimated, already a dependency).
- Tap to pause/resume; swipe left/right to advance manually and reset the timer.
- `expo-keep-awake` (`useKeepAwake()`) while active, so the phone doesn't auto-lock mid-rotation. New dependency — `npx expo install expo-keep-awake` + a native rebuild, no config-plugin complexity like `expo-media-library` needed.
- Empty state (nothing added yet) points to "Build Slideshow" to pick some.

## Why this replaced the original design

The original scope assumed a shared rendering component could regenerate any saved card live from stored fields (background photo URL + text + formatting), backed by a `saved_quotes.card_saved_at` column marking which rows had been "turned into a card." That breaks for personal photos specifically: they were deliberately built session-only, never persisted, on the reasoning that the exported card was the only thing that needed to survive. A gallery/slideshow sourced from the database would have no way to include a personal-photo card at all.

Sourcing the slideshow from the Photos library instead sidesteps this entirely — every card, regardless of source, already lives there the moment it's saved. No new Storage upload, no flattened-image persistence question, no dependency on `card_saved_at` or any `saved_quotes` field at all. The `saved_quotes` schema needs no changes for this feature.

## Out of scope for v1

- Cross-device sync of the *photos themselves* — inherent to referencing the device's Photos library (see limitation above). The `slideshow_photos` list itself does sync via Supabase, for whatever that's worth on a new device (likely nothing, per the limitation).
- Reordering within the picked set beyond pick order (`sort_order` exists in the schema for this, just not exposed in v1 UI).
- Future: narrated quotes + background music during playback — see conventions research, evidence pulled from Meditopia/Aura/BetterMe/Mindvalley/Meditation Moments/Activations/Gabby via ScreensDesign: the near-universal pattern is one pre-mixed audio file per item (narration + music blended once, not layered live) with a consistent named narrator voice. For Stoic Mirror's user-personalized quote text, the equivalent would be generating narration via a TTS service at save time, mixing with a background track, and caching one resulting audio file per quote — not real-time mixing during playback.
