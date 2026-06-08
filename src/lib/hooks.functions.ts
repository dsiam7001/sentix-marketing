import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const SCHEMA = {
  type: "object",
  properties: {
    hooks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          hook_text: { type: "string" },
          category: { type: "string" },
          emotion: { type: "string" },
        },
        required: ["hook_text", "category", "emotion"],
      },
    },
  },
  required: ["hooks"],
};

export const generateAIHooks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        topic: z.string().min(2).max(200),
        emotion: z.string().min(2).max(50).default("curiosity"),
        count: z.number().int().min(1).max(10).default(5),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const ctx: any = context;
    const { callLLMWithRotation } = await import("./gemini-pool.server");
    const wrap = await callLLMWithRotation(ctx.supabase, ctx.userId, {
      system:
        "তুমি Sentix Hook Master। বাংলাদেশী trader audience-এর জন্য 60-90 sec short-form video-এর জন্য scroll-stopping Bengali hook লেখো। প্রতিটা hook 1-2 line, max 15 words।",
      user: `Topic: ${data.topic}\nEmotion: ${data.emotion}\nGenerate ${data.count}টা unique hook।`,
      tools: [{ type: "function", function: { name: "submit_hooks", parameters: SCHEMA } }],
      toolChoice: { type: "function", function: { name: "submit_hooks" } },
    });
    const rows = (wrap.result.hooks ?? []).slice(0, data.count).map((h: any) => ({
      user_id: ctx.userId,
      hook_text: h.hook_text,
      category: h.category,
      emotion: h.emotion,
      is_seed: false,
      ai_generated: true,
      source_topic: data.topic,
    }));
    if (rows.length === 0) return { inserted: 0 };
    const { data: inserted, error } = await ctx.supabase.from("hooks_library").insert(rows).select();
    if (error) throw new Error(error.message);
    return { inserted: inserted?.length ?? 0 };
  });
