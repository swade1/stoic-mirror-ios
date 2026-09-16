#!/usr/bin/env bash
# Bakes a fade-in and fade-out into an ambient audio clip so it loops cleanly
# once uploaded to the ambient-tracks Supabase bucket. Run this before
# uploading any new track:
#
#   scripts/prep-ambient-track.sh "raw/Upbeat-Breathing Waves.mp3" "ready/Upbeat-Breathing Waves.mp3"
#
# Requires ffmpeg (brew install ffmpeg).
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

dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$in")

# Fade length: 10% of the clip, capped at 2s, so a 5-minute track gets a
# short tasteful fade while a 4-second clip doesn't fade for most of its length.
fade=$(awk -v d="$dur" 'BEGIN { f = d * 0.1; if (f > 2) f = 2; if (f < 0.15) f = 0.15; print f }')
fade_start=$(awk -v d="$dur" -v f="$fade" 'BEGIN { print d - f }')

ffmpeg -y -loglevel error -i "$in" \
  -af "afade=t=in:st=0:d=${fade},afade=t=out:st=${fade_start}:d=${fade}" \
  "$out"

echo "Wrote $out (fade ${fade}s in/out, source duration ${dur}s)"
