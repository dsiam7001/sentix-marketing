import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getIntegrationStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    return {
      pexels: !!process.env.PEXELS_API_KEY,
      pixabay: !!process.env.PIXABAY_API_KEY,
      github_pat: !!process.env.GITHUB_PAT,
      github_repo: !!(process.env.GITHUB_REPO_OWNER && process.env.GITHUB_REPO_NAME),
      render_callback_secret: !!process.env.RENDER_CALLBACK_SECRET,
      telegram_bot: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
      lovable_gateway: !!process.env.LOVABLE_API_KEY,
    };
  });
