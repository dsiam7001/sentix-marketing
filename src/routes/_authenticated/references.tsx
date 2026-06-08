import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useState, useRef } from "react";
import { Trash2, Upload, Sparkles, Loader2 } from "lucide-react";
import { listReferences, saveReference, deleteReference, analyzeReference } from "@/lib/references.functions";

export const Route = createFileRoute("/_authenticated/references")({
  component: ReferencesPage,
});

function ReferencesPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listReferences);
  const saveFn = useServerFn(saveReference);
  const delFn = useServerFn(deleteReference);
  const analyzeFn = useServerFn(analyzeReference);

  const [label, setLabel] = useState("");
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data } = useQuery({ queryKey: ["refs"], queryFn: () => listFn() });

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const ext = file.name.split(".").pop() || "bin";
      const path = `${u.user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("creative-references")
        .upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      const media_type = file.type.startsWith("video/") ? "video" : "image";
      await saveFn({ data: { storage_path: path, media_type, label: label || undefined } });
      toast.success("Uploaded");
      setLabel("");
      if (fileRef.current) fileRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["refs"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["refs"] }),
  });

  const analyze = async (id: string) => {
    setAnalyzing(id);
    try {
      await analyzeFn({ data: { id } });
      toast.success("Vision analysis complete");
      qc.invalidateQueries({ queryKey: ["refs"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAnalyzing(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gradient">Reference Vault</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Inspiration image/video upload করুন → AI vision-এ hook style, pacing, color mood বের করবে।
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Upload reference</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Input placeholder="Label (optional, e.g. 'viral hook style')" value={label} onChange={(e) => setLabel(e.target.value)} />
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            className="block w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground"
          />
          {uploading && <div className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</div>}
          <p className="text-xs text-muted-foreground">Image-এ full vision analysis। Video-এ label-based creative direction।</p>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {data?.items?.map((ref: any) => (
          <Card key={ref.id}>
            <CardContent className="pt-4 space-y-2">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <div className="font-medium text-sm">{ref.label || "Untitled"}</div>
                  <div className="flex gap-1.5 mt-1">
                    <Badge variant="outline" className="text-xs">{ref.media_type}</Badge>
                    {ref.analyzed_at && <Badge className="text-xs bg-primary/20 text-primary">analyzed</Badge>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" disabled={analyzing === ref.id} onClick={() => analyze(ref.id)}>
                    {analyzing === ref.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    {ref.analysis ? "Re-analyze" : "Analyze"}
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => del.mutate(ref.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
              {ref.analysis && (
                <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-xs space-y-1">
                  <div><span className="text-muted-foreground">Hook style:</span> {ref.analysis.hook_style}</div>
                  <div><span className="text-muted-foreground">Pacing:</span> {ref.analysis.pacing}</div>
                  <div><span className="text-muted-foreground">Color mood:</span> {ref.analysis.color_mood}</div>
                  <div><span className="text-muted-foreground">Visual style:</span> {ref.analysis.visual_style}</div>
                  <div className="mt-1"><span className="text-muted-foreground">Suggested angles:</span></div>
                  <ul className="list-disc list-inside ml-1">
                    {ref.analysis.suggested_angles?.map((a: string, i: number) => <li key={i}>{a}</li>)}
                  </ul>
                  <div className="pt-1 italic">{ref.analysis.bengali_summary}</div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {data?.items?.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">এখনো কোনো reference নেই। উপরে upload করুন।</p>
        )}
      </div>
    </div>
  );
}
