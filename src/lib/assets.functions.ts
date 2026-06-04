import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { createHash } from "crypto";

function hashQuery(source: string, query: string) {
  return createHash("sha256").update(`${source}|${query.toLowerCase().trim()}`).digest("hex").slice(0, 32);
}

async function searchPexels(query: string, perPage = 5) {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return [];
  const res = await fetch(
    `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=portrait`,
    { headers: { Authorization: key } },
  );
  if (!res.ok) return [];
  const json: any = await res.json();
  return (json.videos ?? []).map((v: any) => {
    const file = v.video_files?.find((f: any) => f.quality === "hd" && f.height >= 720) ?? v.video_files?.[0];
    return {
      source: "pexels",
      url: file?.link ?? v.url,
      preview: v.image,
      duration: v.duration,
      width: file?.width,
      height: file?.height,
    };
  });
}

async function searchPixabay(query: string, perPage = 5) {
  const key = process.env.PIXABAY_API_KEY;
  if (!key) return [];
  const res = await fetch(
    `https://pixabay.com/api/videos/?key=${key}&q=${encodeURIComponent(query)}&per_page=${perPage}&video_type=film`,
  );
  if (!res.ok) return [];
  const json: any = await res.json();
  return (json.hits ?? []).map((h: any) => ({
    source: "pixabay",
    url: h.videos?.medium?.url ?? h.videos?.small?.url,
    preview: h.picture_id ? `https://i.vimeocdn.com/video/${h.picture_id}_640x360.jpg` : null,
    duration: h.duration,
    width: h.videos?.medium?.width,
    height: h.videos?.medium?.height,
  }));
}

function pollinationsImageUrl(prompt: string, seed?: number) {
  const s = seed ?? Math.floor(Math.random() * 100000);
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1080&height=1920&seed=${s}&nologo=true&enhance=true`;
}

export const searchAssets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        query: z.string().min(2).max(120),
        sources: z.array(z.enum(["pexels", "pixabay", "pollinations"])).default(["pexels", "pixabay"]),
        perPage: z.number().min(1).max(10).default(4),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const ctx: any = context;
    const results: any[] = [];

    for (const src of data.sources) {
      const qh = hashQuery(src, data.query);
      const { data: cached } = await ctx.supabase
        .from("asset_cache")
        .select("*")
        .eq("user_id", ctx.userId)
        .eq("query_hash", qh)
        .limit(8);
      if (cached && cached.length > 0) {
        results.push(...cached.map((c: any) => ({ ...(c.metadata ?? {}), source: c.source, url: c.url, cached: true })));
        continue;
      }

      let fresh: any[] = [];
      if (src === "pexels") fresh = await searchPexels(data.query, data.perPage);
      else if (src === "pixabay") fresh = await searchPixabay(data.query, data.perPage);
      else if (src === "pollinations") {
        fresh = Array.from({ length: data.perPage }).map(() => ({
          source: "pollinations",
          url: pollinationsImageUrl(data.query),
          preview: null,
          duration: null,
        }));
      }

      if (fresh.length > 0) {
        const rows = fresh
          .filter((f) => f.url)
          .map((f) => ({
            user_id: ctx.userId,
            query_hash: qh,
            source: src,
            query: data.query,
            url: f.url,
            metadata: { preview: f.preview, duration: f.duration, width: f.width, height: f.height },
          }));
        if (rows.length > 0) {
          await ctx.supabase.from("asset_cache").upsert(rows, {
            onConflict: "user_id,query_hash,url",
            ignoreDuplicates: true,
          });
        }
      }
      results.push(...fresh);
    }

    return { assets: results };
  });

export const generatePollinationsAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ prompt: z.string().min(2).max(300), seed: z.number().optional() }).parse(d))
  .handler(async ({ data }) => {
    return { url: pollinationsImageUrl(data.prompt, data.seed) };
  });

export const planAssetsForScript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ scriptId: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx: any = context;
    const { data: script } = await ctx.supabase
      .from("scripts")
      .select("id, scenes")
      .eq("id", data.scriptId)
      .maybeSingle();
    if (!script) throw new Error("Script not found");

    const plan: any[] = [];
    for (const scene of (script.scenes as any[]) ?? []) {
      const keyword = scene.broll_keywords || scene.visual || "trading chart";
      let assets: any[] = [];
      // Try Pexels
      const qhP = hashQuery("pexels", keyword);
      const { data: cachedP } = await ctx.supabase
        .from("asset_cache")
        .select("*")
        .eq("user_id", ctx.userId)
        .eq("query_hash", qhP)
        .limit(3);
      if (cachedP && cachedP.length > 0) {
        assets = cachedP.map((c: any) => ({ source: "pexels", url: c.url, ...c.metadata }));
      } else {
        assets = await searchPexels(keyword, 3);
        if (assets.length > 0) {
          await ctx.supabase.from("asset_cache").upsert(
            assets.map((a) => ({
              user_id: ctx.userId,
              query_hash: qhP,
              source: "pexels",
              query: keyword,
              url: a.url,
              metadata: { preview: a.preview, duration: a.duration, width: a.width, height: a.height },
            })),
            { onConflict: "user_id,query_hash,url", ignoreDuplicates: true },
          );
        }
      }

      // Pollinations fallback if nothing
      if (assets.length === 0) {
        assets = [{ source: "pollinations", url: pollinationsImageUrl(`cinematic trading chart ${keyword}, dark cyberpunk`), preview: null }];
      }

      plan.push({
        start_sec: scene.start_sec,
        end_sec: scene.end_sec,
        narration: scene.narration,
        on_screen_text: scene.on_screen_text,
        keyword,
        chosen: assets[0],
        alternatives: assets.slice(1),
      });
    }

    await ctx.supabase.from("scripts").update({ asset_plan: plan }).eq("id", data.scriptId);
    return { plan };
  });
