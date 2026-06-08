import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

export const Route = createFileRoute("/api/public/render-callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.RENDER_CALLBACK_SECRET;
        // Note: secret may also be per-user, but the GH workflow only knows the env-set one
        if (!secret) return new Response("Not configured", { status: 500 });

        let body: any;
        try { body = await request.json(); } catch { return new Response("Bad JSON", { status: 400 }); }
        const { job_id, script_id, signature, status, video_url, audio_url, error, github_run_id } = body ?? {};
        if (!job_id || !script_id || !signature || !status) return new Response("Missing fields", { status: 400 });

        const expected = createHmac("sha256", secret).update(`${job_id}:${script_id}`).digest("hex");
        try {
          const a = Buffer.from(signature); const b = Buffer.from(expected);
          if (a.length !== b.length || !timingSafeEqual(a, b)) return new Response("Invalid signature", { status: 401 });
        } catch { return new Response("Invalid signature", { status: 401 }); }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Idempotency: if the job is already in a terminal state, skip side effects
        const { data: existing } = await supabaseAdmin
          .from("render_jobs").select("id, status, user_id, video_url").eq("id", job_id).maybeSingle();
        if (!existing) return new Response("Unknown job", { status: 404 });
        if (existing.status === "succeeded" || existing.status === "failed") {
          return Response.json({ ok: true, idempotent: true });
        }

        const finished = ["succeeded", "failed"].includes(status);
        await supabaseAdmin.from("render_jobs").update({
          status, video_url: video_url ?? null, audio_url: audio_url ?? null,
          error: error ?? null, github_run_id: github_run_id ?? null,
          finished_at: finished ? new Date().toISOString() : null,
        }).eq("id", job_id);

        if (status === "succeeded" && video_url) {
          await supabaseAdmin.from("scripts").update({
            render_status: "rendered", video_url, audio_url: audio_url ?? null,
          }).eq("id", script_id);

          // Run guardrails (optional — skips if no API keys)
          try {
            const { runGuardrailsCore } = await import("@/lib/guardrails.functions");
            const guard = await runGuardrailsCore(supabaseAdmin, existing.user_id, script_id, job_id, video_url);
            // If guard blocked, halt before Telegram
            if (guard.verdict === "block") {
              await supabaseAdmin.from("scripts").update({
                status: "needs_review",
                needs_review_reason: `Guard block: ${guard.flags.join(" · ")}`,
              }).eq("id", script_id);
              return Response.json({ ok: true, guard: guard.verdict, halted: true });
            }
          } catch { /* ignore — optional */ }

          // Telegram delivery — send actual VIDEO with caption (real proof)
          try {
            const { data: settings } = await supabaseAdmin
              .from("autopilot_settings").select("auto_publish_telegram").eq("user_id", existing.user_id).maybeSingle();
            if (settings?.auto_publish_telegram) {
              const { data: tok } = await supabaseAdmin.from("user_secrets")
                .select("value").eq("user_id", existing.user_id).eq("name", "TELEGRAM_BOT_TOKEN").maybeSingle();
              const { data: chat } = await supabaseAdmin.from("user_secrets")
                .select("value").eq("user_id", existing.user_id).eq("name", "TELEGRAM_CHAT_ID").maybeSingle();
              const token = tok?.value ?? process.env.TELEGRAM_BOT_TOKEN;
              const chatId = chat?.value ?? process.env.TELEGRAM_CHAT_ID;
              if (token && chatId) {
                const { data: script } = await supabaseAdmin.from("scripts").select("title, caption, hashtags").eq("id", script_id).maybeSingle();
                const caption = `🎬 ${script?.title ?? "New video"}\n\n${script?.caption ?? ""}\n\n${script?.hashtags ?? ""}`.slice(0, 1024);
                // sendVideo with URL (Telegram fetches it)
                const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendVideo`, {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ chat_id: chatId, video: video_url, caption, supports_streaming: true }),
                });
                const tgJson: any = await tgRes.json().catch(() => ({}));
                if (tgJson?.ok && tgJson.result?.message_id) {
                  await supabaseAdmin.from("render_jobs").update({
                    telegram_message_id: String(tgJson.result.message_id),
                    telegram_delivered_at: new Date().toISOString(),
                  }).eq("id", job_id);
                } else {
                  // Fallback: send message with link if video fails
                  const fb = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ chat_id: chatId, text: `${caption}\n\n${video_url}` }),
                  });
                  const fbJson: any = await fb.json().catch(() => ({}));
                  if (fbJson?.ok && fbJson.result?.message_id) {
                    await supabaseAdmin.from("render_jobs").update({
                      telegram_message_id: String(fbJson.result.message_id),
                      telegram_delivered_at: new Date().toISOString(),
                      error: `sendVideo failed: ${tgJson?.description ?? "unknown"} — fallback to sendMessage OK`,
                    }).eq("id", job_id);
                  } else {
                    await supabaseAdmin.from("render_jobs").update({
                      error: `Telegram delivery failed: ${tgJson?.description ?? fbJson?.description ?? "unknown"}`,
                    }).eq("id", job_id);
                  }
                }
              }
            }
          } catch (e: any) {
            await supabaseAdmin.from("render_jobs").update({
              error: `Telegram exception: ${e?.message ?? "unknown"}`,
            }).eq("id", job_id);
          }
        } else if (status === "failed") {
          await supabaseAdmin.from("scripts").update({ render_status: "failed" }).eq("id", script_id);
        } else {
          await supabaseAdmin.from("scripts").update({ render_status: status }).eq("id", script_id);
        }

        return Response.json({ ok: true });
      },
      OPTIONS: async () => new Response(null, {
        status: 204,
        headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" },
      }),
    },
  },
});
