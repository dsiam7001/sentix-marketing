import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/scripts")({
  component: ScriptsList,
});

function ScriptsList() {
  const { data: scripts } = useQuery({
    queryKey: ["scripts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("scripts")
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gradient">Script Studio</h1>
        <p className="text-muted-foreground text-sm mt-1">Generated scripts — click to open</p>
      </div>

      {scripts?.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground text-center">
            এখনো কোনো script নেই। <Link to="/ideas" className="text-primary underline">Idea Lab</Link> থেকে script generate করুন।
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {scripts?.map((s: any) => (
          <Link key={s.id} to="/scripts/$id" params={{ id: s.id }}>
            <Card className="hover:border-primary/40 transition-colors">
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-1">
                    <div className="font-medium">{s.title}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">{s.hook}</div>
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {s.polished && <Badge variant="outline">polished</Badge>}
                    {s.virality_score && (
                      <Badge className="bg-primary/20 text-primary border-primary/30">
                        {s.virality_score}
                      </Badge>
                    )}
                    <Badge variant="secondary">{s.status}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
