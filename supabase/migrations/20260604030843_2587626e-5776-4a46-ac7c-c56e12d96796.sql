
-- 1. Extend gemini_keys
ALTER TABLE public.gemini_keys
  ADD COLUMN IF NOT EXISTS daily_calls integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_calls integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_429_at timestamptz,
  ADD COLUMN IF NOT EXISTS daily_reset_at date NOT NULL DEFAULT CURRENT_DATE;

-- 2. Extend scripts
ALTER TABLE public.scripts
  ADD COLUMN IF NOT EXISTS render_status text NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS audio_url text,
  ADD COLUMN IF NOT EXISTS needs_review_reason text,
  ADD COLUMN IF NOT EXISTS final_score numeric(4,2),
  ADD COLUMN IF NOT EXISTS iterations_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS asset_plan jsonb;

-- 3. dual_ai_runs
CREATE TABLE IF NOT EXISTS public.dual_ai_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  script_id uuid REFERENCES public.scripts(id) ON DELETE CASCADE,
  idea_id uuid REFERENCES public.content_ideas(id) ON DELETE SET NULL,
  iteration integer NOT NULL DEFAULT 1,
  role text NOT NULL,
  content jsonb NOT NULL,
  score numeric(4,2),
  feedback text,
  final_status text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dual_ai_runs TO authenticated;
GRANT ALL ON public.dual_ai_runs TO service_role;
ALTER TABLE public.dual_ai_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin all dual_ai_runs" ON public.dual_ai_runs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 4. asset_cache
CREATE TABLE IF NOT EXISTS public.asset_cache (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query_hash text NOT NULL,
  source text NOT NULL,
  query text NOT NULL,
  url text NOT NULL,
  metadata jsonb,
  used_count integer NOT NULL DEFAULT 0,
  last_used timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, query_hash, url)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.asset_cache TO authenticated;
GRANT ALL ON public.asset_cache TO service_role;
ALTER TABLE public.asset_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin all asset_cache" ON public.asset_cache
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 5. render_jobs
CREATE TABLE IF NOT EXISTS public.render_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  script_id uuid NOT NULL REFERENCES public.scripts(id) ON DELETE CASCADE,
  github_run_id text,
  status text NOT NULL DEFAULT 'queued',
  video_url text,
  audio_url text,
  error text,
  payload jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.render_jobs TO authenticated;
GRANT ALL ON public.render_jobs TO service_role;
ALTER TABLE public.render_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin all render_jobs" ON public.render_jobs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_dual_ai_runs_script ON public.dual_ai_runs(script_id);
CREATE INDEX IF NOT EXISTS idx_render_jobs_script ON public.render_jobs(script_id);
CREATE INDEX IF NOT EXISTS idx_asset_cache_hash ON public.asset_cache(user_id, query_hash);
