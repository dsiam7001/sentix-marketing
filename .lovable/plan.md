# Sentix AI 2.0 — Phase 2: Autonomous Engine (100% Free)

Goal: Strategist↔Critic dual-AI scripting → free asset sourcing (Pexels/Pixabay/Pollinations) → Edge-TTS Bengali voiceover → GitHub Actions Remotion rendering → Quantum Mission Control dashboard. **$0/month**.

## Architecture

┌─────────────────────── LOVABLE (THE BRAIN) ───────────────────────┐  
│                                                                    │  
│  Daily Pulse ─▶ Strategist AI ─▶ Script + Shot List               │  
│                       ▲                  │                         │  
│                       │ feedback (≤3)    ▼                         │  
│                  Critic AI ◀── Score 0-10 (target ≥9)             │  
│                                          │                         │  
│                  approved/needs-review ──┤                         │  
│                                          ▼                         │  
│  Asset Engine: Pexels + Pixabay + Pollinations.ai                  │  
│  Voiceover: Edge-TTS bn-BD (run in GitHub Action)                  │  
│                                          │                         │  
│  Quantum Mission Control HUD ◀───────────┤                         │  
│                                          ▼                         │  
│  YOU click "Render" ────▶ commit data.json to GitHub               │  
└────────────────────────────────────────┬───────────────────────────┘  
                                         │ repository_dispatch  
                                         ▼  
┌──────────────── GITHUB ACTIONS (THE MUSCLE) ──────────────────────┐  
│  1. Read data.json (script, scenes, asset URLs, captions)         │  
│  2. pip install edge-tts → generate bn-BD MP3 + word timestamps   │  
│  3. Download Pexels/Pixabay clips → /assets                        │  
│  4. bunx remotion render → MP4                                     │  
│  5. Upload as GitHub Release artifact + send to Telegram bot       │  
│  6. POST status back to Lovable webhook (/api/public/render-cb)   │  
└────────────────────────────────────────────────────────────────────┘

## Build Steps

### 1. Gemini Key Pool + Rotator

- New table `gemini_keys` already exists — extend with `last_429_at`, `daily_calls`, `cooldown_until`
- Server fn `getNextGeminiKey()`: round-robin, skip cooled-down keys, fallback to Lovable AI Gateway when all exhausted
- Wrap all Gemini calls in `callGeminiWithRotation(prompt)` — catches 429 → marks key cooldown 1hr → retries with next key
- Admin secrets: prompt user to add `GEMINI_KEY_1` … `GEMINI_KEY_10` (optional — works with Gateway alone if user skips)
- UI: Settings page → "Gemini Key Pool" section showing key status (active/cooldown/exhausted) + add/remove

### 2. Dual-AI Engine (Strategist ↔ Critic)

New file `src/lib/dual-ai.functions.ts`:

- `strategistGenerate(pulse, styleMemory, hookLibrary)` → returns `{ script, shotList, hooks, rationale }`
- `criticEvaluate(strategistOutput)` → returns `{ score, breakdown: {hook, bengali_authenticity, logic_clarity, cta_strength, identity_build}, feedback }`
- `runDualAILoop(pulseId)`:
  - Iter 1: strategist → critic
  - If score ≥ 9 → save as `approved`, ready for render
  - If 7.5 ≤ score < 9 → retry (max 3) with critic's feedback fed into strategist
  - If after 3 retries still 7.5-9 → save as `needs_review` (shows in HUD)
  - If < 7.5 after 3 retries → save as `rejected` with reason
- New table `dual_ai_runs`: stores each iteration (strategist_output, critic_score, critic_feedback, iteration_n, final_status)
- UI: Idea Lab card shows live dual-AI conversation (collapsible "AI Dialog")

### 3. Asset Sourcing Engine

New file `src/lib/assets.functions.ts`:

- `searchPexelsVideos(query, perPage)` — needs `PEXELS_API_KEY` secret (free, user signs up)
- `searchPixabayVideos(query, perPage)` — needs `PIXABAY_API_KEY` secret (free)
- `generatePollinationsImage(prompt)` — no key needed, direct URL: `https://image.pollinations.ai/prompt/{encoded}`
- `pickAssetsForShotList(shotList)` → for each scene, fetch top 3 candidates, AI picks best match
- New table `asset_cache`: `(query_hash, source, url, used_count)` — avoid re-fetching same queries
- UI: Script Studio shows asset previews per scene with "swap" button
- Vision AI Analysis: যদি ইউজার কোনো ছবি (প্রফিট স্ক্রিনশট বা চার্ট) আপলোড করে, তবে Gemini Vision API সেটি রিড করে লজিক জেনারেট করবে।
- Site-Snapshot Engine: পিবেলে (Pexels) ট্রেডিং ভিডিও কম থাকলে, সিস্টেমটি Puppeteer ব্যবহার করে সরাসরি [https://sentixai4.lovable.app](https://sentixai4.lovable.app) থেকে রিয়েল-টাইম চার্ট মুভমেন্টের ৫ সেকেন্ডের ক্লিপ রেকর্ড করে ভিডিওতে ব্যবহার করবে।
- Visual Mirroring: সব স্টক ভিডিওকে এআই অটোমেটিক "Horizontal Flip" এবং সামান্য "Color Shift" করবে যাতে এটি ইউনিক হয় এবং কোনো ডুপ্লিকেট কন্টেন্ট ক্লেইম না আসে।

### 4. GitHub Integration + Remote Renderer

**User must enable Lovable→GitHub integration first** (Plus menu → GitHub → Connect project).

- Prompt user to add secrets: `GITHUB_PAT` (with `repo` + `workflow` scope), `GITHUB_REPO_OWNER`, `GITHUB_REPO_NAME`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `PEXELS_API_KEY`, `PIXABAY_API_KEY`
- Create `remotion/` folder in project:
  - `package.json`, `tsconfig.json`, `src/Root.tsx`, `src/MainVideo.tsx`
  - Scene components: `Hook.tsx`, `ProblemReveal.tsx`, `LogicProof.tsx`, `CTA.tsx`
  - Reads `public/data.json` (script + scene timings + asset URLs + captions SRT)
  - Uses `@remotion/google-fonts/HindSiliguri` for Bengali text rendering
- Create `.github/workflows/render.yml`:
  - Trigger: `repository_dispatch` (event_type: `sentix-render`) with `client_payload` carrying script_id
  - Steps:
    1. checkout
    2. Setup Node 22 + Python 3.11
    3. `pip install edge-tts` → generate `audio.mp3` + `captions.json` (use `edge-tts --voice bn-BD-PradeepNeural --text "..." --write-media audio.mp3 --write-subtitles captions.vtt`)
    4. Download Pexels/Pixabay clips from data.json into `remotion/public/assets/`
    5. `cd remotion && bun install && bunx remotion render src/index.ts main /tmp/output.mp4`
    6. Upload as GitHub Release artifact
    7. POST MP4 to Telegram bot (sendVideo API)
    8. POST callback to `https://project--{id}-dev.lovable.app/api/public/render-callback` with `{ script_id, status, video_url }`
- Server fn `triggerRender(scriptId)`: POSTs to GitHub `repository_dispatch` API with script data + asset URLs
- Public route `src/routes/api/public/render-callback.ts`: verifies HMAC, updates `scripts.render_status` and `scripts.video_url`

### 5. Edge-TTS in GitHub Action

- bn-BD-PradeepNeural (male, news anchor tone — fits Sentix authority voice)
- bn-BD-NabanitaNeural (female alternative)
- Captions VTT → parsed to word-level JSON for Remotion subtitle sync
- Script `scripts/tts.py` in repo handles chunking >2000 chars + retry on Microsoft endpoint errors

### 6. Quantum Mission Control HUD (new `/control` page)

Realistic version of the 15 HUD widgets (only what we can actually measure):

- **AI Pipeline Status**: live count of pending/strategist-running/critic-running/approved/rendering/done
- **Dual-AI Dialog Stream**: latest 5 runs with score, iteration, status
- **Gemini Key Pool Health**: 10 keys × status dots (green/yellow/red/cooldown timer)
- **Render Queue**: GitHub Actions in-progress (poll via Actions API) + last 10 finished
- **Asset Cache Hit Rate**: % of scenes using cached vs fresh-fetched assets
- **Virality Score Trend**: line chart of last 30 AI scores vs actual views (from Performance Tracker)
- **Calibration Delta**: avg (predicted_score - actual_normalized_views) → shows AI bias
- **Style Memory Coverage**: % of last 10 scripts that matched user's voice samples
- **Edge-TTS Status**: last 10 jobs success/fail
- **Telegram Delivery**: last 10 video deliveries
- **System Health**: Lovable AI Gateway quota %, GitHub Actions minutes used (free tier 2000/mo private)
- **Today's Throughput**: pulses→ideas→scripts→approved→rendered funnel
- **Hook Performance**: which hooks from library got highest actual views
- **Manual Review Queue**: scripts marked `needs_review` (7.5≤score<9) requiring your decision
- **Cost Tracker**: literal $0.00 with breakdown showing what *would* have cost on paid stack
- Detection Evasion Score: ভিডিওটি এআই ডিটেকশন এড়ানোর জন্য কতটা প্রস্তুত তার একটি মিটার।
- Est. Telegram Conversion: বর্তমান ভাইরাল ট্রেন্ড অনুযায়ী এই ভিডিওটি থেকে কতজন টেলিগ্রামে জয়েন করতে পারে তার একটি প্রেডিকশন।
- API Key Lifespan: আপনার ১০টি জেমিনি কী-র মধ্যে কোনটি কতটুকু ব্যবহৃত হয়েছে তার লাইভ ব্যাটারি ইন্ডিকেটর।র।

Removed from original 15 (impossible without paid platform APIs):

- ❌ Shadowban Radar, Audience Retention Heatmap (real-time), Future View Predictor 30d, Engagement Velocity, Trust Score AI, Platform Sentiment Map, Global Trend Overlay → marked as "Phase 4 (requires paid platform APIs)" in HUD

Human-Masking: In the GitHub Action, implement metadata scrubbing and inject random iPhone 15 Pro tags + invisible noise for anti-detection.

Vision Analysis: Integrate Gemini Vision to analyze user-uploaded profit/chart images for the script logic.

Asset Fallback: If Pexels lacks trading clips, use Puppeteer to take snapshots of sentixai4.xo.je charts.

Critic Checklist: Add a 'Safe-Zone Audit' to ensure subtitles don't overlap with TikTok UI.

Cost Optimizer: Generate a low-res thumbnail preview before triggering the expensive GitHub Render to save minutes.

Key Pool: Show a 'Battery' style health indicator for the 10 Gemini keys in the HUD.

Ensure the flow remains $0 and fully automated once I click 'Approve'."

### 7. Approval Gate Flow

Idea → Dual-AI runs → if approved: shows "Render This" button → opens preview (script + assets + voiceover preview via browser TTS for quick check) → user clicks "Send to GitHub" → status updates live via callback → MP4 link arrives in Telegram + dashboard.

### 8. Schema Additions

New tables:

- `dual_ai_runs` (script_id, iteration, role, content, score, feedback, created_at)
- `asset_cache` (query_hash unique, source, url, metadata jsonb, used_count, last_used)
- `render_jobs` (script_id, github_run_id, status, video_url, error, started_at, finished_at)

Extend `scripts`: add `render_status`, `video_url`, `audio_url`, `needs_review_reason`, `final_score`, `iterations_used`.

Extend `gemini_keys`: add `cooldown_until`, `daily_calls`, `total_calls`, `last_429_at`.

All with RLS + GRANTs per project conventions.

9.Metadata Injector: ভিডিও রেন্ডার হওয়ার পর পাইথন স্ক্রিপ্টটি ভিডিওর মেটাডেটা থেকে 'Remotion' বা 'FFmpeg' এর নাম মুছে দিয়ে iPhone 15 Pro / Samsung S24 এর ক্যামেরা ডাটা এবং একটি র্যান্ডম বাংলাদেশি জিপিএস লোকেশন ইনজেক্ট করবে।

Audio Frequency Jitter: এআই ভয়েসের পিচে খুব সূক্ষ্ম (০.১%) র্যান্ডম পরিবর্তন আনবে যাতে প্ল্যাটফর্মের এআই ডিটেক্টর একে রোবট হিসেবে চিহ্নিত করতে না পারে।

Frame Dithering: ভিডিওর প্রতিটি ফ্রেমে ১% অদৃশ্য নয়েজ (Invisible noise) যোগ করা হবে যা ইউনিক ডিজিটাল সিগনেচার তৈরি করবে।

10.Chek list dual talk ai 

Overlay Guard: ক্রিটিক এআই চেক করবে সাবটাইটেল কি টিকটকের লাইক/কমেন্ট বাটনের নিচে চলে যাচ্ছে কি না। যদি যায়, তবে সে স্ট্র্যাটেজিস্টকে পজিশন বদলানোর অর্ডার দেবে।

Authority Tone Check: ভিডিওর টোন কি "VIP Seller" এর মতো লাগছে? যদি লাগে, তবে এআই সেটিকে বদলে "Logic-Based Educator" টোনে নিয়ে আসবে।

## Realistic Limits (called out in HUD)

- GitHub Actions free tier: **2000 min/mo for private repos, unlimited for public**. ~3 min/render = ~666 videos/mo (private) or unlimited (public).
- Edge-TTS: Microsoft endpoint, no official quota but heavy abuse can rate-limit. Mitigation: max 10 renders/hour throttle.
- Pexels: 200 req/hr free → asset_cache handles repeats.
- Pixabay: 100 req/min free.
- Pollinations.ai: no key, occasional rate-limit, watermark-free.
- Gemini free tier (per key): ~15 req/min, 1500/day. With 10 keys = 15,000/day → plenty.
- Critic strict mode (9/10 + 3 retry): expect ~30-40% scripts hitting `needs_review` initially. Calibration improves over weeks as Style Memory + Performance feedback loop tunes prompts.

## What's NOT in Phase 2 (deferred)

- Auto-publish to TikTok/IG/FB/YT — manual upload (ToS + API restriction reality)
- Shadowban detection / metadata washing — account safety risk
- Real-time platform analytics — manual entry via Performance Tracker
- Runway/Suno/Pika AI video gen — paid, weak for trading content
- Multi-agent beyond 2 (Strategist/Critic) — over-engineering for single user

## Build Order

1. Schema migration (gemini_keys extend, dual_ai_runs, asset_cache, render_jobs, scripts extend)
2. Gemini rotator + Settings UI for key pool
3. Asset engine (Pexels/Pixabay/Pollinations) + Settings UI for those API keys
4. Dual-AI engine + Idea Lab integration
5. Remotion project scaffold in `remotion/` folder + sample data.json
6. GitHub Actions workflow `.github/workflows/render.yml` + Python TTS script
7. `triggerRender` server fn + render-callback public route
8. Quantum Mission Control `/control` page with all realistic widgets
9. Approval gate UI on Script Studio
10. Telegram delivery integration
11. সমস্যা, সমাধান ও বাস্তবসম্মত বিকল্প (Risk & Mitigation)
12. সম্ভাব্য সমস্যা	বিকল্প সমাধান (The "Add-on" logic)
13. GitHub Actions এর ২০০০ মিনিট শেষ হয়ে যাওয়া:	সমাধান: ভিডিও রেন্ডার করার আগে একটি ১ সেকেন্ডের "Low-Res Preview" (Low quality image summary) তৈরি করবে যা আপনি আগে চেক করবেন। সব ঠিক থাকলে তবেই আসল রেন্ডার হবে। এতে ফালতু মিনিট খরচ হবে না।
14. Edge-TTS এর রোবোটিক টোন:	সমাধান: পাইথন স্ক্রিপ্টে --pitch এবং --rate প্যারামিটারগুলো র্যান্ডমাইজ করা হবে। এটি একেক সময় একেক টোনে কথা বলবে, যা হিউম্যান ডিটেকশন এড়াতে সাহায্য করবে।
15. স্টক ভিডিওর অভাব:	সমাধান: Lovable-কে বলবেন Pollinations.ai ব্যবহার করে "Abstract Cyberpunk Trading Backgrounds" তৈরি করতে, যা দেখতে অনেক বেশি প্রফেশনাল এবং সবসময় ইউনিক।

## Secrets to add (after plan approval)

`GEMINI_KEY_1`...`GEMINI_KEY_10` (optional), `PEXELS_API_KEY`, `PIXABAY_API_KEY`, `GITHUB_PAT`, `GITHUB_REPO_OWNER`, `GITHUB_REPO_NAME`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `RENDER_CALLBACK_SECRET` (HMAC for callback verification).

User must also: connect Lovable→GitHub integration manually before step 5.