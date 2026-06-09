#!/usr/bin/env python3
"""Download asset URLs from data.json into remotion/public/assets/ and rewrite
the asset_plan with local paths. Also picks a BGM track for the mood and
downloads it to bgm.mp3 (root)."""
import json
import os
import sys
import urllib.request
import random

DATA = "data.json"
ASSETS_DIR = "remotion/public/assets"
os.makedirs(ASSETS_DIR, exist_ok=True)

with open(DATA, "r", encoding="utf-8") as f:
    data = json.load(f)

UA = {"User-Agent": "Mozilla/5.0 SentixAI"}

def download(url: str, idx: int, prefix="asset") -> str | None:
    if not url:
        return None
    ext = ".mp4"
    low = url.lower().split("?")[0]
    for e in (".jpg", ".jpeg", ".png", ".webm", ".mov", ".mp4", ".mp3"):
        if low.endswith(e):
            ext = e
            break
    path = os.path.join(ASSETS_DIR, f"{prefix}_{idx}{ext}")
    try:
        req = urllib.request.Request(url, headers=UA)
        with urllib.request.urlopen(req, timeout=90) as r, open(path, "wb") as out:
            out.write(r.read())
        return f"assets/{prefix}_{idx}{ext}"
    except Exception as e:
        print(f"download fail [{idx}] {url}: {e}", file=sys.stderr)
        return None

# ---------- Visual assets ----------
plan = data.get("asset_plan") or []
for i, scene in enumerate(plan):
    chosen = scene.get("chosen") or {}
    url = chosen.get("url")
    local = download(url, i, "asset")
    if local:
        chosen["url"] = local
    scene["chosen"] = chosen

# ---------- Background music ----------
# Free CC0 / royalty-free tracks (Pixabay Music — direct mp3 mirrors).
# Mood map. If mood unknown, use cinematic.
BGM_BY_MOOD = {
    "cinematic": [
        "https://cdn.pixabay.com/audio/2024/04/02/audio_e5da89bb0a.mp3",
        "https://cdn.pixabay.com/audio/2023/06/14/audio_88447e769f.mp3",
    ],
    "tense": [
        "https://cdn.pixabay.com/audio/2023/10/30/audio_7c2da90a73.mp3",
        "https://cdn.pixabay.com/audio/2024/02/06/audio_27a8c2a8d3.mp3",
    ],
    "hopeful": [
        "https://cdn.pixabay.com/audio/2024/05/21/audio_2c95a4ff2c.mp3",
        "https://cdn.pixabay.com/audio/2023/09/26/audio_de57b1e7a3.mp3",
    ],
    "uplifting": [
        "https://cdn.pixabay.com/audio/2024/02/22/audio_d11d8e2c7c.mp3",
        "https://cdn.pixabay.com/audio/2023/06/14/audio_88447e769f.mp3",
    ],
    "dark": [
        "https://cdn.pixabay.com/audio/2023/10/30/audio_7c2da90a73.mp3",
    ],
}

mood_raw = (data.get("music_mood") or "cinematic").lower()
mood = "cinematic"
for key in BGM_BY_MOOD:
    if key in mood_raw:
        mood = key
        break

bgm_pool = BGM_BY_MOOD[mood]
bgm_url = random.choice(bgm_pool)
print(f"BGM mood={mood} url={bgm_url}")

bgm_path = "bgm.mp3"
try:
    req = urllib.request.Request(bgm_url, headers=UA)
    with urllib.request.urlopen(req, timeout=90) as r, open(bgm_path, "wb") as out:
        out.write(r.read())
    size = os.path.getsize(bgm_path)
    print(f"BGM downloaded {size} bytes")
    data["bgm_track"] = {"mood": mood, "url": bgm_url, "local": bgm_path}
except Exception as e:
    print(f"BGM download failed: {e}", file=sys.stderr)
    data["bgm_track"] = None

with open(DATA, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"Localized {len(plan)} assets + BGM={'ok' if data.get('bgm_track') else 'skipped'}")
