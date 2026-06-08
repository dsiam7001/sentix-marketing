import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    hook_style: { type: "string" },
    pacing: { type: "string" },
    color_mood: { type: "string" },
    visual_style: { type: "string" },
    suggested_angles: { type: "array", items: { type: "string" } },
    bengali_summary: { type: "string" },
  },
  required: ["hook_style", "pacing", "color_mood", "visual_style", "suggested_angles", "bengali_summary"],
};

export const listReferences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx: any = context;
    const { data } = await ctx.supabase
      .from("creative_references")
      .select("*")
      .eq("user_id", ctx.userId)
      .order("created_at", { ascending: false });
    return { items: data ?? [] };
  });

export const saveReference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        storage_path: z.string().min(1).max(500),
        media_type: z.enum(["image", "video"]),
        label: z.string().max(200).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const ctx: any = context;
    const { data: row, error } = await ctx.supabase
      .from("creative_references")
      .insert({
        user_id: ctx.userId,
        storage_path: data.storage_path,
        media_type: data.media_type,
        label: data.label ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteReference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx: any = context;
    const { data: row } = await ctx.supabase
      .from("creative_references")
      .select("storage_path")
      .eq("id", data.id)
      .eq("user_id", ctx.userId)
      .maybeSingle();
    if (row?.storage_path) {
      await ctx.supabase.storage.from("creative-references").remove([row.storage_path]);
    }
    await ctx.supabase.from("creative_references").delete().eq("id", data.id).eq("user_id", ctx.userId);
    return { ok: true };
  });

export const analyzeReference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx: any = context;
    const { data: ref } = await ctx.supabase
      .from("creative_references")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", ctx.userId)
      .maybeSingle();
    if (!ref) throw new Error("Reference not found");

    // signed URL so the model can fetch
    const { data: signed } = await ctx.supabase.storage
      .from("creative-references")
      .createSignedUrl(ref.storage_path, 600);
    if (!signed?.signedUrl) throw new Error("Could not sign URL");

    // Fetch & convert to base64 (image only — vision works on images)
    let imageData: string | null = null;
    if (ref.media_type === "image") {
      const r = await fetch(signed.signedUrl);
      if (!r.ok) throw new Error("Could not fetch reference");
      const buf = await r.arrayBuffer();
      const b64 = Buffer.from(buf).toString("base64");
      const ct = r.headers.get("content-type") ?? "image/jpeg";
      imageData = `data:${ct};base64,${b64}`;
    }

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY missing");

    const messages: any[] = [
      {
        role: "system",
        content:
          "তুমি Bengali viral content vision analyst। reference image বিশ্লেষণ করে hook style, pacing, color mood, visual style এবং Bengali trader audience-এর জন্য 5টা content angle suggest করো।",
      },
      {
        role: "user",
        content: imageData
          ? [
              { type: "text", text: `Label: ${ref.label ?? "(none)"}\nAnalyze and submit_analysis.` },
              { type: "image_url", image_url: { url: imageData } },
            ]
          : `Video reference (URL): ${signed.signedUrl}\nLabel: ${ref.label ?? "(none)"}\nBased on the label and context, submit_analysis with reasonable creative direction.`,
      },
    ];

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages,
        tools: [
          { type: "function", function: { name: "submit_analysis", parameters: ANALYSIS_SCHEMA } },
        ],
        tool_choice: { type: "function", function: { name: "submit_analysis" } },
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      throw new Error(`Gateway ${r.status}: ${t.slice(0, 200)}`);
    }
    const j: any = await r.json();
    const call = j.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) throw new Error("No analysis returned");
    const analysis = JSON.parse(call.function.arguments);

    await ctx.supabase
      .from("creative_references")
      .update({ analysis, analyzed_at: new Date().toISOString() })
      .eq("id", data.id);

    // Also save to style_memory for reuse in script generation
    await ctx.supabase.from("style_memory").insert({
      user_id: ctx.userId,
      sample_text: analysis.bengali_summary,
      label: `reference: ${ref.label ?? ref.id.slice(0, 8)}`,
    });

    return { analysis };
  });
