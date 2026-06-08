import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useState } from "react";
import { Trash2, ExternalLink, CheckCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/inspiration")({
  component: InspirationPage,
});

function InspirationPage() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  const { data: channels } = useQuery({
    queryKey: ["competitors"],
    queryFn: async () => {
      const { data } = await supabase.from("competitor_channels").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("competitor_channels").insert({
        user_id: u.user!.id,
        channel_name: name,
        channel_url: url,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setName(""); setUrl("");
      toast.success("Added");
      qc.invalidateQueries({ queryKey: ["competitors"] });
    },
  });

  const markReviewed = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("competitor_channels").update({ last_checked: new Date().toISOString() }).eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["competitors"] }),
  });

  const saveNotes = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      await supabase.from("competitor_channels").update({ notes }).eq("id", id);
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["competitors"] });
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => { await supabase.from("competitor_channels").delete().eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["competitors"] }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gradient">Inspiration Vault</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Real competitor tracking — শুধু আপনার entered data, কোনো fake AI metric নেই।
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Add competitor channel</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Input placeholder="Channel name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="URL" value={url} onChange={(e) => setUrl(e.target.value)} />
          <Button onClick={() => add.mutate()} disabled={!name || !url} className="bg-gradient-primary">Add</Button>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {channels?.map((c: any) => (
          <CompetitorCard
            key={c.id}
            c={c}
            onReview={() => markReviewed.mutate(c.id)}
            onSaveNotes={(notes) => saveNotes.mutate({ id: c.id, notes })}
            onDelete={() => del.mutate(c.id)}
          />
        ))}
      </div>
    </div>
  );
}

function CompetitorCard({ c, onReview, onSaveNotes, onDelete }: any) {
  const [notes, setNotes] = useState(c.notes ?? "");
  return (
    <Card>
      <CardContent className="pt-4 space-y-2">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="min-w-0">
            <div className="font-medium text-sm">{c.channel_name}</div>
            <a href={c.channel_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1 break-all">
              {c.channel_url} <ExternalLink className="h-3 w-3 shrink-0" />
            </a>
            {c.last_checked && (
              <div className="text-[11px] text-muted-foreground mt-0.5">
                Last reviewed: {new Date(c.last_checked).toLocaleString()}
              </div>
            )}
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={onReview}>
              <CheckCircle className="h-3.5 w-3.5" /> Mark reviewed
            </Button>
            <Button size="icon" variant="ghost" onClick={onDelete}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
        <Textarea
          placeholder="আপনার নোট (real observation, hook style, viral pattern...)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => notes !== (c.notes ?? "") && onSaveNotes(notes)}
          rows={2}
        />
      </CardContent>
    </Card>
  );
}
