import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function ensureAdmin(ctx: any) {
  const { data } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden: admin only");
}

const SLOT_SCHEMA = z.array(z.object({
  slot: z.string(),
  hour: z.number().min(0).max(23),
  tone: z.string(),
}));

const SETTINGS_SCHEMA = z.object({
  enabled: z.boolean().optional(),
  auto_approve: z.boolean().optional(),
  auto_render: z.boolean().optional(),
  auto_publish_telegram: z.boolean().optional(),
  daily_quota: z.number().min(0).max(50).optional(),
  timezone: z.string().optional(),
  slot_config: SLOT_SCHEMA.optional(),
  paused_until: z.string().nullable().optional(),
});

export const getAutopilotSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx: any = context;
    const { data } = await ctx.supabase
      .from("autopilot_settings")
      .select("*")
      .eq("user_id", ctx.userId)
      .maybeSingle();
    if (data) return { settings: data };
    // create default row lazily
    const { data: created } = await ctx.supabase
      .from("autopilot_settings")
      .insert({ user_id: ctx.userId })
      .select()
      .single();
    return { settings: created };
  });

export const updateAutopilotSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => SETTINGS_SCHEMA.parse(d))
  .handler(async ({ data, context }) => {
    const ctx: any = context;
    await ctx.supabase
      .from("autopilot_settings")
      .upsert({ user_id: ctx.userId, ...data }, { onConflict: "user_id" });
    return { ok: true };
  });

function currentSlot(slotConfig: any[], tzOffsetMinutes: number) {
  const now = new Date();
  // Asia/Dhaka is UTC+6 — but use provided offset
  const local = new Date(now.getTime() + tzOffsetMinutes * 60 * 1000);
  const hour = local.getUTCHours();
  // pick the slot whose hour is closest to but not greater than current hour
  const sorted = [...slotConfig].sort((a, b) => a.hour - b.hour);
  let chosen = sorted[0];
  for (const s of sorted) if (s.hour <= hour) chosen = s;
  return chosen;
}

export const runAutopilotForUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    return autopilotForUser((context as any).supabase, (context as any).userId);
  });

// Core engine — also called from /api/public/autopilot-tick with admin client
export async function autopilotForUser(supabase: any, userId: string) {
  const log = async (stage: string, status: string, message?: string, data?: any, refId?: string, slot?: string) => {
    await supabase.from("pipeline_runs").insert({
      user_id: userId, slot, stage, status, message, data, ref_id: refId,
    });
  };

  const { data: settings } = await supabase.from("autopilot_settings").select("*").eq("user_id", userId).maybeSingle();
  if (!settings || !settings.enabled) {
    return { skipped: true, reason: "autopilot disabled" };
  }
  if (settings.paused_until && new Date(settings.paused_until) > new Date()) {
    return { skipped: true, reason: "paused" };
  }

  // Quota check — count scripts approved today
  const today = new Date().toISOString().slice(0, 10);
  const { data: todaysScripts } = await supabase
    .from("scripts")
    .select("id, created_at, status")
    .gte("created_at", today + "T00:00:00Z")
    .is("deleted_at", null);
  const approvedToday = (todaysScripts ?? []).filter((s: any) => s.status === "approved").length;
  if (approvedToday >= settings.daily_quota) {
    await log("quota", "skipped", `Quota ${settings.daily_quota} reached`);
    return { skipped: true, reason: "daily quota reached" };
  }

  // Advisory lock per slot+user (prevents double fire)
  const tz = settings.timezone === "Asia/Dhaka" ? 360 : 0;
  const slot = currentSlot(settings.slot_config, tz);
  const slotKey = `${userId}:${today}:${slot.slot}`;
  const { data: lockRow } = await supabase.rpc("pg_try_advisory_xact_lock", { key: 0 }).select().maybeSingle().then(() => ({ data: null })).catch(() => ({ data: null }));
  // (Advisory lock RPC is non-trivial via PostgREST; we use a pipeline_runs idempotency check instead)
  const { data: existing } = await supabase
    .from("pipeline_runs")
    .select("id")
    .eq("user_id", userId)
    .eq("slot", slot.slot)
    .eq("stage", "tick")
    .gte("created_at", today + "T00:00:00Z")
    .limit(1);
  if (existing && existing.length > 0) {
    return { skipped: true, reason: `slot ${slot.slot} already processed today` };
  }
  await log("tick", "started", `Slot ${slot.slot} (${slot.tone})`, null, undefined, slot.slot);

  try {
    // Generate ideas (use ai gateway directly, mimicking generateIdeas core)
    const { generateIdeasInternal } = await import("./_autopilot-internal.server");
    const ideas = await generateIdeasInternal(supabase, userId, slot.tone);
    await log("ideas", "ok", `${ideas.length} ideas`, { count: ideas.length }, undefined, slot.slot);

    // Pick highest virality_score idea
    const best = [...ideas].sort((a: any, b: any) => (b.virality_score ?? 0) - (a.virality_score ?? 0))[0];
    if (!best) throw new Error("No ideas generated");

    // Run dual-AI on variant 0
    const { runDualAIInternal } = await import("./_autopilot-internal.server");
    const dual = await runDualAIInternal(supabase, userId, best.id, 0);
    await log("dual_ai", dual.status === "approved" ? "ok" : "warn", `Score ${dual.score?.toFixed?.(1) ?? dual.score}`, dual, dual.scriptId, slot.slot);

    if (dual.status !== "approved" && !settings.auto_approve) {
      return { ok: true, status: "queued_for_review", scriptId: dual.scriptId };
    }

    // Force-mark approved if auto_approve is on
    if (dual.status !== "approved" && settings.auto_approve && (dual.score ?? 0) >= 7.5) {
      await supabase.from("scripts").update({ status: "approved" }).eq("id", dual.scriptId);
      await log("auto_approve", "ok", `Forced approve (score ${dual.score})`, null, dual.scriptId, slot.slot);
    } else if (dual.status !== "approved") {
      return { ok: true, status: "rejected", scriptId: dual.scriptId };
    }

    // Plan assets
    const { planAssetsInternal } = await import("./_autopilot-internal.server");
    await planAssetsInternal(supabase, userId, dual.scriptId);
    await log("assets", "ok", "Asset plan generated", null, dual.scriptId, slot.slot);

    if (!settings.auto_render) {
      return { ok: true, status: "ready_to_render", scriptId: dual.scriptId };
    }

    // Trigger render
    const { triggerRenderInternal } = await import("./_autopilot-internal.server");
    const r = await triggerRenderInternal(supabase, userId, dual.scriptId);
    await log("render", "ok", `GitHub dispatch ${r.jobId}`, r, dual.scriptId, slot.slot);

    return { ok: true, status: "rendering", scriptId: dual.scriptId, jobId: r.jobId };
  } catch (e: any) {
    await log("error", "failed", e?.message?.slice(0, 200) ?? "Unknown", null, undefined, slot.slot);
    return { ok: false, error: e?.message };
  }
}

export const recentPipelineRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx: any = context;
    const { data } = await ctx.supabase
      .from("pipeline_runs")
      .select("*")
      .eq("user_id", ctx.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    return { runs: data ?? [] };
  });
