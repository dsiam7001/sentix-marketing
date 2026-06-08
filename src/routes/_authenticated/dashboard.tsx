import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { generateDailyStrategy } from "@/lib/ai.functions";
import { toast } from "sonner";
import {
  Sparkles,
  Lightbulb,
  FileText,
  TrendingUp,
  Coffee,
  AlertTriangle,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function Dashboard() {
  const qc = useQueryClient();
  const today = todayStr();

  const { data: pulse, refetch: refetchPulse } = useQuery({
    queryKey: ["pulse", today],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase
        .from("daily_pulse")
        .select("*")
        .eq("user_id", u.user.id)
        .eq("pulse_date", today)
        .maybeSingle();
      return data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["dash-stats"],
    queryFn: async () => {
      const [ideas, scripts, videos, hooks] = await Promise.all([
        supabase.from("content_ideas").select("id, status", { count: "exact", head: false }),
        supabase.from("scripts").select("id", { count: "exact", head: true }),
        supabase.from("videos_published").select("id", { count: "exact", head: true }),
        supabase.from("hooks_library").select("id", { count: "exact", head: true }),
      ]);
      const pending = (ideas.data ?? []).filter((i: any) => i.status === "pending").length;
      return {
        ideasTotal: ideas.count ?? 0,
        ideasPending: pending,
        scripts: scripts.count ?? 0,
        videos: videos.count ?? 0,
        hooks: hooks.count ?? 0,
      };
    },
  });

  const { data: recentJobs } = useQuery({
    queryKey: ["recent-render-jobs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("render_jobs")
        .select("id, status, video_url, telegram_message_id, telegram_delivered_at, error, started_at, finished_at, scripts(title)")
        .order("started_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
    refetchInterval: 5000,
  });

  const { data: recentVideos } = useQuery({
    queryKey: ["recent-videos"],
    queryFn: async () => {
      const { data } = await supabase
        .from("videos_published")
        .select("*")
        .order("published_at", { ascending: false })
        .limit(3);
      return data ?? [];
    },
  });

  const burnout = (recentVideos?.length ?? 0) >= 3; // simple heuristic

  const [telegram, setTelegram] = useState("");
  const [competitor, setCompetitor] = useState("");
  const [market, setMarket] = useState("");

  useEffect(() => {
    if (pulse) {
      setTelegram(pulse.telegram_trends ?? "");
      setCompetitor(pulse.competitor_viral ?? "");
      setMarket(pulse.market_event ?? "");
    }
  }, [pulse]);

  const savePulse = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const row = {
        user_id: u.user.id,
        pulse_date: today,
        telegram_trends: telegram,
        competitor_viral: competitor,
        market_event: market,
      };
      if (pulse) {
        const { error } = await supabase.from("daily_pulse").update(row).eq("id", pulse.id);
        if (error) throw error;
        return pulse.id;
      }
      const { data, error } = await supabase.from("daily_pulse").insert(row).select().single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => {
      toast.success("Daily Pulse saved");
      refetchPulse();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const genStrategyFn = useServerFn(generateDailyStrategy);
  const genStrategy = useMutation({
    mutationFn: async () => {
      let id = pulse?.id;
      if (!id) id = await savePulse.mutateAsync();
      return genStrategyFn({ data: { pulseId: id! } });
    },
    onSuccess: () => {
      toast.success("AI strategy generated");
      refetchPulse();
      qc.invalidateQueries({ queryKey: ["pulse"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gradient">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          আজকের content pipeline + Daily Pulse
        </p>
      </div>

      {burnout && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="pt-4 flex gap-3 items-start">
            <Coffee className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-sm">Calm Mode suggestion</div>
              <p className="text-xs text-muted-foreground mt-0.5">
                সাম্প্রতিক সময়ে অনেকগুলো video publish হয়েছে। আজ rest নিন বা generic post-ও OK।
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Ideas" value={stats?.ideasTotal ?? 0} sub={`${stats?.ideasPending ?? 0} pending`} icon={Lightbulb} />
        <StatCard label="Scripts" value={stats?.scripts ?? 0} sub="generated" icon={FileText} />
        <StatCard label="Published" value={stats?.videos ?? 0} sub="videos" icon={TrendingUp} />
        <StatCard label="Hooks" value={50} sub="seeds + custom" icon={Sparkles} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daily Pulse — ২ মিনিট</CardTitle>
          <CardDescription>
            আজকের real intelligence — সকালে এই ৩টা ঘরে input দিন, AI দিনের strategy লিখবে।
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <PulseField label="আজ YouTube / Facebook / Instagram / TikTok-এ কী trending? (অথবা যেকোনো topic)" value={telegram} onChange={setTelegram} placeholder="যেমন: 'GBPJPY VIP signal', 'OTC weekend trap', 'candlestick pattern explained' — যেকোনো বিষয় লিখুন" />
          <PulseField label="Competitor কেউ viral হয়েছে?" value={competitor} onChange={setCompetitor} placeholder="URL paste বা ১ লাইনে describe করুন" />
          <PulseField label="আজ market-এ বিশেষ কিছু?" value={market} onChange={setMarket} placeholder="NFP, Eid, USD news, crypto crash..." />

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => savePulse.mutate()} disabled={savePulse.isPending} variant="outline">
              Save
            </Button>
            <Button
              onClick={() => genStrategy.mutate()}
              disabled={genStrategy.isPending}
              className="bg-gradient-primary"
            >
              {genStrategy.isPending ? "Generating…" : "Generate AI strategy"}
            </Button>
            <Button asChild variant="ghost">
              <Link to="/ideas">→ Idea Lab</Link>
            </Button>
          </div>

          {pulse?.ai_strategy && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
              <div className="text-xs uppercase text-primary mb-2">AI Strategy</div>
              <div className="text-sm whitespace-pre-wrap">{pulse.ai_strategy}</div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-warning" />
            বাস্তবতা
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>• Virality score = AI confidence, viral guarantee না। আসল data Performance Tracker-এ input করুন।</p>
          <p>• Sentix AI assistant — আপনি strategist। প্রতিটা script approve করুন editing-এর আগে।</p>
          <p>• Mental health &gt; content quantity। Burnout হলে rest নিন।</p>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, sub, icon: Icon }: any) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="text-xs text-muted-foreground mt-1">{sub}</div>
      </CardContent>
    </Card>
  );
}

function PulseField({ label, value, onChange, placeholder }: any) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      <Textarea
        value={value}
        onChange={(e: any) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={2}
      />
    </div>
  );
}
