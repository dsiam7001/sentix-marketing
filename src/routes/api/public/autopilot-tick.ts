import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

// HMAC-secured cron entrypoint. pg_cron POSTs every 15 minutes.
export const Route = createFileRoute("/api/public/autopilot-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.AUTOPILOT_TICK_SECRET;
        if (!expected) return new Response("Not configured", { status: 503 });

        const signature = request.headers.get("x-autopilot-signature");
        const body = await request.text();
        const calc = createHmac("sha256", expected).update(body).digest("hex");
        if (!signature || signature.length !== calc.length) return new Response("Unauthorized", { status: 401 });
        try {
          if (!timingSafeEqual(Buffer.from(signature), Buffer.from(calc))) return new Response("Unauthorized", { status: 401 });
        } catch { return new Response("Unauthorized", { status: 401 }); }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { autopilotForUser } = await import("@/lib/autopilot.functions");

        // Run autopilot for every user whose autopilot is enabled
        const { data: users } = await supabaseAdmin
          .from("autopilot_settings")
          .select("user_id")
          .eq("enabled", true);

        const results: any[] = [];
        for (const u of users ?? []) {
          try {
            const r = await autopilotForUser(supabaseAdmin, u.user_id);
            results.push({ user_id: u.user_id, ...r });
          } catch (e: any) {
            results.push({ user_id: u.user_id, error: e?.message });
          }
        }
        return Response.json({ ok: true, processed: results.length, results });
      },
    },
  },
});
