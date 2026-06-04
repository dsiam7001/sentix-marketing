import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

export const Route = createFileRoute("/api/public/render-callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.RENDER_CALLBACK_SECRET;
        if (!secret) return new Response("Not configured", { status: 500 });

        let body: any;
        try {
          body = await request.json();
        } catch {
          return new Response("Bad JSON", { status: 400 });
        }
        const { job_id, script_id, signature, status, video_url, audio_url, error, github_run_id } = body ?? {};
        if (!job_id || !script_id || !signature || !status) {
          return new Response("Missing fields", { status: 400 });
        }

        const expected = createHmac("sha256", secret).update(`${job_id}:${script_id}`).digest("hex");
        try {
          const a = Buffer.from(signature);
          const b = Buffer.from(expected);
          if (a.length !== b.length || !timingSafeEqual(a, b)) {
            return new Response("Invalid signature", { status: 401 });
          }
        } catch {
          return new Response("Invalid signature", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const finished = ["succeeded", "failed"].includes(status);
        await supabaseAdmin
          .from("render_jobs")
          .update({
            status,
            video_url: video_url ?? null,
            audio_url: audio_url ?? null,
            error: error ?? null,
            github_run_id: github_run_id ?? null,
            finished_at: finished ? new Date().toISOString() : null,
          })
          .eq("id", job_id);

        if (status === "succeeded" && video_url) {
          await supabaseAdmin
            .from("scripts")
            .update({ render_status: "rendered", video_url, audio_url: audio_url ?? null })
            .eq("id", script_id);
        } else if (status === "failed") {
          await supabaseAdmin
            .from("scripts")
            .update({ render_status: "failed" })
            .eq("id", script_id);
        } else {
          await supabaseAdmin
            .from("scripts")
            .update({ render_status: status })
            .eq("id", script_id);
        }

        return Response.json({ ok: true });
      },
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        }),
    },
  },
});
