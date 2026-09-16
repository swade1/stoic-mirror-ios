#!/usr/bin/env bash
# Normalizes loudness and bakes a fade-in/out into an ambient audio clip so
# it loops cleanly, and sits at a consistent volume next to every other
# track, once uploaded to the ambient-tracks Supabase bucket. Run this
# before uploading any new track:
#
#   scripts/prep-ambient-track.sh "raw/Upbeat-Breathing Waves.mp3" "ready/Upbeat-Breathing Waves.mp3"
#
# Requires ffmpeg (brew install ffmpeg) and jq (brew install jq).
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

dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$in")

# Fade length: 10% of the clip, capped at 2s, so a 5-minute track gets a
# short tasteful fade while a 4-second clip doesn't fade for most of its length.
fade=$(awk -v d="$dur" 'BEGIN { f = d * 0.1; if (f > 2) f = 2; if (f < 0.15) f = 0.15; print f }')
fade_start=$(awk -v d="$dur" -v f="$fade" 'BEGIN { print d - f }')

# Loudness target: -18 LUFS integrated, -1.5 dBTP true-peak ceiling — quiet
# enough to sit under quote text as a background bed, but a fixed target so
# tracks mastered at wildly different source levels don't end up too soft
# or too loud relative to each other at the same in-app volume setting.
# Two-pass: the first pass only measures the input, the second applies
# normalization using those measured values (loudnorm's "linear" mode),
# which is materially more accurate than the single-pass mode. Done before
# the fade, not after, so the fade edges don't skew the loudness
# measurement.
target_i=-18
target_tp=-1.5
target_lra=11

normalized=$(mktemp -t ambient-normalized.XXXXXX).mp3
trap 'rm -f "$normalized"' EXIT

measured_json=$(
  ffmpeg -y -i "$in" \
    -af "loudnorm=I=${target_i}:TP=${target_tp}:LRA=${target_lra}:print_format=json" \
    -f null - 2>&1 | awk '/^\{$/{p=1} p; /^\}$/{p=0}'
)

measured_i=$(jq -r '.input_i' <<<"$measured_json")
measured_tp=$(jq -r '.input_tp' <<<"$measured_json")
measured_lra=$(jq -r '.input_lra' <<<"$measured_json")
measured_thresh=$(jq -r '.input_thresh' <<<"$measured_json")
measured_offset=$(jq -r '.target_offset' <<<"$measured_json")

ffmpeg -y -loglevel error -i "$in" \
  -af "loudnorm=I=${target_i}:TP=${target_tp}:LRA=${target_lra}:measured_I=${measured_i}:measured_TP=${measured_tp}:measured_LRA=${measured_lra}:measured_thresh=${measured_thresh}:offset=${measured_offset}:linear=true" \
  "$normalized"

ffmpeg -y -loglevel error -i "$normalized" \
  -af "afade=t=in:st=0:d=${fade},afade=t=out:st=${fade_start}:d=${fade}" \
  "$out"

echo "Wrote $out (normalized ${measured_i} LUFS -> ${target_i} LUFS, fade ${fade}s in/out, source duration ${dur}s)"
