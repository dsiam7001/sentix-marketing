#!/usr/bin/env python3
"""
Edge-TTS for Bengali (bn-BD). Reads INPUT_TEXT env var (or stdin),
writes audio.mp3 + captions.json (word-level timing).

Usage in GitHub Action:
  INPUT_TEXT="..." python3 scripts/tts.py --voice bn-BD-PradeepNeural --out audio.mp3

Falls back to bn-IN voices if bn-BD unavailable.
"""
import asyncio
import argparse
import json
import os
import random
import sys

import edge_tts

VOICES_BN_BD = ["bn-BD-PradeepNeural", "bn-BD-NabanitaNeural"]
VOICES_BN_IN = ["bn-IN-BashkarNeural", "bn-IN-TanishaaNeural"]


async def run(text: str, voice: str, out_mp3: str, out_caps: str):
    # Slight randomization for human-likeness (Audio Frequency Jitter)
    rate = f"{random.choice([-3, -2, -1, 0, 1, 2])}%"
    pitch = f"{random.choice([-2, -1, 0, 1, 2])}Hz"
    communicator = edge_tts.Communicate(text, voice, rate=f"+{rate.lstrip('+')}" if not rate.startswith('-') else rate, pitch=f"+{pitch.lstrip('+')}" if not pitch.startswith('-') else pitch)
    submaker = edge_tts.SubMaker()
    with open(out_mp3, "wb") as f:
        async for chunk in communicator.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                submaker.feed(chunk)
    captions = [
        {"text": cue.text, "start": cue.start / 10_000_000, "end": cue.end / 10_000_000}
        for cue in submaker.cues
    ]
    with open(out_caps, "w", encoding="utf-8") as f:
        json.dump(captions, f, ensure_ascii=False, indent=2)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice", default="bn-BD-PradeepNeural")
    ap.add_argument("--out", default="audio.mp3")
    ap.add_argument("--captions", default="captions.json")
    ap.add_argument("--text-file", default=None)
    args = ap.parse_args()

    text = ""
    if args.text_file and os.path.exists(args.text_file):
        with open(args.text_file, "r", encoding="utf-8") as f:
            text = f.read().strip()
    else:
        text = os.environ.get("INPUT_TEXT", "").strip()
        if not text:
            text = sys.stdin.read().strip()
    if not text:
        print("No input text", file=sys.stderr)
        sys.exit(1)

    voice_tries = [args.voice] + [v for v in VOICES_BN_BD + VOICES_BN_IN if v != args.voice]
    last_err = None
    for v in voice_tries:
        try:
            asyncio.run(run(text, v, args.out, args.captions))
            print(f"OK voice={v} -> {args.out}")
            return
        except Exception as e:
            last_err = e
            print(f"voice {v} failed: {e}", file=sys.stderr)
    raise SystemExit(f"All voices failed: {last_err}")


if __name__ == "__main__":
    main()
