import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useState, useEffect } from "react";

const days = ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহঃ", "শুক্র", "শনি"];
const defaultThemes = [
  "Crypto / Halal income angle",
  "Revenge trading dangers",
  "Logic over signals",
  "Inside the AI brain (Sentix features)",
  "News manipulation",
  "Volatility & weekend OTC trap",
  "Crypto reset / week wrap-up",
];

export const Route = createFileRoute("/_authenticated/calendar")({
  component: CalendarPage,
});

function CalendarPage() {
  const qc = useQueryClient();

  const { data: rows } = useQuery({
    queryKey: ["calendar"],
    queryFn: async () => {
      const { data } = await supabase.from("weekly_calendar").select("*").order("day_of_week");
      return data ?? [];
    },
  });

  const seed = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const rowsToInsert = defaultThemes.map((theme, i) => ({
        user_id: u.user!.id,
        day_of_week: i,
        slot_type: i === 3 ? "trend" : "fixed",
        theme,
        description: "",
      }));
      await supabase.from("weekly_calendar").delete().eq("user_id", u.user!.id);
      const { error } = await supabase.from("weekly_calendar").insert(rowsToInsert);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Calendar reset to defaults");
      qc.invalidateQueries({ queryKey: ["calendar"] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-gradient">Calendar</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Hybrid: ৭০% fixed theme + ৩০% trend override
          </p>
        </div>
        <Button onClick={() => seed.mutate()} variant="outline" size="sm">
          Reset to defaults
        </Button>
      </div>

      {!rows?.length ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground text-sm">
            Calendar খালি। "Reset to defaults" click করে শুরু করুন।
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {days.map((d, i) => {
            const row = rows.find((r: any) => r.day_of_week === i);
            return <DayCard key={i} day={d} row={row} />;
          })}
        </div>
      )}
    </div>
  );
}

function DayCard({ day, row }: any) {
  const qc = useQueryClient();
  const [theme, setTheme] = useState(row?.theme ?? "");
  const [desc, setDesc] = useState(row?.description ?? "");

  useEffect(() => {
    setTheme(row?.theme ?? "");
    setDesc(row?.description ?? "");
  }, [row]);

  const save = useMutation({
    mutationFn: async () => {
      if (!row) return;
      await supabase.from("weekly_calendar").update({ theme, description: desc }).eq("id", row.id);
    },
    onSuccess: () => {
      toast.success(`${day}বার saved`);
      qc.invalidateQueries({ queryKey: ["calendar"] });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex justify-between items-center">
          <span>{day}বার</span>
          <span className="text-xs text-muted-foreground">{row?.slot_type}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Input value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="Theme" />
        <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Notes" rows={2} />
        <Button size="sm" variant="outline" onClick={() => save.mutate()}>Save</Button>
      </CardContent>
    </Card>
  );
}
