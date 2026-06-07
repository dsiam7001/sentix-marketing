// Server-only helper: read a secret from the user_secrets table first,
// fall back to process.env (with alias tolerance for common name variations).
// Never import this from client code.

// Map canonical names → list of env var aliases to try (handles user typos / casing).
const ENV_ALIASES: Record<string, string[]> = {
  GITHUB_PAT: ["GITHUB_PAT", "GitHub_PAT", "GitHu_PAT", "GH_PAT", "GITHUB_TOKEN"],
  GITHUB_REPO_OWNER: ["GITHUB_REPO_OWNER", "GitHub_Repo_Owner", "GH_REPO_OWNER", "GITHUB_OWNER"],
  GITHUB_REPO_NAME: ["GITHUB_REPO_NAME", "GitHub_Repo_Name", "GH_REPO_NAME", "GITHUB_REPO"],
  PEXELS_API_KEY: ["PEXELS_API_KEY", "Pexels_API_Key"],
  PIXABAY_API_KEY: ["PIXABAY_API_KEY", "Pixabay_API_Key"],
  PIXABAY_IMAGE_API_KEY: ["PIXABAY_IMAGE_API_KEY", "PIXABAY_API_KEY", "Pixabay_API_Key"],
  PIXABAY_VIDEO_API_KEY: ["PIXABAY_VIDEO_API_KEY", "PIXABAY_API_KEY", "Pixabay_API_Key"],
  TELEGRAM_BOT_TOKEN: ["TELEGRAM_BOT_TOKEN", "Telegram_Bot_Token"],
  TELEGRAM_CHAT_ID: ["TELEGRAM_CHAT_ID", "Telegram_Chat_ID", "Telegram_Chat_Id"],
  RENDER_CALLBACK_SECRET: ["RENDER_CALLBACK_SECRET", "Render_Callback_Secret"],
  AUTOPILOT_TICK_SECRET: ["AUTOPILOT_TICK_SECRET"],
  PUBLIC_BASE_URL: ["PUBLIC_BASE_URL"],
  LOVABLE_API_KEY: ["LOVABLE_API_KEY"],
};

function readEnvAlias(name: string): string | null {
  const candidates = ENV_ALIASES[name] ?? [name];
  for (const k of candidates) {
    const v = process.env[k];
    if (v && v.trim().length > 0) return v;
  }
  return null;
}

export async function getUserSecret(
  supabase: any,
  userId: string,
  name: string,
): Promise<string | null> {
  try {
    const { data } = await supabase
      .from("user_secrets")
      .select("value")
      .eq("user_id", userId)
      .eq("name", name)
      .maybeSingle();
    if (data?.value) return data.value as string;
  } catch {
    // ignore — RLS or missing row
  }
  return readEnvAlias(name);
}

export async function getAnySecret(name: string): Promise<string | null> {
  return readEnvAlias(name);
}
