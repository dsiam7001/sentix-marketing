// Server-only internals for the autopilot engine. Inlined so we don't have
// to re-export every existing function. Reuses gemini pool + asset helpers.

import { callLLMWithRotation } from "./gemini-pool.server";

const ideaSchema = {
  type: "object",
  properties: {
    ideas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          topic: { type: "string" },
          theme: { type: "string" },
          time_slot: { type: "string" },
          rationale: { type: "string" },
          pain_point: { type: "string" },
          variants: {
            type: "array",
            items: {
              type: "object",
              properties: {
                angle: { type: "string" },
                hook: { type: "string" },
                summary: { type: "string" },
              },
              required: ["angle", "hook", "summary"],
            },
          },
          virality_score: { type: "number" },
        },
        required: ["topic", "theme", "time_slot", "rationale", "pain_point", "variants", "virality_score"],
      },
    },
  },
  required: ["ideas"],
};

export async function generateIdeasInternal(supabase: any, userId: string, tone: string) {
  const today = new Date();
  const day = ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহঃ", "শুক্র", "শনি"][today.getDay()];
  const system = `তুমি Sentix AI Strategist। বাংলাদেশী trader audience-এর জন্য 60-90 sec viral content ideas generate করো। আজকের mood: ${tone}. প্রতিটার ৩টা variant (emotional/logic/story) দাও।`;
  const user = `আজ ${day}বার, time slot tone: ${tone}. 5টা production-ready idea দাও।`;
  const wrap = await callLLMWithRotation(supabase, userId, {
    system, user,
    tools: [{ type: "function", function: { name: "submit_ideas", parameters: ideaSchema } }],
    toolChoice: { type: "function", function: { name: "submit_ideas" } },
  });
  const rows = wrap.result.ideas.map((idea: any) => ({
    user_id: userId,
    topic: idea.topic,
    theme: idea.theme,
    time_slot: idea.time_slot,
    rationale: idea.rationale,
    pain_point: idea.pain_point,
    variants: idea.variants,
    virality_score: idea.virality_score,
    status: "pending",
  }));
  const { data } = await supabase.from("content_ideas").insert(rows).select();
  return data ?? [];
}

const STRAT_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" }, hook: { type: "string" }, full_script: { type: "string" },
    scenes: { type: "array", items: { type: "object", properties: {
      start_sec: { type: "number" }, end_sec: { type: "number" },
      narration: { type: "string" }, visual: { type: "string" },
      on_screen_text: { type: "string" }, effects: { type: "string" }, broll_keywords: { type: "string" },
    }, required: ["start_sec", "end_sec", "narration", "visual", "on_screen_text", "effects", "broll_keywords"] } },
    music_mood: { type: "string" }, caption: { type: "string" }, hashtags: { type: "string" },
    thumbnail_concept: { type: "string" }, srt: { type: "string" },
  },
  required: ["title", "hook", "full_script", "scenes", "music_mood", "caption", "hashtags", "thumbnail_concept", "srt"],
};

const CRIT_SCHEMA = {
  type: "object",
  properties: {
    score: { type: "number" },
    feedback: { type: "string" },
    pass: { type: "boolean" },
  },
  required: ["score", "feedback", "pass"],
};

export async function runDualAIInternal(supabase: any, userId: string, ideaId: string, variantIndex: number) {
  const { data: idea } = await supabase.from("content_ideas").select("*").eq("id", ideaId).maybeSingle();
  if (!idea) throw new Error("Idea not found");
  const variant = (idea.variants as any[])[variantIndex];
  const { data: scriptRow } = await supabase.from("scripts").insert({
    idea_id: idea.id, user_id: userId, title: `[Auto] ${idea.topic}`, full_script: "", scenes: [], status: "generating",
  }).select().single();

  let strat: any = null, crit: any = null, feedback = "";
  for (let i = 1; i <= 3; i++) {
    const stratWrap = await callLLMWithRotation(supabase, userId, {
      system: "তুমি Sentix Strategist — বাংলা viral trading script (60-90 sec)।",
      user: `Topic: ${idea.topic}\nAngle: ${variant.angle}\nHook: ${variant.hook}\n${feedback ? "Critic feedback:\n" + feedback : ""}`,
      tools: [{ type: "function", function: { name: "submit_script", parameters: STRAT_SCHEMA } }],
      toolChoice: { type: "function", function: { name: "submit_script" } },
    });
    strat = stratWrap.result;
    await supabase.from("dual_ai_runs").insert({
      user_id: userId, script_id: scriptRow.id, idea_id: idea.id, iteration: i, role: "strategist", content: strat,
    });
    const critWrap = await callLLMWithRotation(supabase, userId, {
      system: "তুমি Critic — 0-10 score দাও, pass=true if >=9.",
      user: `Script:\n${strat.full_script}`,
      tools: [{ type: "function", function: { name: "submit_critique", parameters: CRIT_SCHEMA } }],
      toolChoice: { type: "function", function: { name: "submit_critique" } },
    });
    crit = critWrap.result;
    await supabase.from("dual_ai_runs").insert({
      user_id: userId, script_id: scriptRow.id, idea_id: idea.id, iteration: i, role: "critic",
      content: crit, score: crit.score, feedback: crit.feedback,
    });
    if (crit.score >= 9) break;
    feedback = crit.feedback;
  }
  const status = crit.score >= 9 ? "approved" : crit.score >= 7.5 ? "needs_review" : "rejected";
  await supabase.from("scripts").update({
    title: strat.title, hook: strat.hook, full_script: strat.full_script, scenes: strat.scenes,
    music_mood: strat.music_mood, caption: strat.caption, hashtags: strat.hashtags,
    thumbnail_concept: strat.thumbnail_concept, srt: strat.srt,
    final_score: crit.score, virality_score: Math.round(crit.score * 10),
    status, updated_at: new Date().toISOString(),
  }).eq("id", scriptRow.id);
  await supabase.from("content_ideas").update({ selected_variant_index: variantIndex, status: "scripted" }).eq("id", idea.id);
  return { scriptId: scriptRow.id, score: crit.score, status };
}

export async function planAssetsInternal(supabase: any, userId: string, scriptId: string) {
  const { getUserSecret } = await import("./secrets.server");
  const pexKey = await getUserSecret(supabase, userId, "PEXELS_API_KEY");
  const { data: script } = await supabase.from("scripts").select("id, scenes").eq("id", scriptId).maybeSingle();
  if (!script) throw new Error("Script not found");
  const plan: any[] = [];
  for (const scene of (script.scenes as any[]) ?? []) {
    const kw = scene.broll_keywords || scene.visual || "trading chart";
    let assets: any[] = [];
    if (pexKey) {
      const r = await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(kw)}&per_page=3&orientation=portrait`, { headers: { Authorization: pexKey } });
      if (r.ok) {
        const j: any = await r.json();
        assets = (j.videos ?? []).map((v: any) => {
          const f = v.video_files?.find((ff: any) => ff.quality === "hd") ?? v.video_files?.[0];
          return { source: "pexels", url: f?.link, preview: v.image, duration: v.duration };
        }).filter((a: any) => a.url);
      }
    }
    if (assets.length === 0) {
      assets = [{ source: "pollinations", url: `https://image.pollinations.ai/prompt/${encodeURIComponent("cinematic trading " + kw)}?width=1080&height=1920&nologo=true&enhance=true` }];
    }
    plan.push({
      start_sec: scene.start_sec, end_sec: scene.end_sec, narration: scene.narration,
      on_screen_text: scene.on_screen_text, keyword: kw, chosen: assets[0], alternatives: assets.slice(1),
    });
  }
  await supabase.from("scripts").update({ asset_plan: plan }).eq("id", scriptId);
}

export async function triggerRenderInternal(supabase: any, userId: string, scriptId: string) {
  const { getUserSecret } = await import("./secrets.server");
  const { createHmac } = await import("crypto");
  const pat = await getUserSecret(supabase, userId, "GITHUB_PAT");
  const owner = (await getUserSecret(supabase, userId, "GITHUB_REPO_OWNER")) || "dsiam7001";
  const repo = (await getUserSecret(supabase, userId, "GITHUB_REPO_NAME")) || "sentix-marketing";
  const secret = await getUserSecret(supabase, userId, "RENDER_CALLBACK_SECRET");
  const base = await getUserSecret(supabase, userId, "PUBLIC_BASE_URL");
  if (!pat || !secret) throw new Error("GitHub render not configured (need GITHUB_PAT + RENDER_CALLBACK_SECRET)");
  const cbUrl = `${(base ?? "https://project--490123ce-11f1-405e-91bd-0d2ba0200065.lovable.app").replace(/\/$/, "")}/api/public/render-callback`;

  const { data: script } = await supabase.from("scripts").select("*").eq("id", scriptId).single();
  if (!script.asset_plan || (script.asset_plan as any[]).length === 0) throw new Error("No asset plan");
  const { data: job } = await supabase.from("render_jobs").insert({
    user_id: userId, script_id: script.id, status: "queued",
    payload: { title: script.title, full_script: script.full_script, scenes: script.scenes, asset_plan: script.asset_plan, srt: script.srt, music_mood: script.music_mood },
  }).select().single();
  const sig = createHmac("sha256", secret).update(`${job.id}:${script.id}`).digest("hex");

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/dispatches`, {
    method: "POST",
    headers: { Authorization: `Bearer ${pat}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
    body: JSON.stringify({
      event_type: "sentix-render",
      client_payload: {
        job_id: job.id, script_id: script.id, callback_url: cbUrl, signature: sig,
        title: script.title, full_script: script.full_script, scenes: script.scenes,
        asset_plan: script.asset_plan, srt: script.srt, music_mood: script.music_mood,
      },
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    await supabase.from("render_jobs").update({ status: "failed", error: `GitHub ${res.status}: ${txt.slice(0, 200)}` }).eq("id", job.id);
    throw new Error(`GitHub dispatch ${res.status}`);
  }
  await supabase.from("scripts").update({ render_status: "dispatched" }).eq("id", script.id);
  return { jobId: job.id };
}
