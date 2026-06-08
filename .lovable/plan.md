## Goal
GitHub সমস্যা শেষ — এখন আগের লুপে যেগুলো বাকি ছিল সব যুক্ত করব, কিছু advanced upgrade যোগ করব, এবং শেষে real end-to-end proof (Telegram-এ ভিডিও) দেখাব। কোনো fake metric থাকবে না — সব real data।

## 1. Hook Library — AI-powered (seed dependency বাদ)
- `src/lib/hooks.functions.ts` নতুন: `generateAIHooks({ topic, emotion, count })` — Lovable AI Gateway দিয়ে Bengali viral hook generate করে `hooks_library`-এ save করে (is_seed=false, ai_generated=true)।
- `hooks_library`-এ column `ai_generated boolean` + `source_topic text` migration।
- `hooks.tsx`-এ "✨ Generate AI Hooks" button + topic/emotion input। Seed badge → "AI" / "Custom" / "Seed" তিন রকম।

## 2. Performance Tracker — clear labels + delete
- প্রতিটা views input-এর পাশে label: "Manually logged" + edit time।
- প্রতিটা video card-এ Delete button (confirm dialog সহ)।
- Calibration trigger: 3 video log হওয়ার পর automatic `calibrateFromPerformance` server fn → `ai_calibration` table-এ predicted vs actual gap রেকর্ড।

## 3. Inspiration Vault — real metrics only
- Fake "engagement %" / "growth %" সরানো।
- নতুন column: `last_checked_at`, `notes`। শুধু user-entered real data + last visit time।
- "Open channel" + "Mark reviewed" button — কোনো fake AI score না।

## 4. Reference Upload + Vision Analysis (নতুন feature)
- Supabase storage bucket `references` create + RLS।
- `src/routes/_authenticated/references.tsx` নতুন: video/image upload → preview।
- `src/lib/references.functions.ts`: `analyzeReference({ url, type })` — Gemini Vision দিয়ে JSON output: hook style, pacing, color mood, suggested angles → `style_memory` table-এ save।
- Sidebar nav-এ "References" link।

## 5. Advanced upgrades
- **Real-time pipeline monitor**: `pipeline_runs` লাইভ status card dashboard-এ (idea → script → assets → render → telegram প্রতিটা step duration সহ)।
- **Cost ledger**: প্রতি AI call-এর token count + estimated cost `pipeline_runs`-এ store, dashboard-এ "আজকের spend" widget।
- **Auto-retry queue**: render_jobs failed হলে 1 ঘণ্টা পর auto retry (max 2 বার), exponential backoff।
- **Telegram delivery proof**: render-callback এ video file Telegram-এ send (sendVideo), message_id + delivery timestamp `render_jobs.telegram_message_id` column-এ save।

## 6. System Doctor expansion
- Storage bucket reachability check।
- Auto-retry queue status।
- Last successful Telegram delivery timestamp।
- Real cost (last 24h) summary row।

## 7. Final end-to-end proof
1. System Doctor full run → সব row green/skip (no red)।
2. Generate 1 idea → dual-AI script → asset plan → GitHub dispatch।
3. GitHub Actions render workflow trigger → callback hit → video Telegram-এ deliver।
4. Dashboard-এ `render_jobs.telegram_message_id` + delivery timestamp দেখাব as proof।
5. কোনো step fail হলে log + fix + retry — সবুজ না হওয়া পর্যন্ত থামব না।

## Technical notes
- Migration files: `hooks_library` (ai_generated, source_topic), `render_jobs` (telegram_message_id, retry_count, next_retry_at), `competitor_channels` (last_checked_at, notes), নতুন `references` table।
- Storage bucket `references` (private, authenticated RW)।
- নতুন server fns সব `createServerFn` + `requireSupabaseAuth`।
- render-callback handler-এ Telegram sendVideo যোগ — multipart বা video_url দিয়ে।
- `pipeline_runs` schema-তে cost_usd, tokens_in, tokens_out add।
