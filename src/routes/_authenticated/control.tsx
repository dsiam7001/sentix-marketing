import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getRecentRenders } from "@/lib/render.functions";
import { runSystemDoctor, recentDiagnostics } from "@/lib/system-doctor.functions";
import { recentGuardReports } from "@/lib/guardrails.functions";
import { recentPipelineRuns } from "@/lib/autopilot.functions";
import { executeMastermind, ensureGithubReady } from "@/lib/mastermind.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Activity,
  Battery,
  Bot,
  CircleCheck,
  CircleAlert,
  Clock,
  Film,
  Gauge,
  Image as ImageIcon,
  ShieldCheck,
  Stethoscope,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/control")({
  component: ControlPage,
});

function ControlPage() {
  const { data: pipeline } = useQuery({
    queryKey: ["ctrl-pipeline"],
    queryFn: async () => {
      const [ideas, scripts, renders] = await Promise.all([
        supabase.from("content_ideas").select("status", { count: "exact", head: false }),
        supabase.from("scripts").select("status, render_status, final_score, virality_score, created_at"),
        supabase.from("render_jobs").select("status"),
      ]);
      const s = scripts.data ?? [];
      return {
        ideasTotal: ideas.count ?? 0,
        ideasPending: (ideas.data ?? []).filter((i: any) => i.status === "pending").length,
        scriptsApproved: s.filter((x: any) => x.status === "approved").length,
        scriptsNeedsReview: s.filter((x: any) => x.status === "needs_review").length,
        scriptsRejected: s.filter((x: any) => x.status === "rejected").length,
        renderingNow: (renders.data ?? []).filter((r: any) => ["queued", "dispatched", "running"].includes(r.status)).length,
        renderedTotal: (renders.data ?? []).filter((r: any) => r.status === "succeeded").length,
        failedTotal: (renders.data ?? []).filter((r: any) => r.status === "failed").length,
        recentScores: s
          .filter((x: any) => x.final_score != null)
          .slice(-20)
          .map((x: any) => Number(x.final_score)),
      };
    },
    refetchInterval: 5000,
  });

  const { data: keys } = useQuery({
    queryKey: ["ctrl-keys"],
    queryFn: async () => {
      const { data } = await supabase
        .from("gemini_keys")
        .select("id, label, active, cooldown_until, daily_calls, total_calls, last_429_at, failure_count")
        .order("created_at", { ascending: true });
      return data ?? [];
    },
    refetchInterval: 5000,
  });

  const { data: runs } = useQuery({
    queryKey: ["ctrl-runs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("dual_ai_runs")
        .select("id, iteration, role, score, final_status, created_at, scripts(title)")
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
    refetchInterval: 5000,
  });

  const rendersFn = useServerFn(getRecentRenders);
  const { data: rendersData } = useQuery({
    queryKey: ["ctrl-renders"],
    queryFn: () => rendersFn(),
    refetchInterval: 5000,
  });
  const renderJobs = (rendersData as any)?.jobs ?? [];

  const { data: cache } = useQuery({
    queryKey: ["ctrl-cache"],
    queryFn: async () => {
      const { data } = await supabase.from("asset_cache").select("source, used_count");
      const rows = data ?? [];
      return {
        total: rows.length,
        bySource: rows.reduce((acc: any, r: any) => {
          acc[r.source] = (acc[r.source] ?? 0) + 1;
          return acc;
        }, {}),
        hitRate: rows.length ? Math.round((rows.filter((r: any) => r.used_count > 0).length / rows.length) * 100) : 0,
      };
    },
    refetchInterval: 10000,
  });

  const { data: videos } = useQuery({
    queryKey: ["ctrl-videos"],
    queryFn: async () => {
      const { data } = await supabase
        .from("videos_published")
        .select("views_24h, scripts(virality_score)")
        .order("published_at", { ascending: false })
        .limit(15);
      return data ?? [];
    },
  });

  const calibration = (() => {
    if (!videos || videos.length === 0) return null;
    const pairs = videos
      .map((v: any) => ({ pred: v.scripts?.virality_score ?? 0, actual: v.views_24h ?? 0 }))
      .filter((p: any) => p.pred > 0 && p.actual > 0);
    if (pairs.length === 0) return null;
    const maxAct = Math.max(...pairs.map((p) => p.actual));
    const delta = pairs.reduce((s, p) => s + (p.pred - (p.actual / maxAct) * 100), 0) / pairs.length;
    return Math.round(delta);
  })();

  const renderInProgress = renderJobs.filter((j: any) => ["queued", "dispatched", "running"].includes(j.status)).length;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gradient flex items-center gap-2">
            <Activity className="h-7 w-7 text-primary" />
            Quantum Mission Control
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Live HUD · auto-refresh প্রতি ৫ সেকেন্ডে · যা actually measure করা সম্ভব
          </p>
        </div>
        <Badge className="bg-success/20 text-success border-success/30">$0.00 / mo</Badge>
      </div>

      <MastermindCard />


      {/* Pipeline funnel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Today's Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
            <Stat label="Ideas pending" value={pipeline?.ideasPending ?? 0} />
            <Stat label="Approved" value={pipeline?.scriptsApproved ?? 0} variant="success" />
            <Stat label="Needs review" value={pipeline?.scriptsNeedsReview ?? 0} variant="warning" />
            <Stat label="Rendering" value={pipeline?.renderingNow ?? 0} variant="primary" />
            <Stat label="Rendered" value={pipeline?.renderedTotal ?? 0} variant="success" />
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Gemini key pool */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Battery className="h-4 w-4 text-primary" />
              Gemini Key Pool {keys?.length ? `(${keys.length})` : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {!keys || keys.length === 0 ? (
              <p className="text-muted-foreground text-xs">
                কোনো key add করা নাই — Lovable AI Gateway fallback ব্যবহার হচ্ছে। Settings থেকে personal keys add করুন।
              </p>
            ) : (
              keys.map((k: any) => {
                const onCooldown = k.cooldown_until && new Date(k.cooldown_until) > new Date();
                const dailyPct = Math.min(100, ((k.daily_calls ?? 0) / 1500) * 100);
                return (
                  <div key={k.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            !k.active ? "bg-muted" : onCooldown ? "bg-warning" : "bg-success"
                          }`}
                        />
                        {k.label}
                      </span>
                      <span className="text-muted-foreground">
                        {k.daily_calls ?? 0} / 1500
                        {onCooldown && " · cooldown"}
                      </span>
                    </div>
                    <Progress value={dailyPct} className="h-1" />
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Cost tracker */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              Cost Tracker (vs paid stack)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1.5">
            <Row k="Sentix actual" v="$0.00" highlight />
            <Row k="ElevenLabs equivalent" v="~$99/mo saved" />
            <Row k="Runway Gen-2 equivalent" v="~$95/mo saved" />
            <Row k="GPT-5 calls equivalent" v="~$150/mo saved" />
            <Row k="GitHub Actions used" v={`${renderJobs.length * 3}/2000 min`} />
          </CardContent>
        </Card>

        {/* Dual-AI dialog stream */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              Dual-AI Dialog Stream
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1.5">
            {!runs || runs.length === 0 ? (
              <p className="text-muted-foreground text-xs">কোনো run নেই এখনো।</p>
            ) : (
              runs.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between text-xs">
                  <span className="truncate flex-1">
                    <span className={r.role === "critic" ? "text-accent" : "text-primary"}>{r.role}</span>
                    {" · iter "}
                    {r.iteration} · {r.scripts?.title?.slice(0, 30) ?? "—"}
                  </span>
                  {r.score != null && (
                    <Badge variant="outline" className="text-[10px]">
                      {Number(r.score).toFixed(1)}
                    </Badge>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Render queue */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Film className="h-4 w-4 text-primary" />
              Render Queue ({renderInProgress} active)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1.5">
            {renderJobs.length === 0 ? (
              <p className="text-muted-foreground text-xs">কোনো render job নেই।</p>
            ) : (
              renderJobs.slice(0, 8).map((j: any) => (
                <div key={j.id} className="flex items-center justify-between text-xs">
                  <span className="truncate flex-1">{j.scripts?.title ?? "—"}</span>
                  <Badge
                    variant="outline"
                    className={
                      j.status === "succeeded"
                        ? "bg-success/10 text-success border-success/30"
                        : j.status === "failed"
                        ? "bg-destructive/10 text-destructive border-destructive/30"
                        : "bg-primary/10 text-primary border-primary/30"
                    }
                  >
                    {j.status}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Asset cache */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-primary" />
              Asset Cache
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1.5">
            <Row k="Total cached" v={cache?.total ?? 0} />
            <Row k="Hit rate" v={`${cache?.hitRate ?? 0}%`} />
            {cache?.bySource &&
              Object.entries(cache.bySource).map(([k, v]) => (
                <Row key={k} k={k} v={String(v)} />
              ))}
          </CardContent>
        </Card>

        {/* Virality calibration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Gauge className="h-4 w-4 text-primary" />
              Virality Calibration
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1.5">
            {calibration == null ? (
              <p className="text-muted-foreground text-xs">
                আরো performance data দরকার (Performance Tracker-এ views log করুন)।
              </p>
            ) : (
              <>
                <Row
                  k="Avg AI bias"
                  v={`${calibration > 0 ? "+" : ""}${calibration} pts`}
                />
                <p className="text-[11px] text-muted-foreground">
                  Positive = AI over-confident; Negative = AI under-rating। Calibration over weeks improves।
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Score trend mini chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Recent Dual-AI Scores
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!pipeline?.recentScores?.length ? (
              <p className="text-muted-foreground text-xs">No data</p>
            ) : (
              <div className="flex items-end gap-1 h-20">
                {pipeline.recentScores.map((s, i) => (
                  <div
                    key={i}
                    className={`flex-1 rounded-t ${s >= 9 ? "bg-success" : s >= 7.5 ? "bg-warning" : "bg-destructive"}`}
                    style={{ height: `${(s / 10) * 100}%` }}
                    title={`${s.toFixed(1)}`}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Manual review queue */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CircleAlert className="h-4 w-4 text-warning" />
              Needs Review ({pipeline?.scriptsNeedsReview ?? 0})
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Critic score 7.5-9 — manual approve/edit করুন Script Studio-তে।
          </CardContent>
        </Card>
      </div>

      <SystemDoctorCard />
      <GuardLabCard />
      <PipelineRunsCard />

      {/* Phase 4 placeholder */}
      <Card className="border-muted/30 bg-muted/5">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            Phase 4 (paid platform APIs required)
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground grid grid-cols-2 md:grid-cols-4 gap-2">
          <span>· Shadowban Radar</span>
          <span>· Audience Retention Heatmap</span>
          <span>· Future View Predictor (30d)</span>
          <span>· Engagement Velocity</span>
          <span>· Trust Score AI</span>
          <span>· Platform Sentiment Map</span>
          <span>· Global Trend Overlay</span>
          <span>· Algorithm Health</span>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, variant }: { label: string; value: number; variant?: string }) {
  const colors: Record<string, string> = {
    success: "text-success",
    warning: "text-warning",
    primary: "text-primary",
    destructive: "text-destructive",
  };
  return (
    <div className="rounded-lg border border-border p-3">
      <div className={`text-2xl font-bold ${variant ? colors[variant] : ""}`}>{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

function Row({ k, v, highlight }: { k: string; v: any; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center text-xs">
      <span className="text-muted-foreground">{k}</span>
      <span className={highlight ? "text-success font-medium" : ""}>{v}</span>
    </div>
  );
}

function SystemDoctorCard() {
  const qc = useQueryClient();
  const docFn = useServerFn(runSystemDoctor);
  const histFn = useServerFn(recentDiagnostics);
  const { data: hist } = useQuery({ queryKey: ["doc-hist"], queryFn: () => histFn() });
  const last = (hist as any)?.runs?.[0];

  const run = useMutation({
    mutationFn: (mode: "short" | "full") => docFn({ data: { mode } }),
    onSuccess: (r: any) => {
      const s = r.summary;
      toast.success(`Doctor: ${s.ok}/${s.total} ok · ${s.fail} fail · ${s.warn} warn · ${s.skip} skip`);
      qc.invalidateQueries({ queryKey: ["doc-hist"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
          <span className="flex items-center gap-2"><Stethoscope className="h-4 w-4 text-primary" /> System Doctor</span>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => run.mutate("short")} disabled={run.isPending}>
              {run.isPending ? "Running…" : "Run diagnostic"}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {!last ? (
          <p className="text-xs text-muted-foreground">এখনো diagnostic চালানো হয়নি — Telegram pingসহ live test করুন।</p>
        ) : (
          <>
            <div className="text-xs text-muted-foreground">
              Last run: {new Date(last.started_at).toLocaleString()} · ok {last.summary?.ok ?? 0} / fail {last.summary?.fail ?? 0} / warn {last.summary?.warn ?? 0} / skip {last.summary?.skip ?? 0}
            </div>
            <div className="space-y-1">
              {(last.steps as any[])?.map((s) => (
                <div key={s.id} className="flex items-center justify-between text-xs gap-2">
                  <span className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span className={`h-2 w-2 rounded-full shrink-0 ${
                      s.status === "ok" ? "bg-success" :
                      s.status === "fail" ? "bg-destructive" :
                      s.status === "warn" ? "bg-warning" : "bg-muted"
                    }`} />
                    <span className="truncate">{s.label}</span>
                  </span>
                  <span className="text-muted-foreground truncate max-w-[40%]">{typeof s.proof === "string" ? s.proof : JSON.stringify(s.proof)?.slice(0, 60)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function GuardLabCard() {
  const fn = useServerFn(recentGuardReports);
  const { data } = useQuery({ queryKey: ["guard-reports"], queryFn: () => fn(), refetchInterval: 15000 });
  const reports = (data as any)?.reports ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Guard Lab (last 20)</CardTitle>
      </CardHeader>
      <CardContent className="text-sm space-y-1.5">
        {reports.length === 0 ? (
          <p className="text-xs text-muted-foreground">কোনো guardrail report নেই। (AudD/Sightengine/AssemblyAI keys add করলে auto run হবে)</p>
        ) : reports.map((r: any) => (
          <div key={r.id} className="flex items-center justify-between text-xs gap-2">
            <span className="truncate flex-1">{r.scripts?.title ?? "—"}</span>
            <Badge variant="outline" className={
              r.verdict === "clear" ? "bg-success/10 text-success border-success/30" :
              r.verdict === "warn" ? "bg-warning/10 text-warning border-warning/30" :
              "bg-destructive/10 text-destructive border-destructive/30"
            }>{r.verdict}</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function PipelineRunsCard() {
  const fn = useServerFn(recentPipelineRuns);
  const { data } = useQuery({ queryKey: ["pipeline-runs"], queryFn: () => fn(), refetchInterval: 10000 });
  const runs = (data as any)?.runs ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /> Autopilot Timeline (last 50)</CardTitle>
      </CardHeader>
      <CardContent className="text-xs space-y-1 max-h-72 overflow-auto">
        {runs.length === 0 ? (
          <p className="text-muted-foreground">কোনো autopilot run নেই। <Link to="/settings" className="text-primary underline">Settings</Link> থেকে enable করুন।</p>
        ) : runs.map((r: any) => (
          <div key={r.id} className="flex items-center gap-2">
            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${
              r.status === "ok" ? "bg-success" :
              r.status === "failed" ? "bg-destructive" :
              r.status === "warn" ? "bg-warning" : "bg-muted"
            }`} />
            <span className="text-muted-foreground tabular-nums">{new Date(r.created_at).toLocaleTimeString()}</span>
            <span className="font-mono">{r.slot ?? "—"}</span>
            <span className="font-medium">{r.stage}</span>
            <span className="text-muted-foreground truncate flex-1">{r.message}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
