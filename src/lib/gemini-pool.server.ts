// Server-only Gemini key rotator. Falls back to Lovable AI Gateway when
// no user-managed keys are available or all are cooled-down.
// SECURITY: never import this file from client code.

type GeminiCall = {
  system: string;
  user: string;
  tools?: any[];
  toolChoice?: any;
  model?: string;
  imageUrl?: string;
};

const GOOGLE_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_GOOGLE_MODEL = "gemini-2.0-flash-exp";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const GATEWAY_MODEL = "google/gemini-3-flash-preview";

async function callViaGateway(opts: GeminiCall): Promise<any> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY missing");
  const userContent: any = opts.imageUrl
    ? [
        { type: "text", text: opts.user },
        { type: "image_url", image_url: { url: opts.imageUrl } },
      ]
    : opts.user;
  const body: any = {
    model: opts.model ?? GATEWAY_MODEL,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: userContent },
    ],
  };
  if (opts.tools) {
    body.tools = opts.tools;
    body.tool_choice = opts.toolChoice;
  }
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    const e: any = new Error(`Gateway ${res.status}: ${text.slice(0, 200)}`);
    e.status = res.status;
    throw e;
  }
  const json = await res.json();
  const msg = json.choices?.[0]?.message;
  if (opts.tools) {
    const call = msg?.tool_calls?.[0];
    if (!call) throw new Error("Gateway: no structured output");
    return JSON.parse(call.function.arguments);
  }
  return msg?.content ?? "";
}

async function callGoogleDirect(apiKey: string, opts: GeminiCall): Promise<any> {
  const model = opts.model ?? DEFAULT_GOOGLE_MODEL;
  const parts: any[] = [{ text: opts.user }];
  if (opts.imageUrl) {
    // fetch and inline (Google direct API needs inline_data for non-public URLs;
    // public URLs may be passed as fileData but we keep it simple here)
    try {
      const imgRes = await fetch(opts.imageUrl);
      const buf = await imgRes.arrayBuffer();
      const mime = imgRes.headers.get("content-type") ?? "image/jpeg";
      parts.push({
        inline_data: {
          mime_type: mime,
          data: Buffer.from(buf).toString("base64"),
        },
      });
    } catch {
      // skip image
    }
  }

  const body: any = {
    systemInstruction: { parts: [{ text: opts.system }] },
    contents: [{ role: "user", parts }],
    generationConfig: { temperature: 0.85, maxOutputTokens: 4096 },
  };

  if (opts.tools && opts.tools[0]?.function) {
    const fn = opts.tools[0].function;
    body.tools = [
      {
        functionDeclarations: [
          {
            name: fn.name,
            description: fn.description ?? "",
            parameters: fn.parameters,
          },
        ],
      },
    ];
    body.toolConfig = {
      functionCallingConfig: { mode: "ANY", allowedFunctionNames: [fn.name] },
    };
  }

  const res = await fetch(
    `${GOOGLE_BASE}/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    const e: any = new Error(`Google ${res.status}: ${text.slice(0, 200)}`);
    e.status = res.status;
    throw e;
  }
  const json = await res.json();
  const cand = json.candidates?.[0];
  if (opts.tools) {
    const fc = cand?.content?.parts?.find((p: any) => p.functionCall)
      ?.functionCall;
    if (!fc) throw new Error("Google: no function call returned");
    return fc.args;
  }
  return cand?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
}

/**
 * Try the user's Gemini key pool first (round-robin), then fall back to
 * Lovable AI Gateway. Tracks 429s and applies a 1-hour cooldown per key.
 *
 * `supabase` MUST be the authenticated client (from requireSupabaseAuth context)
 * so RLS scopes the gemini_keys read to the current user.
 */
export async function callLLMWithRotation(
  supabase: any,
  userId: string,
  opts: GeminiCall,
): Promise<any> {
  const today = new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();

  // Reset daily counters lazily
  await supabase
    .from("gemini_keys")
    .update({ daily_calls: 0, daily_reset_at: today })
    .eq("user_id", userId)
    .lt("daily_reset_at", today);

  const { data: keys } = await supabase
    .from("gemini_keys")
    .select("id, label, key_value, daily_calls, cooldown_until, failure_count, total_calls")
    .eq("user_id", userId)
    .eq("active", true)
    .or(`cooldown_until.is.null,cooldown_until.lt.${nowIso}`)
    .order("last_used", { ascending: true, nullsFirst: true })
    .limit(20);

  if (keys && keys.length > 0) {
    for (const k of keys) {
      try {
        const result = await callGoogleDirect(k.key_value, opts);
        await supabase
          .from("gemini_keys")
          .update({
            last_used: nowIso,
            daily_calls: (k.daily_calls ?? 0) + 1,
            total_calls: (k.total_calls ?? 0) + 1,
            failure_count: 0,
          })
          .eq("id", k.id);
        return { result, source: "user_key", keyLabel: k.label };
      } catch (err: any) {
        if (err.status === 429 || err.status === 403) {
          const cd = new Date(Date.now() + 60 * 60 * 1000).toISOString();
          await supabase
            .from("gemini_keys")
            .update({
              cooldown_until: cd,
              last_429_at: nowIso,
              failure_count: (k.failure_count ?? 0) + 1,
            })
            .eq("id", k.id);
          continue;
        }
        // non-rate-limit error → break out, try gateway
        break;
      }
    }
  }

  // Fallback: Lovable AI Gateway
  const result = await callViaGateway(opts);
  return { result, source: "lovable_gateway", keyLabel: null };
}
