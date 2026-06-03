import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { polishBengali, scoreVirality } from "@/lib/ai.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Sparkles, Gauge, Download, Save, ArrowLeft, Upload } from "lucide-react";
import { useState, useEffect } from "react";
import { useServerFn as useFn } from "@tanstack/react-start";
import { analyzeVisionUpload } from "@/lib/ai.functions";

export const Route = createFileRoute("/_authenticated/scripts/$id")({
  component: ScriptDetail,
});

function ScriptDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();

  const { data: script } = useQuery({
    queryKey: ["script", id],
    queryFn: async () => {
      const { data } = await supabase.from("scripts").select("*").eq("id", id).single();
      return data;
    },
  });

  const [body, setBody] = useState("");
  const [title, setTitle] = useState("");

  useEffect(() => {
    if (script) {
      setBody(script.full_script ?? "");
      setTitle(script.title ?? "");
    }
  }, [script]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("scripts")
        .update({ full_script: body, title, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["script", id] });
    },
  });

  const polishFn = useServerFn(polishBengali);
  const polish = useMutation({
    mutationFn: () => polishFn({ data: { scriptId: id } }),
    onSuccess: () => {
      toast.success("Bengali polished");
      qc.invalidateQueries({ queryKey: ["script", id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const scoreFn = useServerFn(scoreVirality);
  const score = useMutation({
    mutationFn: () => scoreFn({ data: { scriptId: id } }),
    onSuccess: () => {
      toast.success("Scored");
      qc.invalidateQueries({ queryKey: ["script", id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const downloadSRT = () => {
    if (!script?.srt) return;
    const blob = new Blob([script.srt], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${script.title || "script"}.srt`;
    a.click();
  };

  const downloadShotList = () => {
    if (!script) return;
    const rows = [["#", "Start", "End", "Narration", "Visual", "On-screen text", "Effects", "B-roll keywords"]];
    (script.scenes as any[]).forEach((s: any, i: number) => {
      rows.push([
        String(i + 1),
        String(s.start_sec),
        String(s.end_sec),
        s.narration,
        s.visual,
        s.on_screen_text,
        s.effects,
        s.broll_keywords,
      ]);
    });
    const csv = rows.map((r) => r.map((c) => `"${(c ?? "").toString().replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${script.title || "shotlist"}.csv`;
    a.click();
  };

  const downloadAll = () => {
    if (!script) return;
    const text = `# ${script.title}\n\n## Hook\n${script.hook}\n\n## Full Script\n${script.full_script}\n\n## Caption\n${script.caption}\n\n## Hashtags\n${script.hashtags}\n\n## Music Mood\n${script.music_mood}\n\n## Thumbnail\n${script.thumbnail_concept}\n`;
    const blob = new Blob([text], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${script.title || "script"}.md`;
    a.click();
  };

  // vision upload
  const visionFn = useFn(analyzeVisionUpload);
  const [visionUrl, setVisionUrl] = useState("");
  const [visionResult, setVisionResult] = useState<string | null>(null);
  const vision = useMutation({
    mutationFn: () => visionFn({ data: { imageUrl: visionUrl } }),
    onSuccess: (d: any) => setVisionResult(d.analysis),
    onError: (e: any) => toast.error(e.message),
  });

  if (!script) return <div className="text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link to="/scripts">
            <Button size="sm" variant="ghost"><ArrowLeft className="h-4 w-4" /> Back</Button>
          </Link>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => polish.mutate()} disabled={polish.isPending}>
            <Sparkles className="h-4 w-4" /> Polish Bengali
          </Button>
          <Button size="sm" variant="outline" onClick={() => score.mutate()} disabled={score.isPending}>
            <Gauge className="h-4 w-4" /> Score
          </Button>
          <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending} className="bg-gradient-primary">
            <Save className="h-4 w-4" /> Save
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} className="text-xl font-bold" />
          <div className="flex gap-2 flex-wrap mt-2">
            {script.polished && <Badge variant="outline">polished</Badge>}
            {script.virality_score && (
              <Badge className="bg-primary/20 text-primary border-primary/30">
                AI confidence {script.virality_score}/100
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={14} className="font-mono text-sm" />
        </CardContent>
      </Card>

      {script.virality_breakdown && (
        <Card>
          <CardHeader><CardTitle className="text-base">AI Score Breakdown</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <ScoreRow label="Hook" value={(script.virality_breakdown as any).hook} max={25} />
            <ScoreRow label="Emotion" value={(script.virality_breakdown as any).emotion} max={25} />
            <ScoreRow label="Relatability" value={(script.virality_breakdown as any).relatability} max={20} />
            <ScoreRow label="Trend alignment" value={(script.virality_breakdown as any).trend_alignment} max={15} />
            <ScoreRow label="Market timing" value={(script.virality_breakdown as any).market_timing} max={15} />
            {(script.virality_breakdown as any).reasoning && (
              <div className="pt-2 border-t border-border">
                <div className="text-xs uppercase text-muted-foreground mb-1">Reasoning</div>
                <p className="text-sm whitespace-pre-wrap">{(script.virality_breakdown as any).reasoning}</p>
              </div>
            )}
            {(script.virality_breakdown as any).improvement_tips && (
              <div className="pt-2">
                <div className="text-xs uppercase text-muted-foreground mb-1">Improvement tips</div>
                <p className="text-sm whitespace-pre-wrap">{(script.virality_breakdown as any).improvement_tips}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Scene-by-Scene Shot List</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(script.scenes as any[])?.map((s: any, i: number) => (
            <div key={i} className="rounded-lg border border-border p-3 text-sm space-y-1">
              <div className="flex justify-between items-center">
                <span className="font-mono text-xs text-primary">{s.start_sec}s — {s.end_sec}s</span>
                <Badge variant="outline" className="text-xs">Scene {i + 1}</Badge>
              </div>
              <div><span className="text-muted-foreground">Narration:</span> {s.narration}</div>
              <div><span className="text-muted-foreground">Visual:</span> {s.visual}</div>
              <div><span className="text-muted-foreground">On-screen:</span> {s.on_screen_text}</div>
              <div><span className="text-muted-foreground">Effects:</span> {s.effects}</div>
              <div><span className="text-muted-foreground">B-roll:</span> {s.broll_keywords}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Production Bundle</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div><span className="text-muted-foreground">Music mood:</span> {script.music_mood}</div>
          <div><span className="text-muted-foreground">Thumbnail concept:</span> {script.thumbnail_concept}</div>
          <div><span className="text-muted-foreground">Caption:</span><br />{script.caption}</div>
          <div><span className="text-muted-foreground">Hashtags:</span> {script.hashtags}</div>
          <div className="flex gap-2 flex-wrap pt-2">
            <Button size="sm" variant="outline" onClick={downloadSRT}><Download className="h-4 w-4" /> SRT</Button>
            <Button size="sm" variant="outline" onClick={downloadShotList}><Download className="h-4 w-4" /> Shot list CSV</Button>
            <Button size="sm" variant="outline" onClick={downloadAll}><Download className="h-4 w-4" /> Full markdown</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Upload className="h-4 w-4" /> Vision Inbox</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground text-xs">
            Profit/loss screenshot বা trading chart-এর URL দিন — Gemini Vision analyze করে suggest করবে কীভাবে video-তে use করবেন।
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="https://image-url.com/screenshot.png"
              value={visionUrl}
              onChange={(e) => setVisionUrl(e.target.value)}
            />
            <Button size="sm" onClick={() => vision.mutate()} disabled={vision.isPending || !visionUrl}>
              Analyze
            </Button>
          </div>
          {visionResult && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 whitespace-pre-wrap">
              {visionResult}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ScoreRow({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.min(100, ((value ?? 0) / max) * 100);
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span>{label}</span>
        <span className="text-muted-foreground">{value ?? 0} / {max}</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-gradient-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
