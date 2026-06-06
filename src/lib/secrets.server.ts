// Server-only helper: read a secret from the user_secrets table first,
// fall back to process.env. Never import this from client code.

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
  return process.env[name] ?? null;
}

export async function getAnySecret(name: string): Promise<string | null> {
  return process.env[name] ?? null;
}
