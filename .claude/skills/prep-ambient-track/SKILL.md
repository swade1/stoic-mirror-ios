---
name: prep-ambient-track
description: Trim a source audio file to a given loop start/end, bake in a fade, and upload it to the ambient-tracks Supabase bucket as a new slideshow ambient track. Use when Susan (the app's creator) provides a source audio file plus a loop start and end time — typically found with pymusiclooper — and wants it added as an ambient background track for the slideshow.
---

# Prep Ambient Track

Turns a raw audio file plus a loop start/end time into a ready-to-use ambient track in the app's `ambient-tracks` Supabase bucket. No app code change is involved — `lib/ambientTracks.ts` lists whatever's in the bucket automatically, and derives the display name from the filename (dashes/underscores → spaces, title-cased).

## Inputs needed

Confirm you have all four before starting — ask if any are missing:

1. Source audio file path
2. Loop start time (`MM:SS.mmm` or `HH:MM:SS.mmm`)
3. Loop end time (same format)
4. Desired track display name (e.g. "Rain On Leaves Loop") — the output filename will be `<name>.mp3`

## Why the file has to be pre-trimmed

The app just does `player.loop = true` on the whole uploaded file ([app/slideshow-play.tsx](../../../app/slideshow-play.tsx) — the ambient-music effect around line 390). There's no separate intro section — the file itself has to *be* the seamless loop, so it must be trimmed to exactly `[loop start, loop end]` before upload.

## Steps

1. **Trim**, re-encoding rather than stream-copying — `-c copy` snaps to the nearest MP3 frame boundary and throws off the loop point by up to tens of milliseconds, which is audible as a click:
   ```bash
   ffmpeg -i "<source file>" -ss <loop start> -to <loop end> "<scratch>/trimmed.mp3"
   ```

2. **Bake in a fade** using the repo's existing prep script, which adds a short fade-in/out (10% of clip length, capped 0.15–2s) so even a near-perfect loop point doesn't click at the seam:
   ```bash
   scripts/prep-ambient-track.sh "<scratch>/trimmed.mp3" "<scratch>/<Track Display Name>.mp3"
   ```

3. **Upload** to the `ambient-tracks` bucket (Supabase project `fazvbphkzlutghzpvsli`) using the service-role key — this is an admin action outside the app, so the anon key won't have write access:
   ```bash
   node scripts/upload-ambient-track.js "<scratch>/<Track Display Name>.mp3" "<Track Display Name>.mp3"
   ```
   This script reads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from `.env` itself — no need to source them first.

4. **Verify** the upload landed, via the Supabase MCP `execute_sql` tool against project `fazvbphkzlutghzpvsli`:
   ```sql
   select name, created_at, metadata->>'size' as size_bytes
   from storage.objects
   where bucket_id = 'ambient-tracks'
   order by created_at desc
   limit 5;
   ```

Use the session's scratchpad directory for intermediate files (`<scratch>` above) — never commit the trimmed/prepped audio into the repo itself.

Report back the final track name and confirm it'll appear in the app's ambient music picker next time it fetches the list — no app update needed.
