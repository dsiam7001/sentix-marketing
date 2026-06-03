import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/performance")({
  component: PerformancePage,
});

function PerformancePage() {
  const qc = useQueryClient();

  const { data: scripts } = useQuery({
    queryKey: ["scripts-for-perf"],
    queryFn: async () => {
      const { data } = await supabase
        .from("scripts")
        .select("id, title, virality_score")
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  const { data: videos } = useQuery({
    queryKey: ["videos"],
    queryFn: async () => {
      const { data } = await supabase
        .from("videos_published")
        .select("*, scripts(title, virality_score)")
        .order("published_at", { ascending: false });
      return data ?? [];
    },
  });

  const [scriptId, setScriptId] = useState("");
  const [platform, setPlatform] = useState("tiktok");
  const [url, setUrl] = useState("");

  const log = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("videos_published").insert({
        user_id: u.user!.id,
        script_id: scriptId || null,
        platform,
        video_url: url || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Logged");
      setScriptId("");
      setUrl("");
      qc.invalidateQueries({ queryKey: ["videos"] });
    },
  });

  const updateViews = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: number }) => {
      const patch: Record<string, number> = { [field]: value };
      await supabase.from("videos_published").update(patch as any).eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["videos"] }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gradient">Performance Tracker</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Real data input → AI calibration। ৫ সেকেন্ডে views log করুন।
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Log a published video</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <select
            value={scriptId}
            onChange={(e) => setScriptId(e.target.value)}
            className="w-full rounded-md bg-input border border-border px-3 py-2 text-sm"
          >
            <option value="">— Select script (optional) —</option>
            {scripts?.map((s: any) => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="rounded-md bg-input border border-border px-3 py-2 text-sm">
              <option value="tiktok">TikTok</option>
              <option value="facebook">Facebook Reels</option>
              <option value="instagram">Instagram Reels</option>
              <option value="youtube">YouTube Shorts</option>
            </select>
            <Input placeholder="Video URL (optional)" value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>
          <Button onClick={() => log.mutate()} disabled={log.isPending} className="bg-gradient-primary">
            Log video
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {videos?.map((v: any) => (
          <Card key={v.id}>
            <CardContent className="pt-4">
              <div className="flex justify-between items-start gap-3 flex-wrap mb-3">
                <div>
                  <div className="font-medium">{v.scripts?.title || "Untitled"}</div>
                  <div className="text-xs text-muted-foreground">
                    {v.platform} · {new Date(v.published_at).toLocaleDateString()}
                    {v.scripts?.virality_score && <> · AI predicted: {v.scripts.virality_score}</>}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <ViewsInput label="24h" value={v.views_24h} onSave={(val: number) => updateViews.mutate({ id: v.id, field: "views_24h", value: val })} />
                <ViewsInput label="48h" value={v.views_48h} onSave={(val: number) => updateViews.mutate({ id: v.id, field: "views_48h", value: val })} />
                <ViewsInput label="72h" value={v.views_72h} onSave={(val: number) => updateViews.mutate({ id: v.id, field: "views_72h", value: val })} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ViewsInput({ label, value, onSave }: any) {
  const [v, setV] = useState(value ?? "");
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label} views</label>
      <Input
        type="number"
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => v !== (value ?? "") && onSave(parseInt(v) || 0)}
      />
    </div>
  );
}
