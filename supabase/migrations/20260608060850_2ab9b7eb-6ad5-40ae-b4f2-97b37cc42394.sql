
-- Hooks: AI generation tracking
ALTER TABLE public.hooks_library
  ADD COLUMN IF NOT EXISTS ai_generated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source_topic text;

-- Render jobs: Telegram delivery proof + retry queue
ALTER TABLE public.render_jobs
  ADD COLUMN IF NOT EXISTS telegram_message_id text,
  ADD COLUMN IF NOT EXISTS telegram_delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS retry_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz;

-- Competitor channels: real notes
ALTER TABLE public.competitor_channels
  ADD COLUMN IF NOT EXISTS notes text;

-- Pipeline runs: cost ledger
ALTER TABLE public.pipeline_runs
  ADD COLUMN IF NOT EXISTS cost_usd numeric(10,6),
  ADD COLUMN IF NOT EXISTS tokens_in int,
  ADD COLUMN IF NOT EXISTS tokens_out int;

-- References table for vision analysis
CREATE TABLE IF NOT EXISTS public.creative_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  public_url text,
  media_type text NOT NULL CHECK (media_type IN ('image','video')),
  label text,
  analysis jsonb,
  analyzed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.creative_references TO authenticated;
GRANT ALL ON public.creative_references TO service_role;

ALTER TABLE public.creative_references ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own creative refs"
  ON public.creative_references
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
