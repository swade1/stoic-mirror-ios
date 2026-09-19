---
name: prep-ambient-track
description: Trim a source audio file to a given loop start/end, loudness-normalize it, bake in a fade, and upload it to the ambient-tracks Supabase bucket as a new slideshow ambient track, tagged with a mood and a length bucket. Use when Susan (the app's creator) provides a source audio file plus a loop start and end time — typically found with pymusiclooper — and wants it added as an ambient background track for the slideshow.
---

# Prep Ambient Track

Turns a raw audio file plus a loop start/end time into a ready-to-use, mood- and length-tagged ambient track in the app's `ambient-tracks` Supabase bucket. No app code change is involved — `lib/ambientTracks.ts` lists whatever's in the bucket automatically, deriving the display name, mood, and length from the filename (each tag is text before a hyphen, extending the same "category prefix" convention `lib/quoteBackgrounds.ts` uses to two tags instead of one).

## Inputs needed

Confirm you have all five before starting — ask if any are missing:

1. Source audio file path
2. Loop start time (`MM:SS.mmm` or `HH:MM:SS.mmm`)
3. Loop end time (same format)
4. Desired track display name (e.g. "Rain On Leaves Loop")
5. Mood — one of `Bright`, `Solemn`, or `Still` (see below).

The output filename is `<Mood>-<Length>-<Track Display Name>.mp3`. Length is **not** a fifth input to ask for — see "The length tag" below for why it's computed instead.

**Never guess or infer the mood yourself.** Claude has no audio-listening modality here — there's no way to judge whether a clip resolves major, minor, or neither by running a tool on it (key-detection algorithms exist but are unreliable on exactly the ambient/drone material this bucket tends to hold). Always ask Susan which mood applies; treat it as a required input like the loop points, not something to default or suggest.

### The three moods

Each is a single, checkable test — not a vibe — chosen so a track can't plausibly satisfy two at once:

- **Bright** — resolves to a major chord; feels settled and pleasant.
- **Solemn** — resolves to a minor chord; feels settled but weighty.
- **Still** — doesn't clearly resolve either way — modal, ambiguous, or drone-based, no strong tonal pull.

### The length tag

Unlike mood, length isn't a judgment call — it's the track's measured duration, classified into a fixed bucket:

- **Short** — 3 to 5 minutes
- **Medium** — 6 to 9 minutes
- **Long** — 10+ minutes

Compute it yourself from `loop end − loop start` (the same arithmetic already done in step 1 to sanity-check the trim) — never ask Susan which bucket applies, and never guess when a duration doesn't cleanly fall in one of the three (e.g. under 3 minutes, which predates this tagging scheme and doesn't fit any current bucket) — flag that case and ask how she wants it handled rather than inventing a fourth bucket.

## Why the file has to be pre-trimmed

The app just does `player.loop = true` on the whole uploaded file ([app/slideshow-play.tsx](../../../app/slideshow-play.tsx) — the ambient-music effect around line 390). There's no separate intro section — the file itself has to *be* the seamless loop, so it must be trimmed to exactly `[loop start, loop end]` before upload.

## Steps

1. **Trim**, re-encoding rather than stream-copying — `-c copy` snaps to the nearest MP3 frame boundary and throws off the loop point by up to tens of milliseconds, which is audible as a click:
   ```bash
   ffmpeg -i "<source file>" -ss <loop start> -to <loop end> "<scratch>/trimmed.mp3"
   ```

2. **Normalize loudness and bake in a fade** using the repo's existing prep script. It two-pass normalizes to -18 LUFS integrated / -1.5 dBTP true peak (so this track sits at the same perceived volume as every other ambient track regardless of how loud its source was mastered), then adds a short fade-in/out (10% of clip length, capped 0.15–2s) so even a near-perfect loop point doesn't click at the seam. Requires `jq` in addition to `ffmpeg`. Name the output file with both tags already in place:
   ```bash
   scripts/prep-ambient-track.sh "<scratch>/trimmed.mp3" "<scratch>/<Mood>-<Length>-<Track Display Name>.mp3"
   ```

3. **Checksum the prepped file** before uploading — this is what step 5 confirms the bucket is actually serving, since audio can't be eyeballed for correctness the way a cropped image can:
   ```bash
   shasum -a 256 "<scratch>/<Mood>-<Length>-<Track Display Name>.mp3"
   ```

4. **Upload** to the `ambient-tracks` bucket (Supabase project `fazvbphkzlutghzpvsli`) using the service-role key — this is an admin action outside the app, so the anon key won't have write access:
   ```bash
   node scripts/upload-ambient-track.js "<scratch>/<Mood>-<Length>-<Track Display Name>.mp3" "<Mood>-<Length>-<Track Display Name>.mp3"
   ```
   This script reads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from `.env` itself — no need to source them first. Add `--replace` if a track of that exact name is already in the bucket and this is meant to overwrite it (e.g. re-normalizing an existing track) — without it, upload fails on the name collision rather than risk silently overwriting something.

5. **Verify** the upload landed and is actually being served, not just present in the bucket's metadata:
   - Confirm the row via the Supabase MCP `execute_sql` tool against project `fazvbphkzlutghzpvsli`:
     ```sql
     select name, updated_at, metadata->>'size' as size_bytes
     from storage.objects
     where bucket_id = 'ambient-tracks'
     order by updated_at desc
     limit 5;
     ```
   - Then fetch what the public URL actually returns and compare its checksum to step 3's — a match proves the served bytes are exactly what was uploaded, which is the real fix verification (see below for why this matters more here than the metadata row does):
     ```bash
     curl -s "https://fazvbphkzlutghzpvsli.supabase.co/storage/v1/object/public/ambient-tracks/<url-encoded name>.mp3" -o "<scratch>/fetched.mp3"
     shasum -a 256 "<scratch>/fetched.mp3"
     ```
   This matters most for a `--replace` upload — overwriting a file under the same name can leave a URL-keyed cache (Storage's CDN, or a client) serving the old bytes even though the bucket's own metadata looks fine (see [lib/ambientTracks.ts](../../../lib/ambientTracks.ts)'s `withCacheBust`, added after exactly this happened once — same bug, same fix, as `lib/quoteBackgrounds.ts`). A checksum mismatch here means the cache-bust isn't doing its job and needs investigating before reporting success.

Use the session's scratchpad directory for intermediate files (`<scratch>` above) — never commit the trimmed/prepped audio into the repo itself.

Report back the final track name, mood, and length bucket, and confirm it'll appear in the app's ambient music picker next time it fetches the list — no app update needed.
