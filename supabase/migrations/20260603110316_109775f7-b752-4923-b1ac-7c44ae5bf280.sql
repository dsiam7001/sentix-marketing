
-- Roles enum + table
create type public.app_role as enum ('admin', 'user');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile read" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid() = id);
create policy "own profile insert" on public.profiles for insert to authenticated with check (auth.uid() = id);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "read own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role);
$$;

-- Auto-create profile + first user becomes admin
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  user_count int;
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));
  select count(*) into user_count from auth.users;
  if user_count <= 1 then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  else
    insert into public.user_roles (user_id, role) values (new.id, 'user');
  end if;
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- Helper: admin policy
-- Style memory: tone samples
create table public.style_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sample_text text not null,
  label text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.style_memory to authenticated;
grant all on public.style_memory to service_role;
alter table public.style_memory enable row level security;
create policy "admin all style" on public.style_memory for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- Daily Pulse
create table public.daily_pulse (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pulse_date date not null default current_date,
  telegram_trends text,
  competitor_viral text,
  market_event text,
  auto_trends jsonb,
  ai_strategy text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.daily_pulse to authenticated;
grant all on public.daily_pulse to service_role;
alter table public.daily_pulse enable row level security;
create policy "admin all pulse" on public.daily_pulse for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- Competitor channels
create table public.competitor_channels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  channel_name text not null,
  channel_url text not null,
  platform text not null default 'youtube',
  last_digest jsonb,
  last_checked timestamptz,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.competitor_channels to authenticated;
grant all on public.competitor_channels to service_role;
alter table public.competitor_channels enable row level security;
create policy "admin all comp" on public.competitor_channels for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- Content ideas (with 3 variants)
create table public.content_ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic text not null,
  theme text,
  time_slot text,
  rationale text,
  pain_point text,
  variants jsonb not null default '[]'::jsonb,
  selected_variant_index int,
  virality_score int,
  virality_breakdown jsonb,
  status text not null default 'pending',
  for_date date not null default current_date,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.content_ideas to authenticated;
grant all on public.content_ideas to service_role;
alter table public.content_ideas enable row level security;
create policy "admin all ideas" on public.content_ideas for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- Scripts
create table public.scripts (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid references public.content_ideas(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  hook text,
  full_script text not null,
  scenes jsonb not null default '[]'::jsonb,
  on_screen_text jsonb,
  music_mood text,
  effects jsonb,
  caption text,
  hashtags text,
  srt text,
  thumbnail_concept text,
  duration_sec int default 90,
  polished boolean not null default false,
  virality_score int,
  virality_breakdown jsonb,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.scripts to authenticated;
grant all on public.scripts to service_role;
alter table public.scripts enable row level security;
create policy "admin all scripts" on public.scripts for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- Hooks library
create table public.hooks_library (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  hook_text text not null,
  category text,
  emotion text,
  is_seed boolean not null default false,
  favorite boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.hooks_library to authenticated;
grant all on public.hooks_library to service_role;
alter table public.hooks_library enable row level security;
create policy "admin all hooks" on public.hooks_library for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "read seed hooks" on public.hooks_library for select to authenticated using (is_seed = true);

-- Sentix features rotation
create table public.sentix_features (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feature_name text not null,
  description text,
  promote_priority int not null default 5,
  last_promoted_at timestamptz,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.sentix_features to authenticated;
grant all on public.sentix_features to service_role;
alter table public.sentix_features enable row level security;
create policy "admin all features" on public.sentix_features for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- Videos published + performance
create table public.videos_published (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  script_id uuid references public.scripts(id) on delete set null,
  platform text not null,
  video_url text,
  published_at timestamptz not null default now(),
  views_24h int,
  views_48h int,
  views_72h int,
  notes text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.videos_published to authenticated;
grant all on public.videos_published to service_role;
alter table public.videos_published enable row level security;
create policy "admin all videos" on public.videos_published for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- Weekly calendar (hybrid 70/30)
create table public.weekly_calendar (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day_of_week int not null,
  slot_type text not null default 'fixed',
  theme text not null,
  description text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.weekly_calendar to authenticated;
grant all on public.weekly_calendar to service_role;
alter table public.weekly_calendar enable row level security;
create policy "admin all cal" on public.weekly_calendar for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- Backup Gemini keys
create table public.gemini_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  key_value text not null,
  active boolean not null default true,
  cooldown_until timestamptz,
  last_used timestamptz,
  failure_count int not null default 0,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.gemini_keys to authenticated;
grant all on public.gemini_keys to service_role;
alter table public.gemini_keys enable row level security;
create policy "admin all keys" on public.gemini_keys for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- AI calibration
create table public.ai_calibration (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  video_id uuid references public.videos_published(id) on delete cascade,
  predicted_score int,
  actual_views int,
  delta_notes text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.ai_calibration to authenticated;
grant all on public.ai_calibration to service_role;
alter table public.ai_calibration enable row level security;
create policy "admin all cal2" on public.ai_calibration for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- Seed Bengali hooks (50 to start)
insert into public.hooks_library (hook_text, category, emotion, is_seed) values
('ভাই, এই ১ মিনিট না দেখলে আজকেও লস খাবেন', 'warning', 'fear', true),
('আপনি কি এখনো VIP signal এ টাকা দিচ্ছেন?', 'question', 'curiosity', true),
('OTC এ ৯০% মানুষ এই ভুলটাই করে', 'reveal', 'curiosity', true),
('আমি ৩ বছরে যা শিখেছি, ৬০ সেকেন্ডে বলে দিচ্ছি', 'authority', 'curiosity', true),
('Trading এ profit করতে গিয়ে আমার বন্ধু সব হারালো', 'story', 'emotional', true),
('এই একটা কারণে আপনি Trading এ হারছেন', 'pain', 'fear', true),
('Martingale strategy = ধীরে ধীরে আত্মহত্যা', 'warning', 'shock', true),
('Signal group থেকে কেন বের হবেন? Real reason', 'reveal', 'curiosity', true),
('Market manipulation কীভাবে কাজ করে - সবাই জানে না', 'reveal', 'curiosity', true),
('Weekend OTC trade করবেন না, এই কারণে', 'warning', 'fear', true),
('Revenge trading আপনার account শেষ করছে', 'pain', 'emotional', true),
('Halal income খুঁজছেন? Trading এ ৩টা rule মানুন', 'solution', 'hope', true),
('আমি যদি আবার শুরু করতাম, এই ভুলগুলো করতাম না', 'story', 'reflection', true),
('Bangladesh trader-দের ৭টা common ভুল', 'list', 'curiosity', true),
('Forex vs Crypto - কোনটা বাংলাদেশীদের জন্য ভালো?', 'compare', 'curiosity', true),
('Risk management না জেনে trade করছেন মানে suicide', 'shock', 'fear', true),
('১০০ টাকা থেকে কীভাবে শুরু করবেন - Real way', 'how-to', 'hope', true),
('Telegram VIP group-গুলোর আসল ব্যবসা কী জানেন?', 'reveal', 'shock', true),
('Profit screenshot দেখায়, loss screenshot কেউ দেখায় না', 'reality', 'reflection', true),
('Emotional trading কেন আপনাকে গরিব বানাচ্ছে', 'pain', 'emotional', true),
('এই ৫টা চার্ট pattern না জানলে trade করবেন না', 'list', 'curiosity', true),
('Eid এর পরে কেন trader-রা সব হারায়?', 'timing', 'curiosity', true),
('আপনার broker আপনাকে কেন হারাতে চায়?', 'reveal', 'shock', true),
('Discipline ছাড়া trading = casino তে টাকা ফেলা', 'truth', 'reflection', true),
('Trading এ আসলে কত % মানুষ profit করে? Real number', 'reality', 'curiosity', true),
('Beginner traders এর জন্য ১টা সত্য কথা', 'truth', 'authority', true),
('Logic ছাড়া trade = অন্ধভাবে বাজি ধরা', 'truth', 'reflection', true),
('আমার এক ছাত্র এই ভুলে ৫ লাখ হারালো', 'story', 'emotional', true),
('Market কেন ওঠে নামে - নতুনদের জন্য simple ব্যাখ্যা', 'education', 'curiosity', true),
('এই pattern দেখলে trade থেকে বের হয়ে যান', 'warning', 'curiosity', true),
('আপনি trader নন, আপনি gambler - prove করছি', 'shock', 'reflection', true),
('Trading shuru korar age এই ৩টা জিনিস জানতেই হবে', 'how-to', 'hope', true),
('News আসার আগে এই signal-গুলো দেখুন', 'tip', 'curiosity', true),
('Stop loss না দিলে আপনি trader নন', 'truth', 'authority', true),
('৯৫% trader এই ১টা ভুলে account blow করে', 'reveal', 'fear', true),
('Bangladesh এ Binary trading কেন এত danger', 'warning', 'fear', true),
('আপনার mindset যদি এই না হয়, trading ছেড়ে দিন', 'truth', 'reflection', true),
('Greed - এটাই আপনার সবচেয়ে বড় শত্রু', 'truth', 'emotional', true),
('Patience নেই? Trading আপনার জন্য না', 'truth', 'reflection', true),
('১ দিনে rich হতে চান? Trading ছেড়ে দিন', 'reality', 'shock', true),
('Backtesting না করে strategy use করছেন? পাগলামি', 'warning', 'curiosity', true),
('এই indicator-টা ৯০% trader ভুল ব্যবহার করে', 'reveal', 'curiosity', true),
('Trading psychology - কেউ এটা শেখায় না কেন?', 'question', 'curiosity', true),
('Profit এর আগে Market বুঝা জরুরি', 'philosophy', 'authority', true),
('আপনি কি জানেন, আপনার trade কে দেখছে?', 'shock', 'curiosity', true),
('Loss recovery এর নামে আরো loss করছেন না তো?', 'pain', 'reflection', true),
('Demo account এ pro, real account এ zero - কেন?', 'truth', 'curiosity', true),
('Trading এ best teacher হলো আপনার নিজের loss', 'wisdom', 'reflection', true),
('এই ১টা rule মানলে আপনি ৮০% trader কে হারিয়ে দিবেন', 'tip', 'hope', true),
('Smart money কী জানেন? নাহলে retail trader হয়েই থাকবেন', 'education', 'curiosity', true);

-- Seed weekly calendar themes (system-level, but we will copy on first admin signup via app)
