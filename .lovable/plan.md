# Sentix AI — বাস্তবসম্মত মাস্টারপ্ল্যান v2

আগের plan + নতুন brief মিলিয়ে আগে **সমস্যা বিশ্লেষণ** করি (একজন ইউজার + একজন developer হিসেবে), তারপর সমাধান, তারপর advanced user-friendly features।

---

## অংশ ১: বাস্তব সমস্যা বিশ্লেষণ (Problem Analysis)

### 🔴 সমস্যা ১: "Auto trend research" বাস্তবে দুর্বল

**দাবি:** YouTube API + Google Trends দিয়ে প্রতিদিন trend detect হবে।  
**বাস্তবতা:** YouTube Data API দিনে মাত্র **১০,০০০ quota units** free, একটা search = ১০০ units, মানে দিনে ~১০০টা search। Google Trends এর কোনো official free API নেই — unofficial library প্রায়ই block হয়। Bangladesh-specific trading trend data এত sparse যে AI ভুল conclusion টানবে।  
**ইউজার impact:** আপনি ভাববেন "real trend" পাচ্ছেন, কিন্তু আসলে noise পাবেন → ভুল content → time waste।

### 🔴 সমস্যা ২: AI-generated script-এ "বাংলাদেশি vibe" নেই

**দাবি:** Gemini বাংলা script লিখবে যা cinematic + relatable।  
**বাস্তবতা:** Gemini-র Bengali ভালো, কিন্তু বাংলাদেশি ট্রেডারদের slang ("ভাই VIP-তে ডুবলাম", "OTC এ ধরা খাইলাম", "মার্টিংগেল দিয়ে blowup") সে সঠিক tone-এ লিখতে পারে না। Generic "শিক্ষামূলক বাংলা" আসে → audience-এর সাথে connect হয় না।  
**ইউজার impact:** Script পড়ে আপনি নিজেই বুঝবেন "এটা মানুষ শুনবে না"।

### 🔴 সমস্যা ৩: Virality Score একটা illusion

**দাবি:** AI score দিবে viral হবে কি না।  
**বাস্তবতা:** AI score = AI-এর নিজের opinion। আসল virality determine হয় algorithm, timing, thumbnail, prior account performance দিয়ে — যা AI জানে না। ৯৫/১০০ score পাওয়া video ০ views পেতে পারে।  
**ইউজার impact:** False confidence → বাস্তব performance feedback ignore করবেন।

### 🔴 সমস্যা ৪: Video render Lovable-এ চলবে না

FFmpeg, Puppeteer, Edge-TTS — Cloudflare Worker runtime-এ অসম্ভব। External worker = extra cost, maintenance, complexity।

### 🔴 সমস্যা ৫: ১০০টা Gemini key rotation = Google policy violation

Google-এর ToS অনুযায়ী একই person একাধিক free account → ban risk। ১০০ keys = ১০০ Google accounts = account suspension risk।

### 🔴 সমস্যা ৬: ৩০-দিনের pre-planned calendar vs "real-time trend" — contradiction

আপনি একই সাথে চান "৩০ দিনের blueprint" আর "real-time trend-based content"। দুটো একসাথে হয় না।

### 🔴 সমস্যা ৭: Daily ৩টা video (8:30 AM / 12:30 PM / 9:00 PM) = burnout

একা manual edit করে দিনে ৩টা cinematic video impossible। ১ম সপ্তাহে enthusiasm, ২য় সপ্তাহে exhausted।

### 🔴 সমস্যা ৮: "Self-improving" loop-এর data নেই

"Previous video performance দেখে improve" — কিন্তু YouTube/TikTok analytics তো আপনাকে manually input করতে হবে (no auto API for shorts performance per account without OAuth setup)।

### 🟡 সমস্যা ৯: Website (sentixai4.xo.je) free hosting — slow + uptime issue

Audience যদি "পাগল হয়ে" website ঢোকে আর slow load হয় → bounce → lost forever।

### 🟡 সমস্যা ১০: Telegram link spam detection

ভিডিওতে বারবার "Telegram join করুন" → TikTok/Facebook algorithm penalize করবে (off-platform redirect)।

---

## অংশ ২: সমাধান ও বিকল্প (Solutions)


| সমস্যা                             | সমাধান                                                                                                                                                                                                             |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ১. Trend research দুর্বল           | **Hybrid approach:** YouTube API + আপনার manual "Daily Pulse" input (২ মিনিট প্রতিদিন: কী দেখলেন Telegram-এ, কোন competitor কী post করছে)। AI দুটো mix করে। প্রতি ৩ ঘণ্টায় run না করে দিনে ১ বার।                 |
| ২. বাংলা slang নেই                 | **Style Memory:** আপনার নিজের ১০-২০টা পুরনো post/caption upload করবেন → AI সেই tone copy করবে। "Few-shot prompting" দিয়ে ৩x ভালো output।                                                                          |
| ৩. Virality score illusion         | Score-কে "AI confidence" বলব, "viral prediction" না। সাথে **Real Performance Tracker** — আপনি publish-এর ২৪/৪৮/৭২ ঘণ্টা পরে actual views input করবেন → AI score-এর সাথে compare → AI নিজের scoring calibrate করবে। |
| ৪. Video render Lovable-এ না       | **Phase 1: Script + Storyboard + Voiceover text export।** Phase 2: ElevenLabs API দিয়ে direct audio file generate (Lovable থেকে call করা যায়)। Phase 3: external render worker (পরে)।                            |
| ৫. ১০০ Gemini key risk             | **Lovable AI Gateway use করুন (free monthly allowance), + maximum ৩-৫টা personal Gemini keys backup হিসেবে।** Smart rotation শুধু backup-এর জন্য।                                                                  |
| ৬. Calendar vs trend contradiction | **Hybrid Calendar:** ৭০% slots pre-defined theme (Mon=Revenge Trading), ৩০% "Trend Override slots" যেখানে breaking news / viral angle inject হবে।                                                                  |
| ৭. দিনে ৩ video burnout            | **Realistic mode:** প্রতিদিন ১টা video (best time slot), সপ্তাহে ৭টা। শক্তি থাকলে ২য়টা bonus। AI default ১ suggest করবে, "Power mode" toggle দিলে ৩।                                                              |
| ৮. Performance data নেই            | **Simple Manual Input UI:** publish-এর পর একটা card আসবে "এই video-র ২৪hr পরে views কত?" — ৫ সেকেন্ডে input। AI learn করবে।                                                                                        |
| ৯. Slow website                    | এই project-এর scope-এ না, কিন্তু **warning দেখাবে** যদি sentixai4.xo.je slow load করে (Lovable থেকে uptime ping)।                                                                                                  |
| ১০. Telegram link penalty          | AI script-এ Telegram link **video description-এ রাখার suggestion দিবে**, video-এর শেষে শুধু "প্রোফাইলে লিংক" overlay।                                                                                              |


---

## অংশ ৩: Advanced User-Friendly Features (নতুন যা যুক্ত হবে)

### 🎯 ১. "Daily Pulse" — ২ মিনিট smart input

সকালে app খুললে একটা simple form:

- Telegram-এ আজ কী trending? (paste করুন)
- Competitor কেউ viral হয়েছে? (URL/screenshot)
- আজ market-এ বিশেষ কিছু? (news/event)

AI এই input + auto-scraped data merge করে দিনের strategy লিখবে। **কোনো জটিল setup ছাড়াই real intelligence**।

### 🎯 ২. "Style Memory" — আপনার voice শেখা

আপনার পুরনো ১০-২০টা post upload করবেন একবার → AI প্রতিটা future script আপনার exact tone-এ লিখবে। একবার setup, lifetime benefit।

### 🎯 ৩. "Inspiration Vault" — Competitor monitor (manual + smart)

Top ৫-১০টা competitor channel URL save করুন → AI weekly summary: "এরা এই সপ্তাহে কী করেছে, কোনটা viral হয়েছে, কেন"। আপনি copy করবেন না — pattern শিখবেন।

### 🎯 ৪. "One-Click Variants"

একটা topic-এর জন্য AI **৩টা different angle** দিবে এক click-এ:

- Emotional angle ("আজ আবার লস?")
- Logic angle ("Hurst Exponent কী?")
- Story angle ("আমার এক বন্ধু...")  
আপনি best-টা pick করবেন।

### 🎯 ৫. "Hook Library" + Auto-suggest

১০০+ proven Bengali trading hooks pre-loaded ("ভাই, এই ১ মিনিট দেখলে...") + AI আপনার script-এর সাথে match করে best hook suggest করবে।

### 🎯 ৬. "Visual Shot List" — CapCut-ready export

প্রতিটা script-এর সাথে:

- Scene-by-scene shot list (CSV/PDF)
- Suggested b-roll keywords (Pexels/Pixabay search-ready)
- Music mood + suggested track (Epidemic Sound / YouTube Audio Library থেকে)
- Subtitle SRT file ready
- Thumbnail concept (text + visual idea)

আপনি CapCut-এ ১০-১৫ মিনিটে assemble করতে পারবেন।

### 🎯 ৭. "Performance Loop" — AI calibration

প্রতি video-এর ৪৮ ঘণ্টা পর notification: "Views কত?" → ৫ সেকেন্ডে input → AI বুঝবে কোন hook/topic/time আসলে কাজ করে → পরবর্তী suggestion better।

### 🎯 ৮. "Approval Workflow" — সবসময় আপনি control-এ

কোনো video auto-publish হবে না। প্রতিটা step আপনি approve/edit/reject করবেন। AI assistant, master না।

### 🎯 ৯. "Halal Mode" toggle

শনি-রবি default: forex বন্ধ → AI শুধু crypto/halal content suggest করবে। Eid/Ramadan-এ "Eid trading psychology" auto-theme।

### 🎯 ১০. "Calm Mode" — Burnout prevention

যদি ৩ দিন একটানা ২+ video publish করেন → AI suggest করবে: "আজ rest নিন, generic post-ও OK"। Mental health > content quantity।

### 🎯 ১১. "Vision Inbox" — Quick screenshot analysis

Telegram screenshot/profit chart drag-drop করলে Gemini Vision analyze করে instant suggestion দিবে: "এটা আজকের evening video-র proof segment-এ ব্যবহার করুন"।

### 🎯 ১২. "Weekly Reset" Sunday Ritual

প্রতি রবিবার ৫ মিনিটের review:

- গত সপ্তাহে কী কাজ করেছে
- কী কাজ করেনি
- AI পরের সপ্তাহের updated calendar suggest করবে  
এক জায়গায় সব দেখবেন, decision নিবেন।

### 🎯 ১৩. "Bengali Polish Pass"

Script generate হওয়ার পর একটা extra AI pass যা শুধু বাংলা ভাষাটা polish করে — slang, audience-relatable, না খুব formal না খুব cringe।

### 🎯 ১৪. Mobile-friendly UI

আপনি phone থেকেই সব approve/edit করতে পারবেন। বাসে বসে script approve, রাতে publish।

১৫.VIDEO STRUCTURE (1–1.5 MINUTE)

⏱ 0–3 sec

🔥 Viral hook (shock / fear / curiosity)

⏱ 3–20 sec

📉 Real problem (trader pain)

⏱ 20–45 sec

🧠 Market logic + explanation

⏱ 45–70 sec

📊 insight + risk truth

⏱ 70–90 sec

🧩 Sentix AI system + soft CTA

16.REAL-TIME AUDIENCE ANALYSIS ENGINE

প্রতিদিন AI প্রথমে এই প্রশ্নগুলোর answer analyse করবে:

📊 AUDIENCE WANT CHECK:

মানুষ এখন কী দেখছে? (trading / crypto / forex / OTC / signals)

মানুষ কোন সমস্যায় আছে? (loss, confusion, addiction)

মানুষ কী খুঁজছে? (profit, recovery, strategy, halal income)

কোন content viral হচ্ছে এখন?

17.📉 MARKET CONTENT TREND CHECK:

trending trading topics

viral finance reels pattern

crypto hype / forex news impact

Telegram signal group behavior

🧠 PSYCHOLOGY CHECK:

fear (loss)

greed (profit hope)

confusion (signals)

frustration (loss recovery)

curiosity (hidden truth)

👉 এই 3 layer combine করে content idea বের করতে হবে

. VIRALITY PREDICTION SYSTEM

প্রতিটি ভিডিও idea generate করার আগে AI calculate করবে:

📊 VIRAL SCORE (0–100):

Hook strength (0–25)

Emotional trigger (0–25)

Relatability (0–20)

Trend alignment (0–15)

Market timing relevance (0–15)

👉 যদি score < 70 → reject idea

👉 যদি score ≥ 70 → script generate

 FUTURE TREND PREDICTION LOGIC

AI must predict next 7 days content demand:

upcoming news impact (USD / crypto)

weekend OTC behavior

trader psychology cycles

loss spike periods (end week / after news)

👉 এরপর decide করবে: “আগামী 7 দিনে কোন content বেশি viral হবে”

18🎯 CONTENT DECISION RULE (IMPORTANT)

AI কখনো fixed topic follow করবে না।

বরং প্রতিদিন decide করবে:

👉 আজকের best video angle:

Pain angle?

News angle?

Manipulation angle?

Psychology angle?

Risk warning angle?

👉 based on:

current market

audience demand

trend behavior

---

## অংশ ৪: Final Phase 1 Build Plan (যা আমি বানাব)

### Stack

- TanStack Start + Lovable Cloud (Supabase)
- **Lovable AI Gateway as primary** (Gemini 3 flash) — আপনার keys backup
- Email/password + Google login (শুধু আপনি admin)
- Dark Cyberpunk theme (oklch tokens)
- Bengali-first UI, English secondary

### Database (key tables)


| Table                 | কী রাখে                                       |
| --------------------- | --------------------------------------------- |
| `style_memory`        | আপনার tone samples                            |
| `daily_pulse`         | প্রতিদিনের manual input + auto-scraped trends |
| `competitor_channels` | URLs + weekly digest                          |
| `content_ideas`       | AI-generated, ৩ variants সহ                   |
| `scripts`             | full script + scene breakdown + SRT           |
| `hooks_library`       | ১০০+ pre-loaded + custom                      |
| `sentix_features`     | আপনার system features rotation queue          |
| `videos_published`    | publish log + performance input               |
| `weekly_calendar`     | ৭০% fixed + ৩০% trend slots                   |
| `gemini_keys`         | backup keys + rotation state                  |
| `ai_calibration`      | predicted vs actual performance               |


### Pages

1. **Dashboard** — today's pipeline, performance summary, quick Daily Pulse
2. **Idea Lab** — ৫টা today's ideas, ৩-variant generator
3. **Script Studio** — full script + scene-by-scene + export buttons
4. **Hook Library** — search/filter/favorite hooks
5. **Calendar** — ৩০-day view, theme + trend slots
6. **Performance Tracker** — input + AI calibration insights
7. **Inspiration Vault** — competitor digest
8. **Settings** — Gemini keys, Style Memory, Sentix Features library

### Server Functions (createServerFn)

- `generateIdeas()` — uses Lovable AI + Daily Pulse
- `generateScript(ideaId, angle)` — full script with shot list
- `polishBengali(scriptId)` — second pass
- `scoreVirality(scriptId)` — AI confidence + reasoning
- `analyzeVisionUpload(imageUrl)` — Gemini Vision
- `dailyTrendFetch()` — cron via `/api/public/cron/trends`
- `weeklyCompetitorDigest()` — cron
- `recordPerformance(videoId, views)` — feedback loop

### Build Order

1. **Foundation:** Cloud + auth + admin role + design system
2. **DB schema + RLS + grants**
3. **Settings page:** Style Memory upload, Gemini keys, Sentix Features
4. **Daily Pulse + Dashboard skeleton**
5. **Idea Lab** (৩-variant generator)
6. **Script Studio** + Bengali polish + scene breakdown + SRT export
7. **Hook Library** (pre-loaded + custom)
8. **Calendar view** (hybrid ৭০/৩০)
9. **Vision upload analyzer**
10. **Performance Tracker + calibration**
11. **Inspiration Vault** (competitor digest)
12. **Calm Mode + notifications**

প্রতি step শেষে test → পরের step।

---

## যা MVP-তে নেই (পরে)

- Auto video render (Phase 3, external worker)
- Direct YouTube/TikTok upload (Phase 4)
- ElevenLabs voiceover (Phase 2)
- Real-time competitor scraping (manual digest দিয়ে replace)

---

**বাস্তবতা:** এই system আপনাকে দিনে ১৫-৩০ মিনিট কাজ কমিয়ে দিবে, ১০০% replace করবে না। কারণ Trading content-এ আসল personality আপনার। AI = assistant, আপনি = strategist।

Plan accept করলে "Implement" চাপুন — আমি Foundation থেকে শুরু করব।