
-- 1. autopilot_settings (per user)
CREATE TABLE public.autopilot_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  auto_approve boolean NOT NULL DEFAULT false,
  auto_render boolean NOT NULL DEFAULT false,
  auto_publish_telegram boolean NOT NULL DEFAULT false,
  daily_quota int NOT NULL DEFAULT 4,
  timezone text NOT NULL DEFAULT 'Asia/Dhaka',
  slot_config jsonb NOT NULL DEFAULT '[
    {"slot":"morning","hour":8,"tone":"logical"},
    {"slot":"noon","hour":13,"tone":"story"},
    {"slot":"afternoon","hour":17,"tone":"psychology"},
    {"slot":"night","hour":21,"tone":"emotional"}
  ]'::jsonb,
  paused_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.autopilot_settings TO authenticated;
GRANT ALL ON public.autopilot_settings TO service_role;
ALTER TABLE public.autopilot_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own autopilot" ON public.autopilot_settings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 2. guard_reports (copyright / AI-detection per script or render job)
CREATE TABLE public.guard_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  script_id uuid,
  render_job_id uuid,
  audio_copyright_score numeric,
  audio_match jsonb,
  ai_voice_score numeric,
  ai_video_score numeric,
  transcript_match_pct numeric,
  transcript_actual text,
  flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  verdict text NOT NULL DEFAULT 'pending',
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.guard_reports TO authenticated;
GRANT ALL ON public.guard_reports TO service_role;
ALTER TABLE public.guard_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own guard reports" ON public.guard_reports FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX guard_reports_script_idx ON public.guard_reports(script_id);

-- 3. diagnostic_runs (System Doctor)
CREATE TABLE public.diagnostic_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  mode text NOT NULL DEFAULT 'short',
  status text NOT NULL DEFAULT 'running',
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.diagnostic_runs TO authenticated;
GRANT ALL ON public.diagnostic_runs TO service_role;
ALTER TABLE public.diagnostic_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own diagnostics" ON public.diagnostic_runs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4. pipeline_runs (autopilot audit log)
CREATE TABLE public.pipeline_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  slot text,
  stage text NOT NULL,
  status text NOT NULL,
  ref_id uuid,
  message text,
  data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pipeline_runs TO authenticated;
GRANT ALL ON public.pipeline_runs TO service_role;
ALTER TABLE public.pipeline_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own pipeline" ON public.pipeline_runs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX pipeline_runs_user_created_idx ON public.pipeline_runs(user_id, created_at DESC);

-- 5. Soft delete columns
ALTER TABLE public.content_ideas ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.scripts ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.render_jobs ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- 6. Render callback idempotency: only one terminal status per job
CREATE UNIQUE INDEX IF NOT EXISTS render_jobs_terminal_unique
  ON public.render_jobs(id)
  WHERE status IN ('succeeded','failed');

-- 7. Update trigger for autopilot_settings
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER autopilot_settings_touch BEFORE UPDATE ON public.autopilot_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
