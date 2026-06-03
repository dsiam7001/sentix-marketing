import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useState } from "react";
import { Trash2, ExternalLink } from "lucide-react";

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

  const del = useMutation({
    mutationFn: async (id: string) => { await supabase.from("competitor_channels").delete().eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["competitors"] }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gradient">Inspiration Vault</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Top competitor track করুন। Pattern শিখুন, copy করবেন না।
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

      <div className="grid gap-2">
        {channels?.map((c: any) => (
          <Card key={c.id}>
            <CardContent className="pt-3 pb-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium text-sm truncate">{c.channel_name}</div>
                <a href={c.channel_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                  {c.channel_url} <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <Button size="icon" variant="ghost" onClick={() => del.mutate(c.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
