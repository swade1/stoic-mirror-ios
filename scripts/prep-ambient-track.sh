#!/usr/bin/env bash
# Loudness-normalizes an ambient audio clip so it sits at a consistent
# volume next to every other track. Run this before uploading any new
# track:
#
#   scripts/prep-ambient-track.sh "raw/Upbeat-Breathing Waves.mp3" "ready/Upbeat-Breathing Waves.mp3"
#
# Both ffmpeg calls below use -nostdin — without it, ffmpeg reads its own
# stdin looking for interactive commands (q to quit, etc.), which silently
# eats/corrupts input when this script is called from inside a loop that's
# also reading a file list from stdin (e.g. `while read ... < list.txt`
# batching several tracks through this script in one pass).
#
# Requires ffmpeg (brew install ffmpeg) and jq (brew install jq).
#
# This used to also bake a self-crossfade loop point into the clip's own
# tail/head, back when a track's own file had to *be* the seamless loop —
# app/slideshow-play.tsx now crossfades live at playback time between
# whatever's queued next (including a single track looping into its own
# repeat), the same mechanism it already uses between two different
# tracks. That runtime crossfade covers both jobs the baked one used to:
# smoothing the perceptual transition, and avoiding a click at the literal
# edit boundary (the outgoing track is already faded near-silent by the
# time it reaches that point). Baking a second crossfade into the file on
# top of that would double-blend the seam rather than help it, so this
# step no longer does that — see the loop-point guidance in
# .claude/skills/prep-ambient-track/SKILL.md for what that means for how
# much of a source track to actually keep.
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <input audio file> <output audio file>" >&2
  exit 1
fi

in="$1"
out="$2"

if ! command -v ffmpeg >/dev/null || ! command -v ffprobe >/dev/null; then
  echo "ffmpeg is required (brew install ffmpeg)" >&2
  exit 1
fi
if ! command -v jq >/dev/null; then
  echo "jq is required (brew install jq)" >&2
  exit 1
fi

# Loudness target: -18 LUFS integrated, -1.5 dBTP true-peak ceiling — quiet
# enough to sit under quote text as a background bed, but a fixed target so
# tracks mastered at wildly different source levels don't end up too soft
# or too loud relative to each other at the same in-app volume setting,
# and so two tracks crossfading into each other are already volume-matched
# going into that blend. Two-pass: the first pass only measures the input,
# the second applies normalization using those measured values (loudnorm's
# "linear" mode), which is materially more accurate than the single-pass
# mode.
target_i=-18
target_tp=-1.5
target_lra=11

measured_json=$(
  ffmpeg -y -nostdin -i "$in" \
    -af "loudnorm=I=${target_i}:TP=${target_tp}:LRA=${target_lra}:print_format=json" \
    -f null - 2>&1 | awk '/^\{$/{p=1} p; /^\}$/{p=0}'
)

measured_i=$(jq -r '.input_i' <<<"$measured_json")
measured_tp=$(jq -r '.input_tp' <<<"$measured_json")
measured_lra=$(jq -r '.input_lra' <<<"$measured_json")
measured_thresh=$(jq -r '.input_thresh' <<<"$measured_json")
measured_offset=$(jq -r '.target_offset' <<<"$measured_json")

ffmpeg -y -nostdin -loglevel error -i "$in" \
  -af "loudnorm=I=${target_i}:TP=${target_tp}:LRA=${target_lra}:measured_I=${measured_i}:measured_TP=${measured_tp}:measured_LRA=${measured_lra}:measured_thresh=${measured_thresh}:offset=${measured_offset}:linear=true" \
  "$out"

echo "Wrote $out (normalized ${measured_i} LUFS -> ${target_i} LUFS)"
