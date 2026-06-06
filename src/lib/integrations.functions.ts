import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Known integration slots. The UI renders this list.
export const INTEGRATION_SLOTS = [
  { name: "LOVABLE_API_KEY", label: "Lovable AI Gateway", required: true, managed: true, desc: "Built-in — auto-provisioned." },
  { name: "PEXELS_API_KEY", label: "Pexels (stock video)", required: true, desc: "https://www.pexels.com/api/" },
  { name: "PIXABAY_API_KEY", label: "Pixabay (stock video/image)", required: false, desc: "https://pixabay.com/api/docs/" },
  { name: "UNSPLASH_ACCESS_KEY", label: "Unsplash (extra visuals)", required: false, desc: "https://unsplash.com/developers" },
  { name: "GITHUB_PAT", label: "GitHub PAT (render trigger)", required: true, desc: "Personal access token with repo+workflow scope" },
  { name: "GITHUB_REPO_OWNER", label: "GitHub Repo Owner", required: true, desc: "your-github-username" },
  { name: "GITHUB_REPO_NAME", label: "GitHub Repo Name", required: true, desc: "the repo Lovable pushes to" },
  { name: "RENDER_CALLBACK_SECRET", label: "Render Callback Secret (HMAC)", required: true, desc: "Random 32+ char string" },
  { name: "PUBLIC_BASE_URL", label: "Public Base URL (for callbacks)", required: false, desc: "e.g. https://your-app.lovable.app — auto-detected if blank" },
  { name: "TELEGRAM_BOT_TOKEN", label: "Telegram Bot Token", required: false, desc: "From @BotFather" },
  { name: "TELEGRAM_CHAT_ID", label: "Telegram Chat ID", required: false, desc: "Your numeric chat ID" },
  { name: "AUDD_API_KEY", label: "AudD (music copyright check)", required: false, desc: "https://audd.io — 14-day free trial" },
  { name: "ASSEMBLYAI_API_KEY", label: "AssemblyAI (transcript verify)", required: false, desc: "5 hr/mo free — https://www.assemblyai.com" },
  { name: "SIGHTENGINE_USER", label: "Sightengine User", required: false, desc: "AI-content detection — https://sightengine.com" },
  { name: "SIGHTENGINE_SECRET", label: "Sightengine Secret", required: false, desc: "Pair with Sightengine User" },
  { name: "HIVE_API_KEY", label: "Hive AI (alt AI-content detection)", required: false, desc: "https://thehive.ai" },
  { name: "DEEPL_API_KEY", label: "DeepL Free (grammar polish)", required: false, desc: "https://www.deepl.com/pro-api" },
  { name: "OPENROUTER_API_KEY", label: "OpenRouter (backup LLM)", required: false, desc: "https://openrouter.ai" },
  { name: "AUTOPILOT_TICK_SECRET", label: "Autopilot Tick Secret", required: false, desc: "Used by pg_cron to call /api/public/autopilot-tick" },
];

export const listIntegrations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx: any = context;
    const { data: rows } = await ctx.supabase
      .from("user_secrets")
      .select("name, last_tested_at, last_test_ok, last_test_message, updated_at");
    const map = new Map<string, any>();
    for (const r of rows ?? []) map.set(r.name, r);
    return {
      slots: INTEGRATION_SLOTS.map((s) => {
        const user = map.get(s.name);
        const envConfigured = !!process.env[s.name];
        return {
          ...s,
          user_configured: !!user,
          env_configured: envConfigured,
          configured: !!user || envConfigured,
          last_tested_at: user?.last_tested_at ?? null,
          last_test_ok: user?.last_test_ok ?? null,
          last_test_message: user?.last_test_message ?? null,
          updated_at: user?.updated_at ?? null,
        };
      }),
    };
  });

export const saveSecret = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ name: z.string().min(2).max(80), value: z.string().min(1).max(4000) }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx: any = context;
    const allowed = INTEGRATION_SLOTS.find((s) => s.name === data.name);
    if (!allowed || allowed.managed) throw new Error("Not an editable slot");
    await ctx.supabase
      .from("user_secrets")
      .upsert(
        { user_id: ctx.userId, name: data.name, value: data.value, last_test_ok: null, last_tested_at: null, last_test_message: null },
        { onConflict: "user_id,name" },
      );
    return { ok: true };
  });

export const deleteSecret = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ name: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx: any = context;
    await ctx.supabase.from("user_secrets").delete().eq("user_id", ctx.userId).eq("name", data.name);
    return { ok: true };
  });

async function testService(name: string, getVal: (n: string) => Promise<string | null>): Promise<{ ok: boolean; message: string }> {
  const v = await getVal(name);
  try {
    switch (name) {
      case "PEXELS_API_KEY": {
        if (!v) return { ok: false, message: "No key" };
        const r = await fetch("https://api.pexels.com/videos/search?query=trading&per_page=1", { headers: { Authorization: v } });
        return { ok: r.ok, message: r.ok ? "OK" : `HTTP ${r.status}` };
      }
      case "PIXABAY_API_KEY": {
        if (!v) return { ok: false, message: "No key" };
        const r = await fetch(`https://pixabay.com/api/videos/?key=${v}&q=test&per_page=1`);
        return { ok: r.ok, message: r.ok ? "OK" : `HTTP ${r.status}` };
      }
      case "UNSPLASH_ACCESS_KEY": {
        if (!v) return { ok: false, message: "No key" };
        const r = await fetch("https://api.unsplash.com/photos/random", { headers: { Authorization: `Client-ID ${v}` } });
        return { ok: r.ok, message: r.ok ? "OK" : `HTTP ${r.status}` };
      }
      case "GITHUB_PAT": {
        if (!v) return { ok: false, message: "No token" };
        const r = await fetch("https://api.github.com/user", { headers: { Authorization: `token ${v}`, Accept: "application/vnd.github+json" } });
        if (!r.ok) return { ok: false, message: `HTTP ${r.status}` };
        const j: any = await r.json();
        return { ok: true, message: `Authenticated as ${j.login}` };
      }
      case "GITHUB_REPO_OWNER":
      case "GITHUB_REPO_NAME": {
        const owner = await getVal("GITHUB_REPO_OWNER");
        const repo = await getVal("GITHUB_REPO_NAME");
        const pat = await getVal("GITHUB_PAT");
        if (!owner || !repo) return { ok: false, message: "Missing owner/repo" };
        const headers: any = pat ? { Authorization: `token ${pat}`, Accept: "application/vnd.github+json" } : { Accept: "application/vnd.github+json" };
        const r = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
        return { ok: r.ok, message: r.ok ? "Repo reachable" : `HTTP ${r.status}` };
      }
      case "TELEGRAM_BOT_TOKEN":
      case "TELEGRAM_CHAT_ID": {
        const tok = await getVal("TELEGRAM_BOT_TOKEN");
        const chat = await getVal("TELEGRAM_CHAT_ID");
        if (!tok || !chat) return { ok: false, message: "Need both token + chat id" };
        const r = await fetch(`https://api.telegram.org/bot${tok}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chat, text: "Sentix test ✅" }),
        });
        const j: any = await r.json().catch(() => ({}));
        return { ok: !!j.ok, message: j.ok ? `message_id ${j.result?.message_id}` : (j.description ?? `HTTP ${r.status}`) };
      }
      case "AUDD_API_KEY": {
        if (!v) return { ok: false, message: "No key" };
        const fd = new FormData();
        fd.append("api_token", v);
        fd.append("url", "https://audd.tech/example.mp3");
        const r = await fetch("https://api.audd.io/", { method: "POST", body: fd });
        const j: any = await r.json().catch(() => ({}));
        return { ok: j.status === "success", message: j.status === "success" ? "OK" : (j.error?.error_message ?? `HTTP ${r.status}`) };
      }
      case "ASSEMBLYAI_API_KEY": {
        if (!v) return { ok: false, message: "No key" };
        const r = await fetch("https://api.assemblyai.com/v2/transcript?limit=1", { headers: { authorization: v } });
        return { ok: r.ok, message: r.ok ? "OK" : `HTTP ${r.status}` };
      }
      case "SIGHTENGINE_USER":
      case "SIGHTENGINE_SECRET": {
        const u = await getVal("SIGHTENGINE_USER");
        const s = await getVal("SIGHTENGINE_SECRET");
        if (!u || !s) return { ok: false, message: "Need both user + secret" };
        const url = `https://api.sightengine.com/1.0/check.json?models=nudity&url=https://sightengine.com/assets/img/examples/example7.jpg&api_user=${u}&api_secret=${s}`;
        const r = await fetch(url);
        const j: any = await r.json().catch(() => ({}));
        return { ok: j.status === "success", message: j.status === "success" ? "OK" : (j.error?.message ?? `HTTP ${r.status}`) };
      }
      case "HIVE_API_KEY": {
        if (!v) return { ok: false, message: "No key" };
        return { ok: true, message: "Key stored (Hive ping not free-tier)" };
      }
      case "DEEPL_API_KEY": {
        if (!v) return { ok: false, message: "No key" };
        const r = await fetch("https://api-free.deepl.com/v2/usage", { headers: { Authorization: `DeepL-Auth-Key ${v}` } });
        return { ok: r.ok, message: r.ok ? "OK" : `HTTP ${r.status}` };
      }
      case "OPENROUTER_API_KEY": {
        if (!v) return { ok: false, message: "No key" };
        const r = await fetch("https://openrouter.ai/api/v1/models", { headers: { Authorization: `Bearer ${v}` } });
        return { ok: r.ok, message: r.ok ? "OK" : `HTTP ${r.status}` };
      }
      case "RENDER_CALLBACK_SECRET":
      case "AUTOPILOT_TICK_SECRET":
      case "PUBLIC_BASE_URL":
        return { ok: !!v, message: v ? "Stored" : "Not set" };
      case "LOVABLE_API_KEY":
        return { ok: !!process.env.LOVABLE_API_KEY, message: process.env.LOVABLE_API_KEY ? "Managed" : "Missing" };
      default:
        return { ok: !!v, message: v ? "Stored (no test endpoint)" : "Not set" };
    }
  } catch (e: any) {
    return { ok: false, message: e?.message?.slice(0, 200) ?? "Network error" };
  }
}

export const testIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ name: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx: any = context;
    const { getUserSecret } = await import("./secrets.server");
    const result = await testService(data.name, (n) => getUserSecret(ctx.supabase, ctx.userId, n));
    // Persist test result
    await ctx.supabase
      .from("user_secrets")
      .update({ last_tested_at: new Date().toISOString(), last_test_ok: result.ok, last_test_message: result.message })
      .eq("user_id", ctx.userId)
      .eq("name", data.name);
    return result;
  });

// Backwards-compat: keep simple status endpoint used by other UIs
export const getIntegrationStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx: any = context;
    const { getUserSecret } = await import("./secrets.server");
    const get = (n: string) => getUserSecret(ctx.supabase, ctx.userId, n);
    return {
      pexels: !!(await get("PEXELS_API_KEY")),
      pixabay: !!(await get("PIXABAY_API_KEY")),
      github_pat: !!(await get("GITHUB_PAT")),
      github_repo: !!(await get("GITHUB_REPO_OWNER")) && !!(await get("GITHUB_REPO_NAME")),
      render_callback_secret: !!(await get("RENDER_CALLBACK_SECRET")),
      telegram_bot: !!(await get("TELEGRAM_BOT_TOKEN")) && !!(await get("TELEGRAM_CHAT_ID")),
      lovable_gateway: !!process.env.LOVABLE_API_KEY,
    };
  });
