import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { generateIdeas, generateScript } from "@/lib/ai.functions";
import { runDualAILoop } from "@/lib/dual-ai.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Sparkles, Zap, Heart, Brain, BookOpen, Bot } from "lucide-react";

export const Route = createFileRoute("/_authenticated/ideas")({
  component: IdeasPage,
});

function IdeasPage() {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: ideas, isLoading } = useQuery({
    queryKey: ["ideas", today],
    queryFn: async () => {
      const { data } = await supabase
        .from("content_ideas")
        .select("*")
        .eq("for_date", today)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: pulse } = useQuery({
    queryKey: ["pulse", today],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data } = await supabase
        .from("daily_pulse")
        .select("id")
        .eq("user_id", u.user!.id)
        .eq("pulse_date", today)
        .maybeSingle();
      return data;
    },
  });

  const genFn = useServerFn(generateIdeas);
  const gen = useMutation({
    mutationFn: () => genFn({ data: { pulseId: pulse?.id, count: 5 } }),
    onSuccess: () => {
      toast.success("নতুন ideas generated");
      qc.invalidateQueries({ queryKey: ["ideas"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const scriptFn = useServerFn(generateScript);
  const makeScript = useMutation({
    mutationFn: (v: { ideaId: string; variantIndex: number }) => scriptFn({ data: v }),
    onSuccess: (data) => {
      toast.success("Script created");
      qc.invalidateQueries({ queryKey: ["ideas"] });
      window.location.href = `/scripts/${(data as any).script.id}`;
    },
    onError: (e: any) => toast.error(e.message),
  });

  const dualFn = useServerFn(runDualAILoop);
  const makeDual = useMutation({
    mutationFn: (v: { ideaId: string; variantIndex: number }) => dualFn({ data: v }),
    onSuccess: (data: any) => {
      const status = data?.status ?? "done";
      const score = data?.score ?? 0;
      toast.success(`Dual-AI ${status} (score ${score?.toFixed?.(1) ?? score})`);
      qc.invalidateQueries({ queryKey: ["ideas"] });
      if (data?.scriptId) window.location.href = `/scripts/${data.scriptId}`;
    },
    onError: (e: any) => toast.error(e.message),
  });

  const reject = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("content_ideas").update({ status: "rejected" }).eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ideas"] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("content_ideas").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["ideas"] }); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-gradient">Idea Lab</h1>
          <p className="text-muted-foreground text-sm mt-1">
            আজকের ideas — প্রতিটার ৩টা angle (emotional / logic / story)
          </p>
        </div>
        <Button
          onClick={() => gen.mutate()}
          disabled={gen.isPending}
          className="bg-gradient-primary shadow-glow"
        >
          <Sparkles className="h-4 w-4" />
          {gen.isPending ? "Generating…" : "Generate 5 ideas"}
        </Button>
      </div>

      {!pulse && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="pt-4 text-sm">
            টিপ: আগে <Link to="/dashboard" className="text-primary underline">Daily Pulse</Link> input দিন — তাহলে AI আজকের context-ভিত্তিক ideas দিবে।
          </CardContent>
        </Card>
      )}

      {isLoading && <div className="text-muted-foreground">Loading…</div>}

      {ideas?.length === 0 && !isLoading && (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground text-sm">
            এখনো কোনো idea নেই। "Generate 5 ideas" click করুন।
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {ideas?.map((idea: any) => (
          <Card key={idea.id} className={idea.status === "rejected" ? "opacity-50" : ""}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="space-y-1">
                  <CardTitle className="text-lg">{idea.topic}</CardTitle>
                  <CardDescription className="flex gap-2 flex-wrap items-center">
                    <Badge variant="outline">{idea.time_slot}</Badge>
                    <Badge variant="secondary">{idea.theme}</Badge>
                    {idea.virality_score && (
                      <Badge className="bg-primary/20 text-primary border-primary/30">
                        AI confidence {idea.virality_score}
                      </Badge>
                    )}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Pain:</span> {idea.pain_point}
              </div>
              <div className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Rationale:</span> {idea.rationale}
              </div>

              <div className="grid md:grid-cols-3 gap-3">
                {(idea.variants as any[]).map((v: any, i: number) => (
                  <div
                    key={i}
                    className="rounded-lg border border-border p-3 space-y-2 hover:border-primary/40 transition-colors"
                  >
                    <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide">
                      {v.angle === "emotional" && <Heart className="h-3 w-3 text-accent" />}
                      {v.angle === "logic" && <Brain className="h-3 w-3 text-primary" />}
                      {v.angle === "story" && <BookOpen className="h-3 w-3 text-warning" />}
                      <span className="text-muted-foreground">{v.angle}</span>
                    </div>
                    <div className="font-medium text-sm">{v.hook}</div>
                    <div className="text-xs text-muted-foreground">{v.summary}</div>
                    <div className="space-y-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => makeScript.mutate({ ideaId: idea.id, variantIndex: i })}
                        disabled={makeScript.isPending || makeDual.isPending || idea.status === "rejected"}
                      >
                        <Zap className="h-3 w-3" /> Single-shot
                      </Button>
                      <Button
                        size="sm"
                        className="w-full bg-gradient-primary"
                        onClick={() => makeDual.mutate({ ideaId: idea.id, variantIndex: i })}
                        disabled={makeScript.isPending || makeDual.isPending || idea.status === "rejected"}
                      >
                        <Bot className="h-3 w-3" /> Dual-AI (9/10)
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {idea.status !== "rejected" && (
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => reject.mutate(idea.id)}>
                    Reject
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
