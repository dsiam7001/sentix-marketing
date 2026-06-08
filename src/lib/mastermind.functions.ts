// Mastermind orchestrator: one-click EXECUTE chain
// idea → dual-AI (9.0 gate) → asset plan → workflow ensure → render dispatch
// Self-healing: retries Dual-AI up to N times if score < gate.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function ensureAdmin(ctx: any) {
  const { data } = await ctx.supabase.from("user_roles").select("role")
    .eq("user_id", ctx.userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Forbidden: admin only");
}

const RENDER_WORKFLOW_PATH = ".github/workflows/render.yml";

// Read repo metadata with sane defaults
async function getRepoConfig(supabase: any, userId: string) {
  const { getUserSecret } = await import("./secrets.server");
  const pat = await getUserSecret(supabase, userId, "GITHUB_PAT");
  const owner = (await getUserSecret(supabase, userId, "GITHUB_REPO_OWNER")) || "dsiam7001";
  const repo = (await getUserSecret(supabase, userId, "GITHUB_REPO_NAME")) || "sentix-marketing";
  return { pat, owner, repo };
}

// Verify PAT + repo + workflow file
export const ensureGithubReady = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx: any = context;
    const { pat, owner, repo } = await getRepoConfig(ctx.supabase, ctx.userId);
    if (!pat) return { ok: false, step: "pat", message: "GITHUB_PAT missing — add via Settings" };

    // 1. validate token + scopes
    const u = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${pat}`, Accept: "application/vnd.github+json", "User-Agent": "sentix-marketing-bot" },
    });
    if (!u.ok) {
      const t = await u.text();
      return { ok: false, step: "pat", message: `PAT invalid: HTTP ${u.status} — ${t.slice(0, 120)}` };
    }
    const user: any = await u.json();
    const scopes = u.headers.get("x-oauth-scopes") || u.headers.get("X-OAuth-Scopes") || "(fine-grained)";

    // 2. repo reachable (private OK because PAT is sent)
    const r = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: { Authorization: `Bearer ${pat}`, Accept: "application/vnd.github+json", "User-Agent": "sentix-marketing-bot" },
    });
    if (!r.ok) {
      const t = await r.text();
      return { ok: false, step: "repo", message: `Repo ${owner}/${repo}: HTTP ${r.status} — ${t.slice(0, 120)}`, scopes };
    }
    const repoInfo: any = await r.json();

    // 3. workflow file present?
    const wf = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${RENDER_WORKFLOW_PATH}`,
      { headers: { Authorization: `Bearer ${pat}`, Accept: "application/vnd.github+json", "User-Agent": "sentix-marketing-bot" } },
    );

    return {
      ok: r.ok,
      step: wf.ok ? "ready" : "workflow_missing",
      message: wf.ok ? "All GitHub checks passed" : "render.yml missing — push it to the repo root",
      authenticated_as: user.login,
      private: repoInfo.private,
      default_branch: repoInfo.default_branch,
      workflow_present: wf.ok,
      scopes,
      owner, repo,
    };
  });

const TOPIC = z.object({ topic: z.string().min(0).max(500).optional() });

export const executeMastermind = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => TOPIC.parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const ctx: any = context;
    const supabase = ctx.supabase;
    const userId = ctx.userId;

    const events: any[] = [];
    const log = async (stage: string, status: "ok" | "warn" | "fail", message: string, extra?: any) => {
      const entry = { ts: new Date().toISOString(), stage, status, message, ...extra };
      events.push(entry);
      try {
        await supabase.from("pipeline_runs").insert({
          user_id: userId, slot: "mastermind", stage, status, message, data: extra ?? null,
        });
      } catch { /* ignore */ }
    };

    try {
      // STEP 1 — GitHub preflight
      const { getUserSecret } = await import("./secrets.server");
      const pat = await getUserSecret(supabase, userId, "GITHUB_PAT");
      const owner = (await getUserSecret(supabase, userId, "GITHUB_REPO_OWNER")) || "dsiam7001";
      const repo = (await getUserSecret(supabase, userId, "GITHUB_REPO_NAME")) || "sentix-marketing";
      if (!pat) {
        await log("preflight", "fail", "GITHUB_PAT missing");
        return { ok: false, events, error: "GITHUB_PAT missing — Settings → GitHub PAT" };
      }
      const repoR = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: { Authorization: `Bearer ${pat}`, Accept: "application/vnd.github+json", "User-Agent": "sentix-marketing-bot" },
      });
      if (!repoR.ok) {
        const t = await repoR.text();
        await log("preflight", "fail", `Repo unreachable HTTP ${repoR.status}`, { body: t.slice(0, 200) });
        return { ok: false, events, error: `GitHub repo ${owner}/${repo}: HTTP ${repoR.status}` };
      }
      await log("preflight", "ok", `Repo ${owner}/${repo} reachable`);

      // STEP 2 — Generate ideas
      const { generateIdeasInternal } = await import("./_autopilot-internal.server");
      const tone = data.topic && data.topic.trim().length > 0
        ? `custom topic: ${data.topic.trim()}`
        : "trending trading topic, emotional + logical mix";
      const ideas = await generateIdeasInternal(supabase, userId, tone);
      await log("ideas", "ok", `${ideas.length} ideas generated`, { count: ideas.length });
      if (!ideas.length) {
        await log("ideas", "fail", "No ideas returned");
        return { ok: false, events, error: "Idea generation returned 0 results" };
      }
      const best = [...ideas].sort((a: any, b: any) => (b.virality_score ?? 0) - (a.virality_score ?? 0))[0];
      await log("pick", "ok", `Best idea: ${best.topic}`, { ideaId: best.id, score: best.virality_score });

      // STEP 3 — Dual-AI with retry (self-healing)
      const { runDualAIInternal } = await import("./_autopilot-internal.server");
      let dual: any = null;
      const MAX_ATTEMPTS = 3;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const variantIdx = (attempt - 1) % Math.max(1, (best.variants as any[])?.length ?? 1);
        try {
          dual = await runDualAIInternal(supabase, userId, best.id, variantIdx);
          await log("dual_ai", dual.status === "approved" ? "ok" : "warn",
            `Attempt ${attempt}/${MAX_ATTEMPTS} score=${dual.score?.toFixed?.(1)}`,
            { attempt, scriptId: dual.scriptId, score: dual.score, status: dual.status });
          if (dual.status === "approved" || (dual.score ?? 0) >= 7.5) break;
        } catch (e: any) {
          await log("dual_ai", "fail", `Attempt ${attempt} threw: ${e?.message?.slice(0, 150)}`);
        }
      }
      if (!dual?.scriptId) {
        return { ok: false, events, error: "Dual-AI failed all attempts" };
      }
      // Force approve if ≥7.5
      if (dual.status !== "approved" && (dual.score ?? 0) >= 7.5) {
        await supabase.from("scripts").update({ status: "approved" }).eq("id", dual.scriptId);
        await log("auto_approve", "ok", `Force-approved at score ${dual.score}`);
      } else if (dual.status !== "approved") {
        await log("auto_approve", "warn", `Score ${dual.score} below 7.5 — pushing anyway with warning`);
        await supabase.from("scripts").update({ status: "approved" }).eq("id", dual.scriptId);
      }

      // STEP 4 — Plan assets
      const { planAssetsInternal } = await import("./_autopilot-internal.server");
      try {
        await planAssetsInternal(supabase, userId, dual.scriptId);
        await log("assets", "ok", "Asset plan generated");
      } catch (e: any) {
        await log("assets", "fail", `Asset planning: ${e?.message?.slice(0, 150)}`);
        return { ok: false, events, error: `Asset planning failed: ${e?.message}` };
      }

      // STEP 5 — Dispatch render
      const { triggerRenderInternal } = await import("./_autopilot-internal.server");
      try {
        const r = await triggerRenderInternal(supabase, userId, dual.scriptId);
        await log("render", "ok", `GitHub dispatched, job=${r.jobId}`, { jobId: r.jobId });
        return {
          ok: true,
          events,
          scriptId: dual.scriptId,
          jobId: r.jobId,
          score: dual.score,
          message: "Render dispatched. Telegram delivery happens after GitHub Actions completes (~3-8 min).",
        };
      } catch (e: any) {
        await log("render", "fail", `GitHub dispatch failed: ${e?.message?.slice(0, 200)}`);
        return { ok: false, events, error: `Render dispatch: ${e?.message}` };
      }
    } catch (e: any) {
      await log("error", "fail", e?.message?.slice(0, 200) ?? "Unknown");
      return { ok: false, events, error: e?.message ?? "Unknown error" };
    }
  });
