import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ENTITY = z.enum(["content_ideas", "scripts", "render_jobs"]);

export const softDelete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ entity: ENTITY, ids: z.array(z.string()).min(1).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx: any = context;
    const { error } = await ctx.supabase
      .from(data.entity)
      .update({ deleted_at: new Date().toISOString() })
      .in("id", data.ids);
    if (error) throw new Error(error.message);
    return { ok: true, count: data.ids.length };
  });

export const restore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ entity: ENTITY, ids: z.array(z.string()).min(1).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx: any = context;
    const { error } = await ctx.supabase
      .from(data.entity)
      .update({ deleted_at: null })
      .in("id", data.ids);
    if (error) throw new Error(error.message);
    return { ok: true, count: data.ids.length };
  });

export const hardDelete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ entity: ENTITY, ids: z.array(z.string()).min(1).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx: any = context;
    const { error } = await ctx.supabase.from(data.entity).delete().in("id", data.ids);
    if (error) throw new Error(error.message);
    return { ok: true, count: data.ids.length };
  });

export const setScriptStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    ids: z.array(z.string()).min(1).max(200),
    status: z.enum(["approved", "needs_review", "rejected", "generating"]),
    reason: z.string().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx: any = context;
    const patch: any = { status: data.status, updated_at: new Date().toISOString() };
    if (data.reason) patch.needs_review_reason = data.reason;
    const { error } = await ctx.supabase.from("scripts").update(patch).in("id", data.ids);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const cancelRender = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ jobId: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx: any = context;
    const { getUserSecret } = await import("./secrets.server");
    const { data: job } = await ctx.supabase.from("render_jobs").select("*").eq("id", data.jobId).maybeSingle();
    if (!job) throw new Error("Job not found");
    const pat = await getUserSecret(ctx.supabase, ctx.userId, "GITHUB_PAT");
    const owner = (await getUserSecret(ctx.supabase, ctx.userId, "GITHUB_REPO_OWNER")) || "dsiam7001";
    const repo = (await getUserSecret(ctx.supabase, ctx.userId, "GITHUB_REPO_NAME")) || "sentix-marketing";
    if (pat && job.github_run_id) {
      try {
        await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/runs/${job.github_run_id}/cancel`, {
          method: "POST",
          headers: { Authorization: `Bearer ${pat}`, Accept: "application/vnd.github+json" },
        });
      } catch { /* ignore */ }
    }
    await ctx.supabase.from("render_jobs").update({ status: "cancelled", finished_at: new Date().toISOString() }).eq("id", data.jobId);
    return { ok: true };
  });
