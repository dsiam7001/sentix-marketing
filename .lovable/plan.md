## Plan

1. **Fix GitHub connectivity and workflow sync**
  - Keep GitHub PAT server-side only; never hardcode it in app code.
  - Set default repo metadata in the app to `dsiam7001/sentix-marketing` when user-specific settings are empty.
  - Change all GitHub requests to consistently use authenticated headers for private repos.
  - Add a server-side “ensure workflow” action that checks `.github/workflows/render.yml` in the target repo and creates/updates it through the GitHub API when missing or outdated.
  - Improve System Doctor GitHub output to show: authenticated user, repo reachable, private/public, workflow present/synced, dispatch permission status.
2. **Fix Pixabay HTTP 400 and split image/video keys**
  - Add separate settings slots for `PIXABAY_IMAGE_API_KEY` and `PIXABAY_VIDEO_API_KEY`, while keeping the old `PIXABAY_API_KEY` as fallback.
  - Test image search against `https://pixabay.com/api/` and video search against `https://pixabay.com/api/videos/` with correct query params.
  - Update asset search/planning to use the image key for image assets and video key for video assets.
  - Make Doctor report the actual API error message when Pixabay returns 400, not just `HTTP 400`.
3. **Add one-click Mastermind EXECUTE button**
  - Add a prominent `EXECUTE` button on Mission Control.
  - Implement a protected server function that runs the complete chain:
  1. generate/fetch current signal or user topic,
  2. create 5 ideas,
  3. pick the strongest idea,
  4. run Dual-AI with a 9.0 score gate,
  5. auto-regenerate/retry when score is below threshold,
  6. plan assets,
  7. ensure GitHub workflow exists,
  8. dispatch render,
  9. log every step for proof.
    d self-healing: retry with another AI key/template when supported; when a third-party service fails, fallback to alternative asset source or generated visuals.
4. **Doctor red-light cleanup**
  - Make Doctor distinguish `fail`, `warn`, and `optional skip` so optional services do not appear as blocking red lights.
  - Add repair actions where possible: workflow sync, settings defaults, callback URL validation.
  - Keep unavoidable missing paid/optional APIs as clear warnings with the exact fix needed.
5. **Update confusing text and workflow labels**
  - Replace “Telegram trending” wording with platform-neutral wording for YouTube/Facebook/Instagram/TikTok trends or any custom topic you type.
  - Add a custom topic/signal input so you can force the system to generate ideas around your chosen topic.
6. **Verify Script Studio actions**
  - Check approve/reject/delete/restore paths and add missing error handling/toasts if any action silently fails.
  - Ensure bulk actions refresh the list correctly and do not break after deletion/restoration.
7. **Hook Library improvement**
  - Stop treating the seeded 50 hooks as fixed/best.
  - Add AI-generated hook selection during idea/script generation.
  - Keep seed hooks only as optional inspiration and allow deleting/customizing user-created hooks.
8. **Performance and Inspiration reliability**
  - Adjust Performance UI so manually entered view data is clearly marked as manual.
  - Add delete support for tracked performance rows/topics.
  - For Inspiration URLs, avoid fake percentages: only show “measured” when real analysis data exists; otherwise show pending/needs source data.
9. **Upload reference video/file flow**
  - Add an upload/reference input path for screenshots/images/video references.
  - For images/screenshots, analyze the visual style/structure and create script/scene guidance.
  - For videos, provide a practical first version: upload/link + metadata/style notes; full video understanding depends on available processing limits, so if direct video analysis is not available, use frame/image extraction or user-provided screenshots as fallback.
10. **Final proof run**
  - After implementation, run Doctor and then trigger one Mastermind execution from the app.
  - Provide proof from logs: Doctor summary, pipeline run steps, render job ID, GitHub dispatch result, and Telegram callback/delivery status.
  - I can verify dispatch and callback status from the app/backend logs; actual Telegram delivery also depends on the configured bot/chat and the external GitHub render completing successfully.
11. Evidence from video scripts to telegrams
  যখন সকল কিছু করা শেষ আপডেট করা শেষ তারপরে আরেকটা ফাইনাল কাজ করবে ।  নিজেই এই অ্যাপের মাধ্যমে একটা ভিডিও স্ক্রিপ্ট যেভাবে যে পর্যায়ে যা যা করা হয় সম্পূর্ণ পর্যায় সম্পন্ন কাজ করে আমার টেলিগ্রামে ভিডিও পৌঁছে দিবে এটা হবে প্রমাণ মানে আমার ১০০ পার্সেন্ট প্রমাণ লাগবে যে সকল কিছু আপডেট করা হয়েছে সকল কিছু ঠিকঠাক কাজ করতে আছে। তাই একটা ভিডিও স্ক্রিপ তৈরি করা আইডিয়া নেওয়া যা যা করা লাগে প্রথম থেকে শেষ পর্যন্ত করার পরে আমার টেলিগ্রামে ভিডিও আসতে হবে এর মাধ্যমে সকল কাজ শেষ হবে এবং ভিডিও আসার আগ পর্যন্ত সম্পূর্ণটুকু অবজারভেশনে থাকবে কি কি সমস্যা হচ্ছে না হচ্ছে যতক্ষণ পর্যন্ত ভিডিও না আসবে ততক্ষণ পর্যন্ত কাজ চলমান থাকবে ঠিক করা হবে সকল সমস্যা