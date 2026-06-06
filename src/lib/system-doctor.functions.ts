import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

type Step = { id: string; label: string; status: "ok" | "warn" | "fail" | "skip"; proof?: any; ms?: number };

async function timed<T>(fn: () => Promise<T>): Promise<{ value: T; ms: number }> {
  const t0 = Date.now();
  const value = await fn();
  return { value, ms: Date.now() - t0 };
}

export const runSystemDoctor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ mode: z.enum(["short", "full"]).default("short") }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx: any = context;
    const { getUserSecret } = await import("./secrets.server");
    const get = (n: string) => getUserSecret(ctx.supabase, ctx.userId, n);

    const { data: run } = await ctx.supabase.from("diagnostic_runs").insert({
      user_id: ctx.userId, mode: data.mode, status: "running",
    }).select().single();

    const steps: Step[] = [];
    const push = (s: Step) => { steps.push(s); };

    // 1. Supabase reachability + table counts
    try {
      const t = await timed(async () => {
        const tables = ["content_ideas", "scripts", "render_jobs", "dual_ai_runs", "asset_cache", "autopilot_settings", "guard_reports", "pipeline_runs", "user_secrets"];
        const counts: any = {};
        for (const tbl of tables) {
          const { count } = await ctx.supabase.from(tbl).select("*", { count: "exact", head: true });
          counts[tbl] = count ?? 0;
        }
        return counts;
      });
      push({ id: "supabase", label: "Database reachable + table counts", status: "ok", proof: t.value, ms: t.ms });
    } catch (e: any) {
      push({ id: "supabase", label: "Database reachable", status: "fail", proof: e?.message });
    }

    // 2. Gemini key pool
    try {
      const { data: keys } = await ctx.supabase.from("gemini_keys").select("id, label, active, cooldown_until").eq("user_id", ctx.userId);
      const usable = (keys ?? []).filter((k: any) => k.active && (!k.cooldown_until || new Date(k.cooldown_until) < new Date())).length;
      push({ id: "gemini", label: "Gemini key pool", status: usable > 0 ? "ok" : "warn", proof: { total: keys?.length ?? 0, usable } });
    } catch (e: any) { push({ id: "gemini", label: "Gemini key pool", status: "fail", proof: e?.message }); }

    // 3. Lovable Gateway
    try {
      const k = process.env.LOVABLE_API_KEY;
      if (!k) push({ id: "gateway", label: "Lovable AI Gateway", status: "fail", proof: "LOVABLE_API_KEY missing" });
      else {
        const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${k}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages: [{ role: "user", content: "say ok" }] }),
        });
        push({ id: "gateway", label: "Lovable AI Gateway", status: r.ok ? "ok" : "fail", proof: `HTTP ${r.status}` });
      }
    } catch (e: any) { push({ id: "gateway", label: "Lovable AI Gateway", status: "fail", proof: e?.message }); }

    // 4-6. Asset APIs
    for (const [name, label, fn] of [
      ["PEXELS_API_KEY", "Pexels", async (v: string) => fetch("https://api.pexels.com/videos/search?query=trading&per_page=1", { headers: { Authorization: v } })],
      ["PIXABAY_API_KEY", "Pixabay", async (v: string) => fetch(`https://pixabay.com/api/videos/?key=${v}&q=trading&per_page=1`)],
    ] as const) {
      const v = await get(name);
      if (!v) push({ id: name, label, status: "skip", proof: "no key" });
      else {
        try { const r = await fn(v); push({ id: name, label, status: r.ok ? "ok" : "fail", proof: `HTTP ${r.status}` }); }
        catch (e: any) { push({ id: name, label, status: "fail", proof: e?.message }); }
      }
    }

    // 7. Pollinations (no key)
    try {
      const r = await fetch("https://image.pollinations.ai/prompt/test?width=64&height=64&nologo=true", { method: "HEAD" });
      push({ id: "pollinations", label: "Pollinations.ai", status: r.ok ? "ok" : "warn", proof: `HTTP ${r.status}` });
    } catch (e: any) { push({ id: "pollinations", label: "Pollinations.ai", status: "warn", proof: e?.message }); }

    // 8. GitHub repo reachable
    const pat = await get("GITHUB_PAT");
    const owner = await get("GITHUB_REPO_OWNER");
    const repo = await get("GITHUB_REPO_NAME");
    if (pat && owner && repo) {
      try {
        const r = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
          headers: { Authorization: `token ${pat}`, Accept: "application/vnd.github+json" },
        });
        push({ id: "github", label: "GitHub repo + PAT", status: r.ok ? "ok" : "fail", proof: `HTTP ${r.status}` });
        // Check workflow file
        const wf = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/.github/workflows/render.yml`, {
          headers: { Authorization: `token ${pat}`, Accept: "application/vnd.github+json" },
        });
        push({ id: "github_workflow", label: "render.yml workflow present", status: wf.ok ? "ok" : "fail", proof: `HTTP ${wf.status}` });
      } catch (e: any) { push({ id: "github", label: "GitHub repo + PAT", status: "fail", proof: e?.message }); }
    } else push({ id: "github", label: "GitHub repo + PAT", status: "skip", proof: "not configured" });

    // 9. Telegram (sends a test message — real proof)
    const tgTok = await get("TELEGRAM_BOT_TOKEN");
    const tgChat = await get("TELEGRAM_CHAT_ID");
    if (tgTok && tgChat) {
      try {
        const r = await fetch(`https://api.telegram.org/bot${tgTok}/sendMessage`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: tgChat, text: "🩺 Sentix System Doctor — diagnostic ping ✅" }),
        });
        const j: any = await r.json();
        push({ id: "telegram", label: "Telegram delivery", status: j.ok ? "ok" : "fail", proof: j.ok ? `message_id ${j.result?.message_id}` : j.description });
      } catch (e: any) { push({ id: "telegram", label: "Telegram delivery", status: "fail", proof: e?.message }); }
    } else push({ id: "telegram", label: "Telegram delivery", status: "skip", proof: "not configured" });

    // 10. Optional guardrail APIs
    for (const [name, label] of [
      ["AUDD_API_KEY", "AudD (music)"],
      ["ASSEMBLYAI_API_KEY", "AssemblyAI (transcript)"],
      ["SIGHTENGINE_USER", "Sightengine (AI-gen detect)"],
    ] as const) {
      const v = await get(name);
      push({ id: name, label, status: v ? "ok" : "skip", proof: v ? "configured" : "no key" });
    }

    // 11. Render callback HMAC round-trip
    const secret = await get("RENDER_CALLBACK_SECRET");
    push({ id: "callback", label: "Render callback secret", status: secret ? "ok" : "fail", proof: secret ? "stored" : "missing" });

    const okCount = steps.filter((s) => s.status === "ok").length;
    const failCount = steps.filter((s) => s.status === "fail").length;
    const summary = { ok: okCount, fail: failCount, warn: steps.filter((s) => s.status === "warn").length, skip: steps.filter((s) => s.status === "skip").length, total: steps.length };

    await ctx.supabase.from("diagnostic_runs").update({
      status: failCount > 0 ? "failed" : "completed",
      steps, summary, completed_at: new Date().toISOString(),
    }).eq("id", run.id);

    return { runId: run.id, steps, summary };
  });

export const recentDiagnostics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx: any = context;
    const { data } = await ctx.supabase.from("diagnostic_runs").select("*").eq("user_id", ctx.userId).order("started_at", { ascending: false }).limit(10);
    return { runs: data ?? [] };
  });
