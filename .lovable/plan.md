# Sentix AI — Phase 3: Autonomous Pilot + Safety Net

লক্ষ্য: Dual-AI ৯/১০ পাস করলে আপনার approval ছাড়াই পুরো pipeline নিজে নিজে চলবে — idea → script → assets → render → copyright/AI-detection check → Telegram delivery। আপনি যেকোনো সময় manual mode-এ ফিরতে পারবেন, যেকোনো কিছু delete/reject করতে পারবেন, এবং প্রতিটা ধাপের proof দেখতে পাবেন।

---

## ১. Autopilot Engine (time-aware auto-generation)

**নতুন table:** `autopilot_settings` (per-user)

- `enabled` (bool) — master switch
- `auto_approve` (bool) — Dual-AI ≥৯ হলে human review skip
- `auto_render` (bool) — approved হলে নিজে নিজে GitHub render trigger
- `auto_publish_telegram` (bool) — render শেষে নিজে নিজে Telegram-এ পাঠাবে
- `daily_quota` (int, default 4) — দিনে সর্বোচ্চ কতটা ভিডিও
- `slot_config` (jsonb): সকাল/দুপুর/বিকাল/রাত slot, প্রতিটার জন্য preferred tone (logical / emotional / story / psychology / market-logic)

**নতুন server route:** `/api/public/autopilot-tick` (HMAC-protected, pg_cron প্রতি ১৫ মিনিট hit করবে)

1. বর্তমান slot detect (Asia/Dhaka timezone)
2. ওই slot-এ আজ ভিডিও আছে কিনা check
3. না থাকলে: Daily Pulse → Generate 5 ideas → প্রতিটার জন্য Dual-AI run → highest-scoring ৯+ approved script নাও
4. `auto_render` on হলে → asset plan + GitHub dispatch
5. `auto_publish_telegram` on হলে → render-callback এ পেলেই Telegram push (already wired)
6. প্রতিটা ধাপ `pipeline_runs` table-এ log + Mission Control HUD-এ live দেখাবে

**নতুন page section:** `/control` → "Autopilot" card — সব toggle, slot grid (4×7), today's planned vs done, "Pause autopilot" big red button।

---

## ২. Manual override + bulk Delete/Reject

প্রতিটা list page-এ (Ideas, Scripts, Renders) যোগ হবে:

- Row checkbox + "Select all"
- Bulk action bar: **Delete**, **Reject**, **Re-run Dual-AI**, **Force render**
- Single-row action menu: View / Edit / Duplicate / Delete / Reject / Mark needs-review
- "Trash" view যেখান থেকে ৩০ দিনের ভিতর restore করা যাবে (soft-delete `deleted_at` column)
- Status filter chips: All / Approved / Needs Review / Rejected / Trash

Scripts/Renders-এও same pattern, plus "Cancel render" GitHub workflow cancel API call।

---

## ৩. API Key Hub (one-click connect)

`/settings` → "Integrations" tab redesign — প্রতিটা service-এর জন্য একটা card:


| Service                               | Field                | Purpose                                                          | Status    |
| ------------------------------------- | -------------------- | ---------------------------------------------------------------- | --------- |
| Gemini (multi-key pool)               | label + key          | Strategist/Critic                                                | ✅ already |
| Pexels                                | API key              | Stock video                                                      | ✅         |
| Pixabay                               | API key              | Stock video/image                                                | ✅         |
| Pollinations                          | (no key)             | AI image                                                         | ✅         |
| GitHub PAT                            | token + owner + repo | Render muscle                                                    | ✅         |
| Telegram                              | bot token + chat id  | Delivery                                                         | ✅         |
| **YouTube Data API**                  | OAuth / key          | Copyright pre-check via Content ID hints + auto-upload (Phase 4) | 🆕        |
| **AssemblyAI** (free tier 5h/mo)      | API key              | Voice transcription verify + bad-word scan                       | 🆕        |
| **Hive AI / Sightengine** (free tier) | API key              | AI-generated-content detection on final MP4                      | 🆕        |
| **AudD / ACRCloud** (free 14-day)     | API key              | Music copyright fingerprint check                                | 🆕        |
| **Unsplash**                          | Access key           | Extra free visuals                                               | 🆕        |
| **DeepL Free**                        | API key              | Bengali grammar polish backup                                    | 🆕        |
| **OpenRouter**                        | API key              | Backup LLM if Gemini pool exhausted                              | 🆕        |


প্রতিটা card-এ: input field + "Save & Test" button → server fn যেটা actual API ping করে valid/invalid দেখাবে (green check / red X with reason)। সবগুলো `process.env` secret হিসেবে store হবে।

---

## ৪. Copyright + AI-Detection Guard (নতুন AI layer)

নতুন server fn `guardrails.functions.ts` — render-callback এর পরে, Telegram-এ পাঠানোর **আগে** চলবে:

**৪.১ Audio copyright check** — AudD API দিয়ে final MP4 থেকে audio fingerprint → known song match হলে flag।  
**৪.২ AI-voice detection** — Hive AI / ElevenLabs classifier দিয়ে narration analyze → "AI synthetic" score > 0.7 হলে flag (Edge-TTS detect হয় কিনা দেখার জন্য)। Mitigation: pitch-shift + EQ pass already in ffmpeg step, plus optional RVC humanization (Phase 4)।  
**৪.৩ AI-video detection** — Sightengine "AI-generated" model দিয়ে keyframe sample check।  
**৪.৪ Transcript scan** — AssemblyAI দিয়ে actual narration transcribe → compare with intended SRT → mismatch / bad-word / brand-name leak flag।  
**৪.৫ Visual copyright** — reverse image search keyframes via TinEye free tier (limited)।

**Result table:** `guard_reports` (script_id, audio_score, ai_voice_score, ai_video_score, transcript_match%, flags jsonb, verdict: clear/warn/block)

- `clear` → Telegram push proceed
- `warn` → Telegram push but with ⚠️ caption + Mission Control alert
- `block` → halt, mark script `needs_review`, notify owner

Mission Control-এ নতুন widget: "Guard Lab" — last 20 videos-এর scoring grid।

---

## ৫. End-to-End Self-Test ("System Doctor")

`/control` → "Run Full Diagnostic" button → একটা throwaway test pipeline চালাবে যেটা প্রমাণসহ report দিবে:


| Step | Check                                   | Proof                               |
| ---- | --------------------------------------- | ----------------------------------- |
| 1    | Supabase reachable, all 16 tables exist | row count                           |
| 2    | Gemini key pool — প্রতিটা key ping      | per-key latency + status            |
| 3    | Lovable AI Gateway fallback             | sample completion                   |
| 4    | Pexels/Pixabay/Pollinations             | 1 search per service                |
| 5    | Dual-AI loop — test topic ("BTC RSI")   | strategist+critic JSON              |
| 6    | GitHub dispatch                         | workflow run URL                    |
| 7    | Render workflow status                  | live job status poll                |
| 8    | TTS audio generated                     | mp3 size + duration                 |
| 9    | Guardrail APIs (AudD/Hive/AssemblyAI)   | per-API ping                        |
| 10   | Telegram bot                            | test message delivered + message_id |
| 11   | Render callback HMAC                    | round-trip verify                   |


Report saved as `diagnostic_runs` row + downloadable JSON + on-screen status board (green/yellow/red per row with click-to-see-raw-response)। ভিডিও সত্যি Telegram-এ গেছে তার প্রমাণ হিসেবে Telegram API থেকে `message_id` ফেরত আসবে।

---

## ৬. Known issues + fixes (current codebase audit)


| Issue                                                                        | Impact                           | Fix in this plan                                       |
| ---------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------ |
| Render callback URL hardcoded to one preview domain in `render.functions.ts` | Published site callback fails    | env var `PUBLIC_BASE_URL` + fallback to request origin |
| No retry if GitHub dispatch returns 422 (workflow file missing)              | Silent fail                      | pre-flight check workflow exists, surface error in UI  |
| `dual_ai_runs` grows unbounded                                               | Slow queries after weeks         | nightly cleanup keeping last 500                       |
| No idempotency on render-callback                                            | Duplicate Telegram push possible | unique `(job_id, status)` constraint                   |
| Autopilot could double-fire on overlapping cron ticks                        | Duplicate videos                 | advisory lock per slot                                 |
| Asset cache never expires                                                    | Stale Pexels links (24h signed)  | TTL column + refresh on miss                           |
| Settings page shows secrets exist but can't test them                        | User can't verify                | "Test" button per integration (covered in §3)          |
| No timezone handling — slots assume UTC                                      | Bangladesh users get wrong slot  | store `Asia/Dhaka`, convert in autopilot tick          |


---

## ৭. Build order

1. Schema migration (autopilot_settings, guard_reports, diagnostic_runs, pipeline_runs, deleted_at columns, idempotency constraint)
2. Integrations Hub redesign + per-service "Save & Test" server fns
3. Bulk delete/reject + Trash view across Ideas/Scripts/Renders
4. Autopilot engine + `/api/public/autopilot-tick` + pg_cron schedule
5. Guardrails layer + Guard Lab widget
6. System Doctor diagnostic + report UI
7. Render callback hardening + cleanup jobs

৪. বাস্তবসম্মত সমস্যা ও বিকল্প সমাধান (Problems & Solutions)

সমস্যা (Problem)	সমাধান ও বিকল্প উপায় (Advanced Solution)

Infinite Loop: এআই যদি ৯/১০ স্কোর না পায় বা কপিরাইট চেক ফেইল করে তবে সিস্টেম আটকে যেতে পারে।	Solution: 'Safe-Mode Fallback'. যদি ৩ বার ট্রাই করে ব্যর্থ হয়, তবে এআই একটি 'Verified Standard Template' ব্যবহার করবে যা আগে থেকেই সেফ হিসেবে প্রমাণিত।

Server Overload: অটোমেটিক অনেক ভিডিও একসাথে রেন্ডার হলে গিটহাব লিমিট দিতে পারে।	Solution: 'Render Queue'. একটি ভিডিও শেষ হওয়ার পর আরেকটি শুরু হবে। মনিটরে আপনি 'In Queue' স্ট্যাটাস দেখবেন।

Asset Mismatch: অটো-পাইলটে এআই অনেক সময় ভুল ছবি নিতে পারে।	Solution: 'Visual Validation AI'. এটি চেক করবে স্ক্রিপ্টে যদি "Loss" এর কথা থাকে তবে ছবি যেন "Profit" এর না হয়।

৫. ডিজিটাল মনিটর (The Verification Center)

আপনার /control পেজে এখন একটি "System Pulse" সেকশন থাকবে:

Status Indicators: প্রতিটি কানেকশন (GitHub, Telegram, Gemini) কি ঠিক আছে? সবুজ মানে ঠিক আছে।

Auto/Manual Toggle: আপনি এক ক্লিকে পুরো সিস্টেমকে অটো থেকে ম্যানুয়াল মুডে নিতে পারবেন।

Delete/Reject Button: যদি কোনো ভিডিও বা স্ক্রিপ্ট আপনার পছন্দ না হয়, এক ক্লিকে সেটি গিটহাব এবং ডাটাবেস থেকে ডিলিট করতে পারবেন।

Audit Logs: প্রতিটি ভিডিও কেন তৈরি হলো এবং কপিরাইট চেক কীভাবে পাশ করল তার ছোট রিপোর

## 🌌 SENTIX OVERLORD: THE AUTONOMOUS MASTERMIND (GRAND BLUEPRINT)



## ১. কোর ওভারলর্ড লজিক (The Godfather Synapse)



## সিস্টেমটি কেবল কাজ করবে না, এটি পুরো ইকোসিস্টেমের Orchestrator হিসেবে কাজ করবে।

## এর প্রধান কাজ হলো আপনার "Single Click" পাওয়ার আগে সবকিছু ১০০% নির্ভুলভাবে

## প্রস্তুত রাখা।



## সমস্যা ও সমাধান (Problem-Solution Matrix):



##   - সমস্যা ১: এআই লজিক লুপ (Logic Stuck): স্ট্র্যাটেজিস্ট ও ক্রিটিক এআই যদি ৯/১০

##     স্কোর নিয়ে বারবার রিজেক্ট করতে থাকে।

##       - সমাধান (The Arbiter): ৩বার প্রচেষ্টার পর মাস্টারমাইন্ড নিজে 'বিচারক'

##         হিসেবে বসবে। সে সবচাইতে বেশি স্কোর পাওয়া সংস্করণটি বেছে নিয়ে

##         সেটির দুর্বল জায়গায় নিজের থেকে ইনস্ট্রাকশন দিয়ে ফিক্স করবে।

##   - সমস্যা ২: সাইলেন্ট রেন্ডার ফেইলিওর (Silent Failure): গিটহাব বলছে 'Success',

##     কিন্তু ভিডিও ফাইলটি করাপ্টেড বা কালো।

##       - সমাধান (Verification Layer): ভিডিও তৈরির পর এআই একটি 'Visual Audit'

##         করবে। সে ফাইলের সাইজ এবং মেটাডেটা চেক করবে। যদি ফাইল সাইজ

##         অস্বাভাবিক ছোট হয়, তবে ইউজারকে না জানিয়েই অটো-রিমেক করবে।

##   - সমস্যা ৩: এসেট শর্টেজ (Asset Scarcity): পিক্সেলস বা পিক্সাবে-তে যদি

##     নির্দিষ্ট কোনো চার্ট ভিডিও না পাওয়া যায়।

##       - সমাধান (Recursive Sourcing): প্রথমে স্টক এপিআই চেক করবে ➔ না পেলে

##         Puppeteer দিয়ে সাইটের চার্ট ক্যাপচার করবে ➔ সেটিও না হলে Pollinations.ai

##         দিয়ে এআই ইমেজ জেনারেট করবে।



## ২. ১০০ গুণ শক্তিশালী ৫টি নতুন লেয়ার (100x Advanced Layers)



## ১. Layer: Meta-DNA Scrambler: ভিডিওর প্রতিটি ফ্রেমের ভেতরে অদৃশ্য নয়েজ এবং

## ডাইনামিক ফ্রেম-রেট যোগ করা হবে। এটি ভিডিওর ডিজিটাল ডিএনএ এমনভাবে

## বদলে দেবে যে সোশ্যাল মিডিয়া এলগরিদম একে ১০০% হিউম্যান কন্টেন্ট মনে করবে।

## ২. Layer: Jitter-Sync Audio: Edge-TTS এর ভয়েসের ওপর 'Pitch Shifting' এবং 'Time

## Stretching' করা হবে যাতে রোবোটিক একঘেয়েমি কেটে যায়। ৩. Layer: Trend Hijacker:

## এআই প্রতিদিন ভাইরাল হওয়া ১০০০টি মিউজিক ট্র্যাক স্ক্যান করবে এবং আপনার

## ভিডিওর ব্যাকগ্রাউন্ডে সেই মিউজিকের একটি ৩-সেকেন্ডের হুক লুপ হিসেবে

## চালাবে। ৪. Layer: Smart Queue Management: যদি আপনি ১০টি ভিডিও একসাথে

## এপ্রুভ করেন, মাস্টারমাইন্ড সেগুলোকে গিটহাবে সিরিয়াল অনুযায়ী পাঠাবে যাতে

## সার্ভার জ্যাম না হয়। ৫. Layer: Feedback Loop Learning: গত সপ্তাহে কোন ভিডিওতে

## সবচাইতে বেশি ভিউ এসেছে, সেই ডাটা রিড করে এআই পরের সপ্তাহের ভিডিওর হুক

## অটো-আপডেট করবে।



## ৩. দ্য মাস্টারমাইন্ড প্রম্পট (The Mega Prompt for Lovable AI)



## Lovable AI-কে নিচের এই প্রম্পটটি দিন (এটি অত্যন্ত ডিটেইলড):



## "SYSTEM ARCHITECTURE: SENTIX OVERLORD v2.0



## CORE OBJECTIVE: Build a fully autonomous, self-healing, and institutional-grade

## video marketing engine. The system must operate as a 'Mastermind' that manages

## two existing sub-apps (Trading Quant & Video Factory).



## 1. THE SINGLE-CLICK WORKFLOW:



##   - The Mastermind must prepare 'Ready-to-Execute' packages containing validated

##     scripts (Score >= 9.0), planned assets, and copyright-checked audio.

##   - Implement a single 'EXECUTE' button in the HUD. Once clicked, it must

##     trigger a sequential chain: Metadata Washing -> Render Request -> Policy

##     Audit -> Telegram Dispatch.



## 2. SELF-HEALING & ENFORCEMENT:



##   - Implement 'The Arbiter' logic: If the Strategist/Critic loop fails 3 times,

##     the Mastermind forces a resolution by merging the best versions.

##   - API Failover: Automatically rotate through the pool of 10 Gemini Keys. If

##     all hit 429 errors, switch to a fallback 'Emergency Prompt' via Lovable

##     Gateway.

##   - Post-Render Audit: After GitHub Actions finishes, use a webhook to verify

##     file integrity. If the video is faulty, re-trigger the render automatically

##     using alternative visual assets.



## 3. HUMAN-MASKING & PROTECTION:



##   - Inject 'Spectral Jitter' into Edge-TTS audio to bypass AI voice detection.

##   - Implement 'Metadata Injection': Every video must have EXIF data mimicking

##     high-end devices (iPhone/Samsung) and localized GPS coordinates.

##   - Dynamic Watermarking: Apply a transparent, non-detectable digital signature

##     to protect against content theft.



## 4. DIGITAL MISSION CONTROL (HUD):



##   - Create a real-time 'Nerve System' UI. Left panel for Trading Engine health,

##     Right panel for Video Pipeline, Center for Overlord Decisions.

##   - Include a 'Manual Override' toggle to switch from 'Full-Auto' back to

##     'Assisted-Manual' mode.

##   - Display 'API Battery' levels and 'Render Queue' live progress using

##     WebSockets.



## 5. ASSET RECURSION:



##   - If Pexels/Pixabay fails to provide relevant trading visuals, use Puppeteer

##     to capture live snapshots from 'sentixai4.xo.je' or call Pollinations.ai for

##     generative art.



## 6. FAIL-SAFE REASONS & SOLUTIONS:



##   - Problem: Shadowban risk. Solution: Randomize frame rates and apply a subtle

##     film-grain filter.

##   - Problem: Subtitle overlap. Solution: Implement 'Safe-Zone UI Awareness' to

##     keep text within TikTok/IG safe areas.



## BUILD INSTRUCTIONS: Use React 19, Supabase Realtime, and Framer Motion for the

## UI. Use GitHub Actions and FFmpeg for the Muscle. This system must be 100x more

## efficient than any manual marketing team. Proceed with the implementation of the

## 'Sentix Overlord' mastermind logic now."



## ৪. বাস্তব বিশ্লেষণ ও মালিকের জন্য চেক-লিস্ট (Executive Summary)



## কেন এই সিস্টেমটি গড-ফাদার হবে?



##   - এটি শুধু কাজ করে না, এটি কাজ আদায় করে নেয়।

##   - আপনার হস্তক্ষেপ ছাড়া এটি নিজেকে উন্নত (Self-Improvement) করতে পারে।

##   - এটি সোশ্যাল মিডিয়া প্ল্যাটফর্মের সিকিউরিটি গাইডলাইনগুলো ভেঙে আপনার

##     ব্র্যান্ডকে লুকিয়ে ভাইরাল করতে জানে।



## সীমাবদ্ধতা ও বিকল্প (The Reality Check):



##   - সীমা: GitHub Actions-এর ফ্রি লিমিট মাসে ২০০০ মিনিট।

##   - সমাধান: মাস্টারমাইন্ড শুধু সেই ভিডিওগুলোই রেন্ডার করবে যা ৯/১০ স্কোর পেয়েছে।

##     এতে কোনো ফালতু মিনিট খরচ হবে না।

##   - সীমা: এআই মাঝে মাঝে ভুল লজিক দিতে পারে।

##   - সমাধান: আপনি যেহেতু 'অ্যাপ্রুভ' বাটনে ক্লিক করবেন, তাই শেষ ক্ষমতা আপনার

##     

## Technical section

- **New secrets needed** (only the ones you choose to enable): `YOUTUBE_API_KEY`, `ASSEMBLYAI_API_KEY`, `HIVE_API_KEY` or `SIGHTENGINE_USER`+`SIGHTENGINE_SECRET`, `AUDD_API_KEY`, `UNSPLASH_ACCESS_KEY`, `DEEPL_API_KEY`, `OPENROUTER_API_KEY`, `AUTOPILOT_TICK_SECRET`, `PUBLIC_BASE_URL`। প্রতিটা optional — না দিলে ওই feature gracefully disabled।
- **pg_cron** Supabase extension enable → `select cron.schedule('autopilot', '*/15 * * * *', $$ select net.http_post(...) $$)`।
- **Soft delete:** `deleted_at timestamptz`; RLS policies updated to filter; nightly hard-delete job >৩০ দিন।
- **Guard Lab** server fns lazy-load each API key with `await import` so missing key = skip that check (not crash)।
- **Autopilot advisory lock:** `pg_try_advisory_xact_lock(hashtext('autopilot:'||slot))` করে race condition prevent।
- **System Doctor** — পুরো test cycle ৪ মিনিট (real GitHub render included); short-mode (৩০s) skip-render version-ও থাকবে।

---

জানান approve করলে আমি ধাপে ধাপে implement করা শুরু করব। কোনো section বাদ দিতে / আগে চান, বলুন।