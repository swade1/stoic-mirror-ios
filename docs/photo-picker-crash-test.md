# Manual test: photo-picker stability

Checks whether `choosePersonalPhoto()` in [app/quote-cards.tsx](../app/quote-cards.tsx)
(the "Your Photo" picker, called from the quote-card background picker) can
crash or misbehave under adverse conditions. The call isn't wrapped in a
try/catch, so this needs to be exercised by hand rather than proven safe by
reading the code.

Run the full list on the Simulator first (fast iteration), then repeat on a
physical device before considering this closed — some of these (low storage,
real permission prompts, thermal/memory pressure) don't reproduce
meaningfully in the Simulator.

For each case: note pass/fail, and if it fails, whether the app crashes
outright, shows a red-box/error screen, or just silently does nothing.

## Setup
Get to the picker: History or Counsel tab → tap a quote's photo-card icon →
in the background picker, tap "Your Photo".

## Cases

1. **Baseline** — pick an ordinary photo. Confirm it loads and the pan/zoom
   gesture works. (Sanity check before the edge cases below.)

2. **Very large photo** — pick the highest-resolution photo available (e.g.
   a ProRAW or panorama, or a screen-recorded 4K video frame export). Watch
   for a hang, crash, or the image failing to appear.

3. **Cancel the picker** — open the picker, then dismiss without choosing a
   photo. Confirm the app returns cleanly to the background picker with
   nothing changed (this path already has an early `return` in the code —
   should be safe, but confirm the picker UI doesn't get stuck).

4. **Rapid double-tap "Your Photo"** — tap it twice quickly before the
   picker sheet finishes presenting. Confirm only one picker opens, and
   picking a photo afterward doesn't leave the app in a weird state.

5. **Permission denied** — in Settings, revoke Photos access for the app,
   then tap "Your Photo". Confirm the app shows some reasonable response
   (a permission prompt or message) rather than crashing.

6. **Permission newly granted mid-flow** — with Photos access set to
   "Limited" or denied, tap "Your Photo", and if iOS offers a
   grant-access prompt, grant it from inside that flow. Confirm the picker
   still opens correctly afterward.

7. **Low device storage** — (physical device only; hard to simulate) with
   the device nearly out of storage, pick a large photo. Confirm the app
   doesn't crash while decoding/copying it.

8. **Backgrounding mid-pick** — open the picker, then background the app
   (Home button / swipe up) before selecting a photo, then return. Confirm
   the app doesn't crash or leave the picker in a broken state.

9. **Picking the same photo repeatedly** — pick a photo, go back to the
   background picker, tap "Your Photo" again, and pick the *same* photo a
   second time. Confirm no crash and the pan/zoom position resets cleanly
   each time (per the reset logic in `choosePersonalPhoto`).

10. **Screenshot/HEIC/PNG variety** — try a regular camera photo, a
    screenshot (PNG), and a Live Photo. Confirm all three load and behave
    the same way.

## If something fails

Note which numbered case, what happened (crash / red box / silent
no-op / hang), and whether it's reproducible. That's enough for a targeted
fix — no need to add defensive code speculatively before a real repro is in
hand.
