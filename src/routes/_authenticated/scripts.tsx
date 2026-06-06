import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { softDelete, restore, hardDelete, setScriptStatus } from "@/lib/admin-actions.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Trash2, RotateCcw, XCircle, CheckCircle } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/scripts")({ component: ScriptsList });

type Filter = "all" | "approved" | "needs_review" | "rejected" | "trash";

function ScriptsList() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: scripts } = useQuery({
    queryKey: ["scripts", filter],
    queryFn: async () => {
      let q = supabase.from("scripts").select("*").order("created_at", { ascending: false });
      if (filter === "trash") q = q.not("deleted_at", "is", null);
      else {
        q = q.is("deleted_at", null);
        if (filter !== "all") q = q.eq("status", filter);
      }
      const { data } = await q;
      return data ?? [];
    },
  });

  const toggle = (id: string) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };
  const clearSel = () => setSelected(new Set());

  const sdFn = useServerFn(softDelete);
  const rsFn = useServerFn(restore);
  const hdFn = useServerFn(hardDelete);
  const stFn = useServerFn(setScriptStatus);
  const onSuccess = (msg: string) => {
    toast.success(msg); clearSel(); qc.invalidateQueries({ queryKey: ["scripts"] });
  };
  const ids = Array.from(selected);
  const bulkDelete = useMutation({ mutationFn: () => sdFn({ data: { entity: "scripts", ids } }), onSuccess: () => onSuccess(`${ids.length} deleted`) });
  const bulkRestore = useMutation({ mutationFn: () => rsFn({ data: { entity: "scripts", ids } }), onSuccess: () => onSuccess(`${ids.length} restored`) });
  const bulkHardDelete = useMutation({ mutationFn: () => hdFn({ data: { entity: "scripts", ids } }), onSuccess: () => onSuccess(`${ids.length} permanently deleted`) });
  const bulkReject = useMutation({ mutationFn: () => stFn({ data: { ids, status: "rejected" } }), onSuccess: () => onSuccess(`${ids.length} rejected`) });
  const bulkApprove = useMutation({ mutationFn: () => stFn({ data: { ids, status: "approved" } }), onSuccess: () => onSuccess(`${ids.length} approved`) });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-gradient">Script Studio</h1>
          <p className="text-muted-foreground text-sm mt-1">{scripts?.length ?? 0} scripts</p>
        </div>
        <div className="flex gap-1 flex-wrap">
          {(["all", "approved", "needs_review", "rejected", "trash"] as Filter[]).map((f) => (
            <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => { setFilter(f); clearSel(); }}>
              {f}
            </Button>
          ))}
        </div>
      </div>

      {selected.size > 0 && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="pt-4 flex items-center gap-2 flex-wrap text-sm">
            <span>{selected.size} selected</span>
            <Button size="sm" variant="outline" onClick={() => bulkApprove.mutate()}><CheckCircle className="h-3.5 w-3.5" /> Approve</Button>
            <Button size="sm" variant="outline" onClick={() => bulkReject.mutate()}><XCircle className="h-3.5 w-3.5" /> Reject</Button>
            {filter === "trash" ? (
              <>
                <Button size="sm" variant="outline" onClick={() => bulkRestore.mutate()}><RotateCcw className="h-3.5 w-3.5" /> Restore</Button>
                <Button size="sm" variant="destructive" onClick={() => bulkHardDelete.mutate()}><Trash2 className="h-3.5 w-3.5" /> Delete forever</Button>
              </>
            ) : (
              <Button size="sm" variant="destructive" onClick={() => bulkDelete.mutate()}><Trash2 className="h-3.5 w-3.5" /> Move to Trash</Button>
            )}
            <Button size="sm" variant="ghost" onClick={clearSel}>Clear</Button>
          </CardContent>
        </Card>
      )}

      {scripts?.length === 0 && (
        <Card><CardContent className="pt-6 text-sm text-muted-foreground text-center">কোনো script নেই।</CardContent></Card>
      )}

      <div className="grid gap-3">
        {scripts?.map((s: any) => (
          <Card key={s.id} className="hover:border-primary/40 transition-colors">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <Checkbox checked={selected.has(s.id)} onCheckedChange={() => toggle(s.id)} className="mt-1" />
                <Link to="/scripts/$id" params={{ id: s.id }} className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="space-y-1 min-w-0">
                      <div className="font-medium truncate">{s.title}</div>
                      <div className="text-xs text-muted-foreground line-clamp-1">{s.hook}</div>
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {s.polished && <Badge variant="outline">polished</Badge>}
                      {s.virality_score && <Badge className="bg-primary/20 text-primary border-primary/30">{s.virality_score}</Badge>}
                      <Badge variant="secondary">{s.status}</Badge>
                      {s.render_status && s.render_status !== "idle" && <Badge variant="outline">{s.render_status}</Badge>}
                    </div>
                  </div>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
