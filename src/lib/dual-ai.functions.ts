import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function callRotated(ctx: any, opts: any) {
  const { callLLMWithRotation } = await import("./gemini-pool.server");
  return callLLMWithRotation(ctx.supabase, ctx.userId, opts);
}

async function ensureAdmin(ctx: any) {
  const { data } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden: admin only");
}

const STRATEGIST_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    hook: { type: "string" },
    full_script: { type: "string" },
    scenes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          start_sec: { type: "number" },
          end_sec: { type: "number" },
          narration: { type: "string" },
          visual: { type: "string" },
          on_screen_text: { type: "string" },
          effects: { type: "string" },
          broll_keywords: { type: "string" },
        },
        required: ["start_sec", "end_sec", "narration", "visual", "on_screen_text", "effects", "broll_keywords"],
      },
    },
    music_mood: { type: "string" },
    caption: { type: "string" },
    hashtags: { type: "string" },
    thumbnail_concept: { type: "string" },
    srt: { type: "string" },
    rationale: { type: "string" },
  },
  required: ["title", "hook", "full_script", "scenes", "music_mood", "caption", "hashtags", "thumbnail_concept", "srt", "rationale"],
};

const CRITIC_SCHEMA = {
  type: "object",
  properties: {
    score: { type: "number", description: "0-10 overall" },
    breakdown: {
      type: "object",
      properties: {
        hook_strength: { type: "number" },
        bengali_authenticity: { type: "number" },
        logic_clarity: { type: "number" },
        cta_strength: { type: "number" },
        identity_build: { type: "number" },
        safe_zone: { type: "number", description: "subtitle overlap avoidance" },
        authority_tone: { type: "number", description: "educator vs VIP-seller — higher = more educator" },
      },
      required: ["hook_strength", "bengali_authenticity", "logic_clarity", "cta_strength", "identity_build", "safe_zone", "authority_tone"],
    },
    feedback: { type: "string", description: "Specific actionable feedback for the Strategist" },
    pass: { type: "boolean" },
  },
  required: ["score", "breakdown", "feedback", "pass"],
};

const STRATEGIST_SYSTEM = `তুমি Sentix AI Strategist — Bangladesh-এর elite viral trading content writer।

Brand: Sentix AI = logic-based trading education, ১০০% FREE, কোনো VIP / fake profit / guarantee নেই।
Audience: Bangladeshi traders যারা VIP-seller scam-এ ক্লান্ত।
Tone: Educator, real talk, বাংলা slang OK, "ভাই" cliché না, authority + empathy।

Output: 60-90 sec script + scene-by-scene shot list + SRT + caption + thumbnail concept।
Structure:
- 0-3s: scroll-stop hook
- 3-20s: relatable pain
- 20-45s: market logic / hidden truth
- 45-70s: smart realization
- 70-90s: Sentix soft mention + follow CTA

CRITICAL safe-zone rule: on_screen_text কখনো screen-এর bottom 20% বা right 15%-এ রাখবে না (TikTok like/comment button overlap)।
Authority tone: "VIP signal বেচি না, logic শেখাই" — এই vibe।`;

const CRITIC_SYSTEM = `তুমি Sentix AI Critic — strict quality judge। নিচের script evaluate করো ৭টা dimension-এ (each 0-10):
1. hook_strength: প্রথম ৩ সেকেন্ড scroll-stop?
2. bengali_authenticity: natural Bengali, না cringe না robotic?
3. logic_clarity: trading logic পরিষ্কার?
4. cta_strength: Sentix mention subtle + natural?
5. identity_build: smart trader identity তৈরি করছে?
6. safe_zone: on_screen_text TikTok UI button-এর জায়গায় পড়ছে কিনা (bottom 20%, right 15% avoid)?
7. authority_tone: "educator" vibe (10) vs "VIP seller" vibe (0)?

overall score = average of all 7।
pass = true যদি overall ≥ 9.0।
feedback = Strategist-কে specific instructions দাও কী কী fix করতে হবে।`;

export const runDualAILoop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      ideaId: z.string(),
      variantIndex: z.number().min(0).max(2),
      targetScore: z.number().min(7).max(10).default(9),
      maxIterations: z.number().min(1).max(5).default(3),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const ctx: any = context;

    const { data: idea } = await ctx.supabase
      .from("content_ideas")
      .select("*")
      .eq("id", data.ideaId)
      .maybeSingle();
    if (!idea) throw new Error("Idea not found");
    const variant = (idea.variants as any[])[data.variantIndex];
    if (!variant) throw new Error("Variant not found");

    const { data: styleData } = await ctx.supabase.from("style_memory").select("sample_text").limit(8);
    const styleNote = styleData?.length
      ? "\n\nVoice samples:\n" + styleData.map((s: any) => `- ${s.sample_text}`).join("\n")
      : "";

    // Insert placeholder script so dual_ai_runs can reference it
    const { data: scriptRow, error: sErr } = await ctx.supabase
      .from("scripts")
      .insert({
        idea_id: idea.id,
        user_id: ctx.userId,
        title: `[Generating] ${idea.topic}`,
        full_script: "",
        scenes: [],
        status: "generating",
      })
      .select()
      .single();
    if (sErr) throw new Error(sErr.message);
    const scriptId = scriptRow.id;

    let strategistOut: any = null;
    let criticOut: any = null;
    let lastFeedback = "";
    let iteration = 0;
    let finalStatus: "approved" | "needs_review" | "rejected" = "rejected";

    for (iteration = 1; iteration <= data.maxIterations; iteration++) {
      // STRATEGIST
      const stratUser = `Topic: ${idea.topic}
Theme: ${idea.theme}
Angle: ${variant.angle}
Hook seed: ${variant.hook}
Summary: ${variant.summary}
Pain point: ${idea.pain_point}
${lastFeedback ? `\n\nPrevious Critic feedback (must address):\n${lastFeedback}` : ""}${styleNote}

Production-ready script generate করো।`;

      const stratWrap = await callRotated(ctx, {
        system: STRATEGIST_SYSTEM,
        user: stratUser,
        tools: [{ type: "function", function: { name: "submit_script", parameters: STRATEGIST_SCHEMA } }],
        toolChoice: { type: "function", function: { name: "submit_script" } },
      });
      strategistOut = stratWrap.result;

      await ctx.supabase.from("dual_ai_runs").insert({
        user_id: ctx.userId,
        script_id: scriptId,
        idea_id: idea.id,
        iteration,
        role: "strategist",
        content: strategistOut,
      });

      // CRITIC
      const critUser = `Script title: ${strategistOut.title}
Hook: ${strategistOut.hook}
Full script:
${strategistOut.full_script}

Scenes (with on_screen_text positions):
${JSON.stringify(strategistOut.scenes, null, 2)}

Caption: ${strategistOut.caption}`;

      const critWrap = await callRotated(ctx, {
        system: CRITIC_SYSTEM,
        user: critUser,
        tools: [{ type: "function", function: { name: "submit_critique", parameters: CRITIC_SCHEMA } }],
        toolChoice: { type: "function", function: { name: "submit_critique" } },
      });
      criticOut = critWrap.result;

      await ctx.supabase.from("dual_ai_runs").insert({
        user_id: ctx.userId,
        script_id: scriptId,
        idea_id: idea.id,
        iteration,
        role: "critic",
        content: criticOut,
        score: criticOut.score,
        feedback: criticOut.feedback,
      });

      if (criticOut.score >= data.targetScore) {
        finalStatus = "approved";
        break;
      }
      lastFeedback = criticOut.feedback;
    }

    if (finalStatus !== "approved") {
      if (criticOut && criticOut.score >= 7.5) finalStatus = "needs_review";
      else finalStatus = "rejected";
    }

    // Persist final script
    const finalUpdate: any = {
      title: strategistOut.title,
      hook: strategistOut.hook,
      full_script: strategistOut.full_script,
      scenes: strategistOut.scenes,
      music_mood: strategistOut.music_mood,
      caption: strategistOut.caption,
      hashtags: strategistOut.hashtags,
      thumbnail_concept: strategistOut.thumbnail_concept,
      srt: strategistOut.srt,
      virality_score: Math.round((criticOut?.score ?? 0) * 10),
      virality_breakdown: criticOut?.breakdown,
      final_score: criticOut?.score,
      iterations_used: iteration > data.maxIterations ? data.maxIterations : iteration,
      needs_review_reason: finalStatus === "needs_review" ? criticOut?.feedback : null,
      status: finalStatus,
      updated_at: new Date().toISOString(),
    };
    await ctx.supabase.from("scripts").update(finalUpdate).eq("id", scriptId);
    await ctx.supabase
      .from("content_ideas")
      .update({ selected_variant_index: data.variantIndex, status: "scripted" })
      .eq("id", idea.id);

    // Mark final iteration status on the last critic row
    const { data: lastRun } = await ctx.supabase
      .from("dual_ai_runs")
      .select("id")
      .eq("script_id", scriptId)
      .eq("role", "critic")
      .order("iteration", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastRun) await ctx.supabase.from("dual_ai_runs").update({ final_status: finalStatus }).eq("id", lastRun.id);

    return {
      scriptId,
      status: finalStatus,
      score: criticOut?.score,
      iterations: finalUpdate.iterations_used,
    };
  });

export const getDualAiRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ scriptId: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx: any = context;
    const { data: rows } = await ctx.supabase
      .from("dual_ai_runs")
      .select("*")
      .eq("script_id", data.scriptId)
      .order("iteration", { ascending: true })
      .order("created_at", { ascending: true });
    return { runs: rows ?? [] };
  });
