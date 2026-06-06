
CREATE TABLE public.user_secrets (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  value text NOT NULL,
  last_tested_at timestamptz,
  last_test_ok boolean,
  last_test_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_secrets TO authenticated;
GRANT ALL ON public.user_secrets TO service_role;
ALTER TABLE public.user_secrets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own secrets" ON public.user_secrets FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER user_secrets_touch BEFORE UPDATE ON public.user_secrets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
