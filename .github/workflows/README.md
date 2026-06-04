# GitHub Actions render directory

Files in this directory are bundled with Lovable→GitHub sync. The render
workflow lives at `.github/workflows/render.yml`. Helper scripts live next
to it under `.github/workflows/scripts/`.

When Lovable's `triggerRender` server fn dispatches a `sentix-render` event,
this workflow:

1. Reads the script + asset plan from `client_payload`.
2. Generates Bengali voiceover via Edge-TTS (`scripts/tts.py`).
3. Localizes Pexels/Pollinations assets (`scripts/fetch_assets.py`).
4. Renders the Remotion composition under `remotion/`.
5. Applies anti-detection metadata + frame dithering via ffmpeg.
6. Uploads final MP4 as a GitHub Actions artifact.
7. Optionally sends to Telegram via Bot API.
8. POSTs success/failure to Lovable's `/api/public/render-callback`.

## Required GitHub repo secrets

- `TELEGRAM_BOT_TOKEN` (optional — for video delivery)
- `TELEGRAM_CHAT_ID` (optional)

Everything else comes from the `client_payload` Lovable signs with
`RENDER_CALLBACK_SECRET`.
