import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Lazy guardrail checks. Each sub-check skips gracefully if its key is missing.
export async function runGuardrailsCore(supabase: any, userId: string, scriptId: string, renderJobId: string | null, videoUrl: string) {
  const { getUserSecret } = await import("./secrets.server");
  const flags: string[] = [];
  const raw: any = {};
  let audio_copyright_score: number | null = null;
  let ai_voice_score: number | null = null;
  let ai_video_score: number | null = null;
  let transcript_match_pct: number | null = null;
  let transcript_actual = "";

  // 1. AudD music copyright
  const auddKey = await getUserSecret(supabase, userId, "AUDD_API_KEY");
  if (auddKey) {
    try {
      const fd = new FormData();
      fd.append("api_token", auddKey);
      fd.append("url", videoUrl);
      fd.append("return", "apple_music,spotify");
      const r = await fetch("https://api.audd.io/recognize", { method: "POST", body: fd });
      const j: any = await r.json();
      raw.audd = j;
      if (j.status === "success" && j.result) {
        audio_copyright_score = 0.9;
        flags.push(`Music match: ${j.result.title} — ${j.result.artist}`);
      } else {
        audio_copyright_score = 0.05;
      }
    } catch (e: any) { raw.audd_error = e?.message; }
  }

  // 2. Sightengine AI-generated content detection (video keyframe)
  const seUser = await getUserSecret(supabase, userId, "SIGHTENGINE_USER");
  const seSecret = await getUserSecret(supabase, userId, "SIGHTENGINE_SECRET");
  if (seUser && seSecret) {
    try {
      const url = `https://api.sightengine.com/1.0/check.json?models=genai&url=${encodeURIComponent(videoUrl)}&api_user=${seUser}&api_secret=${seSecret}`;
      const r = await fetch(url);
      const j: any = await r.json();
      raw.sightengine = j;
      const genai = j.type?.ai_generated ?? j.genai?.ai_generated ?? null;
      if (typeof genai === "number") {
        ai_video_score = genai;
        if (genai > 0.7) flags.push(`Sightengine AI-generated likelihood ${(genai * 100).toFixed(0)}%`);
      }
    } catch (e: any) { raw.sightengine_error = e?.message; }
  }

  // 3. AssemblyAI transcript verify
  const aaKey = await getUserSecret(supabase, userId, "ASSEMBLYAI_API_KEY");
  if (aaKey) {
    try {
      // Submit
      const sub = await fetch("https://api.assemblyai.com/v2/transcript", {
        method: "POST",
        headers: { authorization: aaKey, "content-type": "application/json" },
        body: JSON.stringify({ audio_url: videoUrl, language_code: "bn" }),
      });
      const subJ: any = await sub.json();
      if (subJ.id) {
        // Poll briefly (max 30s)
        for (let i = 0; i < 15; i++) {
          await new Promise((r) => setTimeout(r, 2000));
          const p = await fetch(`https://api.assemblyai.com/v2/transcript/${subJ.id}`, { headers: { authorization: aaKey } });
          const pJ: any = await p.json();
          if (pJ.status === "completed") {
            transcript_actual = pJ.text ?? "";
            raw.assemblyai_status = "completed";
            // Compare with intended SRT/script
            const { data: s } = await supabase.from("scripts").select("full_script").eq("id", scriptId).maybeSingle();
            const intended = (s?.full_script ?? "").toLowerCase().replace(/\s+/g, " ");
            const actual = transcript_actual.toLowerCase().replace(/\s+/g, " ");
            if (intended && actual) {
              const aw = new Set(actual.split(" "));
              const iw = intended.split(" ");
              const matches = iw.filter((w: string) => aw.has(w)).length;
              transcript_match_pct = Math.round((matches / iw.length) * 100);
              if (transcript_match_pct < 60) flags.push(`Transcript match only ${transcript_match_pct}%`);
            }
            break;
          }
          if (pJ.status === "error") { raw.assemblyai_error = pJ.error; break; }
        }
      }
    } catch (e: any) { raw.assemblyai_error = e?.message; }
  }

  // Verdict
  let verdict: "clear" | "warn" | "block" = "clear";
  if (audio_copyright_score && audio_copyright_score > 0.7) verdict = "block";
  else if (ai_video_score && ai_video_score > 0.85) verdict = "block";
  else if (flags.length > 0) verdict = "warn";

  const { data: report } = await supabase.from("guard_reports").insert({
    user_id: userId, script_id: scriptId, render_job_id: renderJobId,
    audio_copyright_score, ai_voice_score, ai_video_score, transcript_match_pct,
    transcript_actual, flags, verdict, raw,
  }).select().single();

  return { report, verdict, flags };
}

export const runGuardrails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ scriptId: z.string(), renderJobId: z.string().nullable(), videoUrl: z.string().url() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx: any = context;
    return runGuardrailsCore(ctx.supabase, ctx.userId, data.scriptId, data.renderJobId, data.videoUrl);
  });

export const recentGuardReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx: any = context;
    const { data } = await ctx.supabase
      .from("guard_reports")
      .select("*, scripts(title)")
      .eq("user_id", ctx.userId)
      .order("created_at", { ascending: false })
      .limit(20);
    return { reports: data ?? [] };
  });
