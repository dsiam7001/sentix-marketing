import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/hooks")({
  component: HooksPage,
});

function HooksPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [newHook, setNewHook] = useState("");

  const { data: hooks } = useQuery({
    queryKey: ["hooks"],
    queryFn: async () => {
      const { data } = await supabase.from("hooks_library").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const filtered = hooks?.filter((h: any) =>
    h.hook_text.toLowerCase().includes(search.toLowerCase()),
  );

  const add = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("hooks_library").insert({
        user_id: u.user!.id,
        hook_text: newHook,
        is_seed: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewHook("");
      toast.success("Added");
      qc.invalidateQueries({ queryKey: ["hooks"] });
    },
  });

  const toggleFav = useMutation({
    mutationFn: async ({ id, favorite }: any) => {
      await supabase.from("hooks_library").update({ favorite: !favorite }).eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hooks"] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("hooks_library").delete().eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hooks"] }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gradient">Hook Library</h1>
        <p className="text-muted-foreground text-sm mt-1">
          ৫০+ pre-loaded Bengali hooks + আপনার custom hooks
        </p>
      </div>

      <Card>
        <CardContent className="pt-4 space-y-3">
          <Input placeholder="Search hooks…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="flex gap-2">
            <Input placeholder="নতুন hook লিখুন…" value={newHook} onChange={(e) => setNewHook(e.target.value)} />
            <Button onClick={() => add.mutate()} disabled={!newHook || add.isPending}>
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-2">
        {filtered?.map((h: any) => (
          <Card key={h.id} className="hover:border-primary/30">
            <CardContent className="pt-3 pb-3 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm">{h.hook_text}</div>
                <div className="flex gap-1.5 mt-1 flex-wrap">
                  {h.category && <Badge variant="outline" className="text-xs">{h.category}</Badge>}
                  {h.emotion && <Badge variant="secondary" className="text-xs">{h.emotion}</Badge>}
                  {h.is_seed && <Badge variant="outline" className="text-xs">seed</Badge>}
                </div>
              </div>
              <Button size="icon" variant="ghost" onClick={() => toggleFav.mutate({ id: h.id, favorite: h.favorite })}>
                <Star className={h.favorite ? "h-4 w-4 fill-warning text-warning" : "h-4 w-4"} />
              </Button>
              {!h.is_seed && (
                <Button size="icon" variant="ghost" onClick={() => del.mutate(h.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
