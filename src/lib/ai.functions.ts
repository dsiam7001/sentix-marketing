import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL_TEXT = "google/gemini-3-flash-preview";
const MODEL_VISION = "google/gemini-2.5-pro";

async function callAI(opts: {
  system: string;
  user: string;
  tools?: any[];
  toolChoice?: any;
  model?: string;
  imageUrl?: string;
}) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY missing");

  const userContent: any = opts.imageUrl
    ? [
        { type: "text", text: opts.user },
        { type: "image_url", image_url: { url: opts.imageUrl } },
      ]
    : opts.user;

  const body: any = {
    model: opts.model ?? MODEL_TEXT,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: userContent },
    ],
  };
  if (opts.tools) {
    body.tools = opts.tools;
    body.tool_choice = opts.toolChoice;
  }

  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 429)
      throw new Error("AI rate-limited. একটু পরে আবার চেষ্টা করুন।");
    if (res.status === 402)
      throw new Error("AI credit শেষ। Workspace-এ credit add করুন।");
    throw new Error(`AI error ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  const msg = json.choices?.[0]?.message;
  if (opts.tools) {
    const call = msg?.tool_calls?.[0];
    if (!call) throw new Error("AI did not return structured output");
    return JSON.parse(call.function.arguments);
  }
  return msg?.content ?? "";
}

async function ensureAdmin(ctx: any) {
  const { data, error } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error || !data) throw new Error("Forbidden: admin only");
}

async function loadStyleSamples(ctx: any): Promise<string> {
  const { data } = await ctx.supabase
    .from("style_memory")
    .select("sample_text")
    .limit(10);
  if (!data || data.length === 0) return "";
  return (
    "\n\nতোমার tone reference (এই style/voice copy করো):\n" +
    data.map((d: any, i: number) => `[${i + 1}] ${d.sample_text}`).join("\n")
  );
}

async function loadSentixFeatures(ctx: any): Promise<string> {
  const { data } = await ctx.supabase
    .from("sentix_features")
    .select("feature_name, description")
    .order("promote_priority", { ascending: false })
    .limit(5);
  if (!data || data.length === 0) return "";
  return (
    "\n\nSentix AI features (rotate করে promote করো):\n" +
    data.map((d: any) => `- ${d.feature_name}: ${d.description ?? ""}`).join("\n")
  );
}

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
          time_slot: { type: "string", enum: ["morning", "afternoon", "night"] },
          rationale: { type: "string" },
          pain_point: { type: "string" },
          variants: {
            type: "array",
            items: {
              type: "object",
              properties: {
                angle: { type: "string", enum: ["emotional", "logic", "story"] },
                hook: { type: "string" },
                summary: { type: "string" },
              },
              required: ["angle", "hook", "summary"],
              additionalProperties: false,
            },
            minItems: 3,
            maxItems: 3,
          },
          virality_score: { type: "number" },
          virality_breakdown: {
            type: "object",
            properties: {
              hook: { type: "number" },
              emotion: { type: "number" },
              relatability: { type: "number" },
              trend_alignment: { type: "number" },
              market_timing: { type: "number" },
            },
            required: ["hook", "emotion", "relatability", "trend_alignment", "market_timing"],
            additionalProperties: false,
          },
        },
        required: [
          "topic",
          "theme",
          "time_slot",
          "rationale",
          "pain_point",
          "variants",
          "virality_score",
          "virality_breakdown",
        ],
        additionalProperties: false,
      },
      minItems: 3,
      maxItems: 5,
    },
  },
  required: ["ideas"],
  additionalProperties: false,
};

export const generateIdeas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        pulseId: z.string().optional(),
        count: z.number().min(3).max(5).default(5),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const ctx: any = context;

    let pulseContext = "";
    if (data.pulseId) {
      const { data: pulse } = await ctx.supabase
        .from("daily_pulse")
        .select("*")
        .eq("id", data.pulseId)
        .maybeSingle();
      if (pulse) {
        pulseContext = `\nDaily Pulse:\n- Trending topic: ${pulse.telegram_trends ?? "—"}\n- Competitor viral: ${pulse.competitor_viral ?? "—"}\n- Market event: ${pulse.market_event ?? "—"}`;
      }
    }

    const style = await loadStyleSamples(ctx);
    const features = await loadSentixFeatures(ctx);

    const today = new Date();
    const day = ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহঃ", "শুক্র", "শনি"][today.getDay()];

    const system = `তুমি Sentix AI-র Elite Viral Trading Content Strategist। বাংলাদেশী trader audience-এর জন্য 60-90 second short video idea generate করো।

Brand rules:
- Fake profit / VIP scam / guaranteed win বলা যাবে না
- Market logic, psychology, risk management শেখাও
- বাংলা slang ব্যবহার করো (relatable, না cringe)
- প্রতিটা idea-র জন্য 3টা variant: emotional / logic / story angle

Virality scoring (0-100):
- Hook strength (0-25), Emotional trigger (0-25), Relatability (0-20), Trend alignment (0-15), Market timing (0-15)
${style}${features}`;

    const user = `আজ ${day}বার। ${data.count}টা content idea দাও। ${pulseContext}`;

    const result = await callAI({
      system,
      user,
      tools: [
        {
          type: "function",
          function: {
            name: "submit_ideas",
            description: "Submit content ideas",
            parameters: ideaSchema,
          },
        },
      ],
      toolChoice: { type: "function", function: { name: "submit_ideas" } },
    });

    const rows = result.ideas.map((idea: any) => ({
      user_id: ctx.userId,
      topic: idea.topic,
      theme: idea.theme,
      time_slot: idea.time_slot,
      rationale: idea.rationale,
      pain_point: idea.pain_point,
      variants: idea.variants,
      virality_score: idea.virality_score,
      virality_breakdown: idea.virality_breakdown,
      status: "pending",
    }));

    const { data: inserted, error } = await ctx.supabase
      .from("content_ideas")
      .insert(rows)
      .select();
    if (error) throw new Error(error.message);
    return { ideas: inserted };
  });

const scriptSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    hook: { type: "string" },
    full_script: { type: "string", description: "Complete Bengali narration, 60-90 sec" },
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
        required: [
          "start_sec",
          "end_sec",
          "narration",
          "visual",
          "on_screen_text",
          "effects",
          "broll_keywords",
        ],
        additionalProperties: false,
      },
    },
    music_mood: { type: "string" },
    caption: { type: "string" },
    hashtags: { type: "string" },
    thumbnail_concept: { type: "string" },
    srt: { type: "string", description: "Full SRT subtitle text" },
  },
  required: [
    "title",
    "hook",
    "full_script",
    "scenes",
    "music_mood",
    "caption",
    "hashtags",
    "thumbnail_concept",
    "srt",
  ],
  additionalProperties: false,
};

export const generateScript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        ideaId: z.string(),
        variantIndex: z.number().min(0).max(2),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const ctx: any = context;
    const { data: idea, error: ie } = await ctx.supabase
      .from("content_ideas")
      .select("*")
      .eq("id", data.ideaId)
      .maybeSingle();
    if (ie || !idea) throw new Error("Idea not found");
    const variant = (idea.variants as any[])[data.variantIndex];
    if (!variant) throw new Error("Variant not found");

    const style = await loadStyleSamples(ctx);
    const features = await loadSentixFeatures(ctx);

    const system = `তুমি Sentix AI-র Cinematic Reel Script Writer। বাংলাদেশী trader audience-এর জন্য 60-90 second video-র জন্য complete script লেখো।

Structure:
- 0-3 sec: Strong hook (scroll stop)
- 3-20 sec: Problem (relatable pain)
- 20-45 sec: Hidden truth + market logic
- 45-70 sec: Smart realization / insight
- 70-90 sec: Sentix AI soft mention + follow CTA

Rules:
- বাংলা narration, slang OK
- প্রতি 3 second-এ visual change
- Dark cinematic vibe
- Cliché "ভাই" না, real talk
- Direct VIP/profit promise না
- "sentixai4.xo.je" subtle mention শেষে
- SRT-তে actual timing দাও
${style}${features}`;

    const user = `Topic: ${idea.topic}
Theme: ${idea.theme}
Angle: ${variant.angle}
Hook idea: ${variant.hook}
Summary: ${variant.summary}
Pain point: ${idea.pain_point}

Complete production-ready script generate করো।`;

    const result = await callAI({
      system,
      user,
      tools: [
        {
          type: "function",
          function: {
            name: "submit_script",
            description: "Submit complete script",
            parameters: scriptSchema,
          },
        },
      ],
      toolChoice: { type: "function", function: { name: "submit_script" } },
    });

    const { data: inserted, error } = await ctx.supabase
      .from("scripts")
      .insert({
        idea_id: idea.id,
        user_id: ctx.userId,
        title: result.title,
        hook: result.hook,
        full_script: result.full_script,
        scenes: result.scenes,
        music_mood: result.music_mood,
        caption: result.caption,
        hashtags: result.hashtags,
        thumbnail_concept: result.thumbnail_concept,
        srt: result.srt,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    await ctx.supabase
      .from("content_ideas")
      .update({ selected_variant_index: data.variantIndex, status: "scripted" })
      .eq("id", idea.id);

    return { script: inserted };
  });

export const polishBengali = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ scriptId: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const ctx: any = context;
    const { data: script } = await ctx.supabase
      .from("scripts")
      .select("*")
      .eq("id", data.scriptId)
      .single();
    if (!script) throw new Error("Script not found");

    const style = await loadStyleSamples(ctx);
    const system = `তুমি Bengali polish editor। নিচের script-এর শুধু ভাষা refine করো — slang আরো natural, audience-relatable, না cringe না robotic। Length প্রায় same রাখো। Output শুধু polished script, কোনো explanation না।${style}`;

    const polished = await callAI({
      system,
      user: script.full_script,
    });

    const { data: updated, error } = await ctx.supabase
      .from("scripts")
      .update({ full_script: polished, polished: true, updated_at: new Date().toISOString() })
      .eq("id", data.scriptId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { script: updated };
  });

export const scoreVirality = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ scriptId: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const ctx: any = context;
    const { data: script } = await ctx.supabase
      .from("scripts")
      .select("*")
      .eq("id", data.scriptId)
      .single();
    if (!script) throw new Error("Script not found");

    const system = `তুমি viral content judge। নিচের script analyze করে 5টা dimension-এ score দাও + reasoning দাও।
NOTE: এটা AI-র confidence, viral guarantee না।`;
    const user = `Hook: ${script.hook}\n\nScript:\n${script.full_script}`;

    const result = await callAI({
      system,
      user,
      tools: [
        {
          type: "function",
          function: {
            name: "submit_score",
            parameters: {
              type: "object",
              properties: {
                hook: { type: "number" },
                emotion: { type: "number" },
                relatability: { type: "number" },
                trend_alignment: { type: "number" },
                market_timing: { type: "number" },
                total: { type: "number" },
                reasoning: { type: "string" },
                improvement_tips: { type: "string" },
              },
              required: [
                "hook",
                "emotion",
                "relatability",
                "trend_alignment",
                "market_timing",
                "total",
                "reasoning",
                "improvement_tips",
              ],
              additionalProperties: false,
            },
          },
        },
      ],
      toolChoice: { type: "function", function: { name: "submit_score" } },
    });

    const { data: updated, error } = await ctx.supabase
      .from("scripts")
      .update({ virality_score: result.total, virality_breakdown: result })
      .eq("id", data.scriptId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { score: result, script: updated };
  });

export const analyzeVisionUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ imageUrl: z.string().url(), context: z.string().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const system = `তুমি Trading screenshot analyzer। নিচের image-এ কী আছে describe করো এবং কীভাবে এটা একটা viral video-র "proof segment" হিসেবে use করা যায় suggest করো। Output বাংলায়।`;
    const result = await callAI({
      system,
      user: data.context ?? "এই screenshot analyze করো।",
      imageUrl: data.imageUrl,
      model: MODEL_VISION,
    });
    return { analysis: result };
  });

export const generateDailyStrategy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ pulseId: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const ctx: any = context;
    const { data: pulse } = await ctx.supabase
      .from("daily_pulse")
      .select("*")
      .eq("id", data.pulseId)
      .single();
    if (!pulse) throw new Error("Pulse not found");

    const system = `তুমি Sentix AI-র daily content strategist। নিচের Daily Pulse input থেকে আজকের content strategy লেখো (4-6 bullet points, বাংলায়)। কোন angle, কোন time slot, কোন pain point target করা উচিত — সংক্ষেপে বলো।`;
    const user = `Trending topic: ${pulse.telegram_trends ?? "—"}\nCompetitor viral: ${pulse.competitor_viral ?? "—"}\nMarket event: ${pulse.market_event ?? "—"}`;

    const strategy = await callAI({ system, user });
    await ctx.supabase
      .from("daily_pulse")
      .update({ ai_strategy: strategy })
      .eq("id", data.pulseId);
    return { strategy };
  });
