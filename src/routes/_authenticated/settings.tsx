import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useState } from "react";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gradient">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Style Memory, Sentix features, backup Gemini keys
        </p>
      </div>
      <StyleMemorySection />
      <SentixFeaturesSection />
      <GeminiKeysSection />
    </div>
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
        <CardDescription>
          আপনার পুরনো post/caption paste করুন (১০-২০টা)। AI আপনার tone copy করবে।
        </CardDescription>
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
      const { error } = await supabase.from("sentix_features").insert({
        user_id: u.user!.id, feature_name: name, description: desc,
      });
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
        <CardDescription>
          আপনার system-এর features add করুন — AI scripts-এ rotate করে subtle mention করবে।
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input placeholder="Feature name (e.g. Quant Logic Engine)" value={name} onChange={(e) => setName(e.target.value)} />
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
      const { data } = await supabase.from("gemini_keys").select("id, label, active, created_at").order("created_at", { ascending: false });
      return data ?? [];
    },
  });
  const add = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("gemini_keys").insert({
        user_id: u.user!.id, label, key_value: key,
      });
      if (error) throw error;
    },
    onSuccess: () => { setLabel(""); setKey(""); toast.success("Saved"); qc.invalidateQueries({ queryKey: ["keys"] }); },
  });
  const del = useMutation({
    mutationFn: async (id: string) => { await supabase.from("gemini_keys").delete().eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["keys"] }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Backup Gemini Keys</CardTitle>
        <CardDescription>
          এই MVP-তে Lovable AI Gateway primary। Backup hisaabe ৩-৫টা personal Gemini keys save করতে পারেন (পরে rotate logic add হবে)।
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input placeholder="Label" value={label} onChange={(e) => setLabel(e.target.value)} />
        <Input placeholder="AIza… key" type="password" value={key} onChange={(e) => setKey(e.target.value)} />
        <Button onClick={() => add.mutate()} disabled={!label || !key}>Add key</Button>
        <div className="space-y-2">
          {keys?.map((k: any) => (
            <div key={k.id} className="flex justify-between items-center gap-2 rounded-md border border-border p-2">
              <div className="text-sm">{k.label} {k.active ? "" : "(inactive)"}</div>
              <Button size="icon" variant="ghost" onClick={() => del.mutate(k.id)}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
