import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { listIntegrations, saveSecret, deleteSecret, testIntegration } from "@/lib/integrations.functions";
import { getAutopilotSettings, updateAutopilotSettings, runAutopilotForUser } from "@/lib/autopilot.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useState } from "react";
import { Trash2, CircleCheck, CircleAlert, Play, KeyRound, Save, Zap } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({ component: SettingsPage });

function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gradient">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Autopilot · Integrations Hub · Style Memory · Sentix features · Gemini key pool
        </p>
      </div>
      <AutopilotSection />
      <IntegrationsHub />
      <StyleMemorySection />
      <SentixFeaturesSection />
      <GeminiKeysSection />
    </div>
  );
}

function AutopilotSection() {
  const qc = useQueryClient();
  const getFn = useServerFn(getAutopilotSettings);
  const updFn = useServerFn(updateAutopilotSettings);
  const runFn = useServerFn(runAutopilotForUser);
  const { data } = useQuery({ queryKey: ["autopilot"], queryFn: () => getFn() });
  const s: any = (data as any)?.settings ?? {};

  const upd = useMutation({
    mutationFn: (patch: any) => updFn({ data: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["autopilot"] }),
  });
  const runNow = useMutation({
    mutationFn: () => runFn(),
    onSuccess: (r: any) => {
      toast.success(r?.skipped ? `Skipped: ${r.reason}` : `Tick: ${r?.status ?? "done"}`);
      qc.invalidateQueries({ queryKey: ["autopilot"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /> Autopilot</CardTitle>
        <CardDescription>
          সকাল/দুপুর/বিকাল/রাত slot অনুযায়ী automatic ideas → Dual-AI → render → Telegram। সব toggle off হলে manual mode।
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <ToggleRow label="Master switch" desc="Off হলে কিচ্ছু auto হবে না" value={!!s.enabled} onChange={(v) => upd.mutate({ enabled: v })} />
        <ToggleRow label="Auto-approve (Dual-AI ≥ 7.5)" desc="9/10 না পেলেও approve করবে যদি 7.5+" value={!!s.auto_approve} onChange={(v) => upd.mutate({ auto_approve: v })} />
        <ToggleRow label="Auto-render via GitHub" desc="Approved হলে নিজে render trigger করবে" value={!!s.auto_render} onChange={(v) => upd.mutate({ auto_render: v })} />
        <ToggleRow label="Auto-deliver to Telegram" desc="Render success হলে Telegram-এ পাঠাবে" value={!!s.auto_publish_telegram} onChange={(v) => upd.mutate({ auto_publish_telegram: v })} />
        <div className="flex items-center justify-between gap-3 text-sm">
          <div>Daily quota <span className="text-muted-foreground text-xs">(0 = unlimited)</span></div>
          <Input
            type="number" min={0} max={50} className="w-24"
            defaultValue={s.daily_quota ?? 4}
            onBlur={(e) => upd.mutate({ daily_quota: Number(e.target.value) })}
          />
        </div>
        <div className="flex gap-2 pt-2 flex-wrap">
          <Button size="sm" onClick={() => runNow.mutate()} disabled={runNow.isPending}>
            <Play className="h-4 w-4" /> {runNow.isPending ? "Running…" : "Run tick now"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => upd.mutate({ paused_until: new Date(Date.now() + 6 * 3600 * 1000).toISOString() })}>
            Pause 6 hrs
          </Button>
          {s.paused_until && new Date(s.paused_until) > new Date() && (
            <Button size="sm" variant="ghost" onClick={() => upd.mutate({ paused_until: null })}>Resume</Button>
          )}
        </div>
        {s.slot_config && (
          <div className="pt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
            {(s.slot_config as any[]).map((slot: any) => (
              <div key={slot.slot} className="rounded-md border border-border p-2 text-xs">
                <div className="font-medium capitalize">{slot.slot}</div>
                <div className="text-muted-foreground">{slot.hour}:00 · {slot.tone}</div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ToggleRow({ label, desc, value, onChange }: { label: string; desc?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {desc && <div className="text-xs text-muted-foreground">{desc}</div>}
      </div>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );
}

function IntegrationsHub() {
  const qc = useQueryClient();
  const listFn = useServerFn(listIntegrations);
  const saveFn = useServerFn(saveSecret);
  const delFn = useServerFn(deleteSecret);
  const testFn = useServerFn(testIntegration);
  const { data } = useQuery({ queryKey: ["integrations"], queryFn: () => listFn() });
  const slots = (data as any)?.slots ?? [];

  const [vals, setVals] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: ({ name, value }: { name: string; value: string }) => saveFn({ data: { name, value } }),
    onSuccess: (_d, vars) => { toast.success(`${vars.name} saved`); setVals((v) => ({ ...v, [vars.name]: "" })); qc.invalidateQueries({ queryKey: ["integrations"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (name: string) => delFn({ data: { name } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["integrations"] }),
  });
  const test = useMutation({
    mutationFn: (name: string) => testFn({ data: { name } }),
    onSuccess: (r: any, name) => {
      if (r.ok) toast.success(`${name}: ${r.message}`); else toast.error(`${name}: ${r.message}`);
      qc.invalidateQueries({ queryKey: ["integrations"] });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><KeyRound className="h-4 w-4 text-primary" /> Integrations Hub</CardTitle>
        <CardDescription>
          সবগুলো API key এখানে paste করে Save → Test করুন। Required না হলেও যেগুলো দিবেন সেগুলো guardrails-এ ব্যবহার হবে।
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {slots.map((slot: any) => (
          <div key={slot.name} className="rounded-md border border-border p-3 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 text-sm font-medium">
                {slot.configured ? <CircleCheck className="h-4 w-4 text-success" /> : <CircleAlert className={`h-4 w-4 ${slot.required ? "text-destructive" : "text-muted-foreground"}`} />}
                {slot.label}
                {slot.required && !slot.configured && <Badge variant="outline" className="text-[10px]">required</Badge>}
                {slot.managed && <Badge variant="secondary" className="text-[10px]">managed</Badge>}
                {slot.last_test_ok === true && <Badge className="text-[10px] bg-success/20 text-success border-success/30">test ✓</Badge>}
                {slot.last_test_ok === false && <Badge className="text-[10px] bg-destructive/20 text-destructive border-destructive/30">test ✗</Badge>}
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => test.mutate(slot.name)} disabled={test.isPending}>Test</Button>
                {slot.user_configured && (
                  <Button size="icon" variant="ghost" onClick={() => del.mutate(slot.name)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                )}
              </div>
            </div>
            {slot.desc && <div className="text-xs text-muted-foreground">{slot.desc}</div>}
            {slot.last_test_message && (
              <div className={`text-[11px] ${slot.last_test_ok ? "text-success" : "text-destructive"}`}>{slot.last_test_message}</div>
            )}
            {!slot.managed && (
              <div className="flex gap-2">
                <Input
                  placeholder={slot.user_configured ? "(stored — paste to overwrite)" : `Paste ${slot.label}…`}
                  type={slot.name.includes("SECRET") || slot.name.includes("KEY") || slot.name.includes("TOKEN") || slot.name.includes("PAT") ? "password" : "text"}
                  value={vals[slot.name] ?? ""}
                  onChange={(e) => setVals((v) => ({ ...v, [slot.name]: e.target.value }))}
                />
                <Button size="sm" onClick={() => save.mutate({ name: slot.name, value: vals[slot.name] ?? "" })} disabled={!vals[slot.name] || save.isPending}>
                  <Save className="h-3.5 w-3.5" /> Save
                </Button>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function StyleMemorySection() {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const { data: samples } = useQuery({
    queryKey: ["style"],
    queryFn: async () => {
      const { data } = await supabase.from("style_memory").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });
  const add = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("style_memory").insert({ user_id: u.user!.id, sample_text: text });
      if (error) throw error;
    },
    onSuccess: () => { setText(""); toast.success("Saved"); qc.invalidateQueries({ queryKey: ["style"] }); },
  });
  const del = useMutation({
    mutationFn: async (id: string) => { await supabase.from("style_memory").delete().eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["style"] }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Style Memory</CardTitle>
        <CardDescription>আপনার পুরনো post/caption paste করুন (১০-২০টা)। AI আপনার tone copy করবে।</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste your past post / caption…" rows={3} />
        <Button onClick={() => add.mutate()} disabled={!text || add.isPending}>Add sample</Button>
        <div className="space-y-2">
          {samples?.map((s: any) => (
            <div key={s.id} className="flex justify-between items-start gap-2 rounded-md border border-border p-2">
              <div className="text-xs whitespace-pre-wrap flex-1">{s.sample_text}</div>
              <Button size="icon" variant="ghost" onClick={() => del.mutate(s.id)}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SentixFeaturesSection() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const { data: features } = useQuery({
    queryKey: ["features"],
    queryFn: async () => {
      const { data } = await supabase.from("sentix_features").select("*").order("promote_priority", { ascending: false });
      return data ?? [];
    },
  });
  const add = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("sentix_features").insert({ user_id: u.user!.id, feature_name: name, description: desc });
      if (error) throw error;
    },
    onSuccess: () => { setName(""); setDesc(""); toast.success("Added"); qc.invalidateQueries({ queryKey: ["features"] }); },
  });
  const del = useMutation({
    mutationFn: async (id: string) => { await supabase.from("sentix_features").delete().eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["features"] }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sentix AI Features (rotate-promote)</CardTitle>
        <CardDescription>আপনার system-এর features add করুন — AI scripts-এ rotate করে subtle mention করবে।</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input placeholder="Feature name" value={name} onChange={(e) => setName(e.target.value)} />
        <Textarea placeholder="Short description" value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} />
        <Button onClick={() => add.mutate()} disabled={!name}>Add</Button>
        <div className="space-y-2">
          {features?.map((f: any) => (
            <div key={f.id} className="flex justify-between items-start gap-2 rounded-md border border-border p-2">
              <div className="flex-1">
                <div className="font-medium text-sm">{f.feature_name}</div>
                <div className="text-xs text-muted-foreground">{f.description}</div>
              </div>
              <Button size="icon" variant="ghost" onClick={() => del.mutate(f.id)}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function GeminiKeysSection() {
  const qc = useQueryClient();
  const [label, setLabel] = useState("");
  const [key, setKey] = useState("");
  const { data: keys } = useQuery({
    queryKey: ["keys"],
    queryFn: async () => {
      const { data } = await supabase
        .from("gemini_keys")
        .select("id, label, active, cooldown_until, daily_calls, total_calls, failure_count, created_at")
        .order("created_at", { ascending: true });
      return data ?? [];
    },
    refetchInterval: 10000,
  });
  const add = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("gemini_keys").insert({ user_id: u.user!.id, label, key_value: key });
      if (error) throw error;
    },
    onSuccess: () => { setLabel(""); setKey(""); toast.success("Saved"); qc.invalidateQueries({ queryKey: ["keys"] }); },
  });
  const del = useMutation({
    mutationFn: async (id: string) => { await supabase.from("gemini_keys").delete().eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["keys"] }),
  });
  const toggle = useMutation({
    mutationFn: async (k: any) => { await supabase.from("gemini_keys").update({ active: !k.active }).eq("id", k.id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["keys"] }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Gemini Key Pool</CardTitle>
        <CardDescription>
          aistudio.google.com থেকে free key নিয়ে ৫-১০টা add করুন। System round-robin rotate করবে, 429 হলে 1hr cooldown দিবে।
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input placeholder="Label" value={label} onChange={(e) => setLabel(e.target.value)} />
        <Input placeholder="AIza… key" type="password" value={key} onChange={(e) => setKey(e.target.value)} />
        <Button onClick={() => add.mutate()} disabled={!label || !key}>Add key</Button>
        <div className="space-y-2">
          {keys?.map((k: any) => {
            const onCooldown = k.cooldown_until && new Date(k.cooldown_until) > new Date();
            return (
              <div key={k.id} className="flex justify-between items-center gap-2 rounded-md border border-border p-2">
                <div className="flex items-center gap-2 text-sm flex-1 min-w-0">
                  <span className={`h-2 w-2 rounded-full shrink-0 ${!k.active ? "bg-muted" : onCooldown ? "bg-warning" : "bg-success"}`} />
                  <span className="truncate">{k.label}</span>
                  <Badge variant="outline" className="text-[10px]">{k.daily_calls ?? 0}/1500</Badge>
                  {onCooldown && <Badge variant="outline" className="text-[10px] bg-warning/10">cooldown</Badge>}
                </div>
                <Button size="sm" variant="ghost" onClick={() => toggle.mutate(k)}>{k.active ? "Disable" : "Enable"}</Button>
                <Button size="icon" variant="ghost" onClick={() => del.mutate(k.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
