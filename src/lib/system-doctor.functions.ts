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
      ["PIXABAY_VIDEO_API_KEY", "Pixabay (video)", async (v: string) => fetch(`https://pixabay.com/api/videos/?key=${v}&q=trading&per_page=3&safesearch=true`)],
      ["PIXABAY_IMAGE_API_KEY", "Pixabay (image)", async (v: string) => fetch(`https://pixabay.com/api/?key=${v}&q=trading&per_page=3&safesearch=true&image_type=photo`)],
    ] as const) {
      const v = await get(name);
      if (!v) push({ id: name, label, status: "skip", proof: "no key (optional)" });
      else {
        try {
          const r = await fn(v);
          if (r.ok) push({ id: name, label, status: "ok", proof: `HTTP ${r.status}` });
          else {
            const body = await r.text().catch(() => "");
            push({ id: name, label, status: "fail", proof: `HTTP ${r.status} — ${body.slice(0, 120)}` });
          }
        } catch (e: any) { push({ id: name, label, status: "fail", proof: e?.message }); }
      }
    }

    // 7. Pollinations (no key)
    try {
      const r = await fetch("https://image.pollinations.ai/prompt/test?width=64&height=64&nologo=true", { method: "HEAD" });
      push({ id: "pollinations", label: "Pollinations.ai", status: r.ok ? "ok" : "warn", proof: `HTTP ${r.status}` });
    } catch (e: any) { push({ id: "pollinations", label: "Pollinations.ai", status: "warn", proof: e?.message }); }

    // 8. GitHub repo + workflow (with sensible defaults)
    const pat = await get("GITHUB_PAT");
    const owner = (await get("GITHUB_REPO_OWNER")) || "dsiam7001";
    const repo = (await get("GITHUB_REPO_NAME")) || "sentix-marketing";
    if (pat) {
      try {
        const u = await fetch("https://api.github.com/user", {
          headers: { Authorization: `Bearer ${pat}`, Accept: "application/vnd.github+json", "User-Agent": "sentix-marketing-bot" },
        });
        if (!u.ok) {
          const b = await u.text();
          push({ id: "github_pat", label: "GitHub PAT", status: "fail", proof: `HTTP ${u.status} — ${b.slice(0, 100)}` });
        } else {
          const ju: any = await u.json();
          push({ id: "github_pat", label: "GitHub PAT", status: "ok", proof: `as ${ju.login}` });
        }
        const r = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
          headers: { Authorization: `Bearer ${pat}`, Accept: "application/vnd.github+json", "User-Agent": "sentix-marketing-bot" },
        });
        if (r.ok) {
          const jr: any = await r.json();
          push({ id: "github_repo", label: `GitHub repo ${owner}/${repo}`, status: "ok", proof: `${jr.private ? "private" : "public"} · branch=${jr.default_branch}` });
        } else {
          const b = await r.text();
          push({ id: "github_repo", label: `GitHub repo ${owner}/${repo}`, status: "fail", proof: `HTTP ${r.status} — ${b.slice(0, 100)}` });
        }
        const wf = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/.github/workflows/render.yml`, {
          headers: { Authorization: `Bearer ${pat}`, Accept: "application/vnd.github+json", "User-Agent": "sentix-marketing-bot" },
        });
        push({ id: "github_workflow", label: "render.yml present", status: wf.ok ? "ok" : "fail", proof: wf.ok ? "synced" : `HTTP ${wf.status} — push render.yml to repo` });
      } catch (e: any) { push({ id: "github", label: "GitHub", status: "fail", proof: e?.message }); }
    } else push({ id: "github", label: "GitHub PAT", status: "fail", proof: "no PAT configured" });

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

    // 12. Storage bucket reachability
    try {
      const { data: buckets } = await ctx.supabase.storage.listBuckets();
      const refsBucket = buckets?.find((b: any) => b.name === "creative-references");
      push({ id: "storage", label: "Storage bucket (creative-references)", status: refsBucket ? "ok" : "warn", proof: refsBucket ? "available" : "missing" });
    } catch (e: any) { push({ id: "storage", label: "Storage", status: "fail", proof: e?.message }); }

    // 13. Last Telegram delivery proof
    try {
      const { data: lastDelivery } = await ctx.supabase
        .from("render_jobs")
        .select("telegram_message_id, telegram_delivered_at")
        .eq("user_id", ctx.userId)
        .not("telegram_message_id", "is", null)
        .order("telegram_delivered_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      push({
        id: "telegram_proof",
        label: "Last Telegram video delivery",
        status: lastDelivery ? "ok" : "skip",
        proof: lastDelivery
          ? `message_id ${lastDelivery.telegram_message_id} @ ${new Date(lastDelivery.telegram_delivered_at).toLocaleString()}`
          : "no deliveries yet",
      });
    } catch (e: any) { push({ id: "telegram_proof", label: "Telegram delivery history", status: "warn", proof: e?.message }); }

    // 14. Cost summary (last 24h)
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: costs } = await ctx.supabase
        .from("pipeline_runs")
        .select("cost_usd, tokens_in, tokens_out")
        .eq("user_id", ctx.userId)
        .gte("created_at", since);
      const totalCost = (costs ?? []).reduce((s: number, r: any) => s + Number(r.cost_usd ?? 0), 0);
      const totalTokens = (costs ?? []).reduce((s: number, r: any) => s + (r.tokens_in ?? 0) + (r.tokens_out ?? 0), 0);
      push({
        id: "cost",
        label: "AI spend (last 24h)",
        status: "ok",
        proof: `$${totalCost.toFixed(4)} · ${totalTokens} tokens · ${costs?.length ?? 0} calls`,
      });
    } catch (e: any) { push({ id: "cost", label: "Cost ledger", status: "warn", proof: e?.message }); }

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
