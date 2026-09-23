---
name: prep-ambient-track
description: Trim a source audio file to a given start/end, loudness-normalize it, and upload it to the ambient-tracks Supabase bucket as a new slideshow ambient track, tagged with a mood. Use when Susan (the app's creator) provides a source audio file plus start/end trim points and wants it added as an ambient background track for the slideshow.
---

# Prep Ambient Track

Turns a raw audio file plus start/end trim points into a ready-to-use, mood-tagged ambient track in the app's `ambient-tracks` Supabase bucket. No app code change is involved — `lib/ambientTracks.ts` lists whatever's in the bucket automatically, deriving both the display name and the mood from the filename (mood is the text before the first hyphen, the same "category prefix" convention `lib/quoteBackgrounds.ts` uses).

## Inputs needed

Confirm you have all five before starting — ask if any are missing:

1. Source audio file path
2. Start trim point (`MM:SS.mmm` or `HH:MM:SS.mmm`) — where the kept audio begins
3. End trim point (same format) — where the kept audio ends
4. Desired track display name (e.g. "Rain On Leaves Loop")
5. Mood — one of `Bright`, `Solemn`, or `Still` (see below). The output filename is `<Mood>-<Track Display Name>.mp3`.

**Never guess or infer the mood yourself.** Claude has no audio-listening modality here — there's no way to judge whether a clip resolves major, minor, or neither by running a tool on it (key-detection algorithms exist but are unreliable on exactly the ambient/drone material this bucket tends to hold). Always ask Susan which mood applies; treat it as a required input like the trim points, not something to default or suggest.

### The three moods

Each is a single, checkable test — not a vibe — chosen so a track can't plausibly satisfy two at once:

- **Bright** — resolves to a major chord; feels settled and pleasant.
- **Solemn** — resolves to a minor chord; feels settled but weighty.
- **Still** — doesn't clearly resolve either way — modal, ambiguous, or drone-based, no strong tonal pull.

There is deliberately no length tag or bucket here — tracks used to be classified Short/Medium/Long to try to match a track's length to a slideshow's expected duration, but that didn't actually solve the problem it was aimed at (a short track still finishes and leaves silence) and has been replaced by letting a collection hold an ordered *playlist* of ambient tracks that queues through and loops as a whole (see `app/slideshow-play.tsx`'s ambient playback effect and `lib/ambientPlaylist.ts`). A track's length is no longer something this skill needs to compute or tag.

## Why the file gets trimmed at all, and how much to keep

`app/slideshow-play.tsx` crossfades live at playback time between whatever's queued next — including a single track looping into its own repeat, the same mechanism it already uses between two different tracks. That means the file no longer has to *be* a seamless loop on its own the way it used to; the app smooths the seam, not the file.

So trimming is no longer about hunting for a pair of points where the audio matches closely enough to splice invisibly (the old approach, typically via a tool like pymusiclooper) — it's just about cutting out parts of the source that shouldn't play at all: a spoken intro, a long fade-to-silence outro, dead air, a false start. **Default to keeping as much of the source track as makes sense, including its natural intro and outro** — the old approach could end up discarding most of a track chasing a tight loop match, which this replaces. Only trim what's actually unwanted; don't narrow the range further than that in search of a "cleaner" seam, since the runtime crossfade is what's handling the seam now.

## Steps

1. **Trim**, re-encoding rather than stream-copying — `-c copy` snaps to the nearest MP3 frame boundary, which can leave a few tens of milliseconds of unwanted material at the cut:
   ```bash
   ffmpeg -i "<source file>" -ss <start> -to <end> "<scratch>/trimmed.mp3"
   ```

2. **Normalize loudness** using the repo's existing prep script — two-pass normalizes to -18 LUFS integrated / -1.5 dBTP true peak, so this track sits at the same perceived volume as every other ambient track regardless of how loud its source was mastered, and so it's already volume-matched going into a live crossfade with whatever plays next. Requires `jq` in addition to `ffmpeg`. Name the output file with the mood prefix already in place:
   ```bash
   scripts/prep-ambient-track.sh "<scratch>/trimmed.mp3" "<scratch>/<Mood>-<Track Display Name>.mp3"
   ```

3. **Checksum the prepped file** before uploading — this is what step 5 confirms the bucket is actually serving, since audio can't be eyeballed for correctness the way a cropped image can:
   ```bash
   shasum -a 256 "<scratch>/<Mood>-<Track Display Name>.mp3"
   ```

4. **Upload** to the `ambient-tracks` bucket (Supabase project `fazvbphkzlutghzpvsli`) using the service-role key — this is an admin action outside the app, so the anon key won't have write access:
   ```bash
   node scripts/upload-ambient-track.js "<scratch>/<Mood>-<Track Display Name>.mp3" "<Mood>-<Track Display Name>.mp3"
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

Report back the final track name and mood, and confirm it'll appear in the app's ambient music picker next time it fetches the list — no app update needed. A track only plays as part of a collection's playlist once Susan (or the app's user) actually adds it there; uploading alone just makes it available to choose from.
