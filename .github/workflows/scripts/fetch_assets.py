#!/usr/bin/env python3
"""Download asset URLs from data.json into remotion/public/assets/ and rewrite
the asset_plan with local paths. Also downloads with light user-agent to avoid
empty bodies from Pexels CDN."""
import json
import os
import sys
import urllib.request

DATA = "data.json"
ASSETS_DIR = "remotion/public/assets"

os.makedirs(ASSETS_DIR, exist_ok=True)
with open(DATA, "r", encoding="utf-8") as f:
    data = json.load(f)

def download(url: str, idx: int) -> str | None:
    if not url:
        return None
    ext = ".mp4"
    low = url.lower().split("?")[0]
    for e in (".jpg", ".jpeg", ".png", ".webm", ".mov", ".mp4"):
        if low.endswith(e):
            ext = e
            break
    path = os.path.join(ASSETS_DIR, f"asset_{idx}{ext}")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 SentixAI"})
        with urllib.request.urlopen(req, timeout=60) as r, open(path, "wb") as out:
            out.write(r.read())
        return f"assets/asset_{idx}{ext}"
    except Exception as e:
        print(f"download fail [{idx}] {url}: {e}", file=sys.stderr)
        return None

plan = data.get("asset_plan") or []
for i, scene in enumerate(plan):
    chosen = scene.get("chosen") or {}
    url = chosen.get("url")
    local = download(url, i)
    if local:
        chosen["url"] = local
    scene["chosen"] = chosen

with open(DATA, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"Localized {len(plan)} assets")
