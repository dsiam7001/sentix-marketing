import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { createHmac } from "crypto";

async function ensureAdmin(ctx: any) {
  const { data } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden: admin only");
}

function callbackUrl() {
  const projectId = process.env.SUPABASE_PROJECT_ID ?? "";
  // Stable dev URL pattern (works for both preview + published)
  return `https://project--490123ce-11f1-405e-91bd-0d2ba0200065-dev.lovable.app/api/public/render-callback`;
}

export const triggerRender = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ scriptId: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const ctx: any = context;

    const pat = process.env.GITHUB_PAT;
    const owner = process.env.GITHUB_REPO_OWNER;
    const repo = process.env.GITHUB_REPO_NAME;
    const secret = process.env.RENDER_CALLBACK_SECRET;
    if (!pat || !owner || !repo || !secret) {
      throw new Error(
        "GitHub render not configured. Settings → add GITHUB_PAT, GITHUB_REPO_OWNER, GITHUB_REPO_NAME, RENDER_CALLBACK_SECRET",
      );
    }

    const { data: script } = await ctx.supabase
      .from("scripts")
      .select("*")
      .eq("id", data.scriptId)
      .maybeSingle();
    if (!script) throw new Error("Script not found");
    if (!script.asset_plan || (script.asset_plan as any[]).length === 0) {
      throw new Error("Run 'Plan assets' first");
    }

    // Create render_jobs row
    const { data: job, error: jErr } = await ctx.supabase
      .from("render_jobs")
      .insert({
        user_id: ctx.userId,
        script_id: script.id,
        status: "queued",
        payload: {
          title: script.title,
          full_script: script.full_script,
          scenes: script.scenes,
          asset_plan: script.asset_plan,
          srt: script.srt,
          music_mood: script.music_mood,
        },
      })
      .select()
      .single();
    if (jErr) throw new Error(jErr.message);

    const sig = createHmac("sha256", secret)
      .update(`${job.id}:${script.id}`)
      .digest("hex");

    const dispatchBody = {
      event_type: "sentix-render",
      client_payload: {
        job_id: job.id,
        script_id: script.id,
        callback_url: callbackUrl(),
        signature: sig,
        title: script.title,
        full_script: script.full_script,
        scenes: script.scenes,
        asset_plan: script.asset_plan,
        srt: script.srt,
        music_mood: script.music_mood,
      },
    };

    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `token ${pat}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(dispatchBody),
      },
    );

    if (!res.ok) {
      const txt = await res.text();
      await ctx.supabase
        .from("render_jobs")
        .update({ status: "failed", error: `GitHub dispatch ${res.status}: ${txt.slice(0, 200)}` })
        .eq("id", job.id);
      throw new Error(`GitHub dispatch failed: ${res.status} ${txt.slice(0, 200)}`);
    }

    await ctx.supabase
      .from("scripts")
      .update({ render_status: "dispatched" })
      .eq("id", script.id);

    return { jobId: job.id, status: "dispatched" };
  });

export const getRecentRenders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx: any = context;
    const { data } = await ctx.supabase
      .from("render_jobs")
      .select("*, scripts(title)")
      .order("created_at", { ascending: false })
      .limit(15);
    return { jobs: data ?? [] };
  });
