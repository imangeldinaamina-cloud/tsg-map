-- TSG Map — initial schema.
-- Apply in the Supabase SQL editor or with `supabase db push`.
-- All writes go through the Next.js server using the service-role key, so RLS denies
-- everything to anon/authenticated clients except public reads of observations.

create table if not exists public.observations (
  id bigint generated always as identity primary key,
  point_id text not null check (char_length(point_id) between 1 and 64),
  point_type text not null check (char_length(point_type) between 1 and 64),
  lat double precision not null check (lat between -90 and 90),
  lon double precision not null check (lon between -180 and 180),
  date date not null,
  time_start text not null check (time_start ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  slot text not null check (slot in ('morning', 'midday', 'evening')),
  frames integer not null check (frames > 0),
  mean_people_per_frame double precision not null check (mean_people_per_frame >= 0),
  holdout boolean not null default false,
  imported_at timestamptz not null default now(),
  unique (point_id, date, slot)
);
comment on table public.observations is 'Real field observations: aggregated people counts only. No images, faces or video.';

create table if not exists public.feedback (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  page text not null default '',
  rating smallint not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 1000),
  locale text not null default ''
);

create table if not exists public.events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  type text not null,
  path text,
  props jsonb
);
comment on table public.events is 'Privacy-friendly analytics: no user ids, no IPs, no user agents.';
create index if not exists events_type_idx on public.events (type);

create table if not exists public.waitlist (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  email text not null check (char_length(email) <= 254),
  consent boolean not null check (consent),
  consent_version text not null,
  source text not null check (source in ('early_access', 'pro')),
  locale text not null default '',
  unique (email, source)
);

alter table public.observations enable row level security;
alter table public.feedback enable row level security;
alter table public.events enable row level security;
alter table public.waitlist enable row level security;

-- Observations are public research data (aggregated). Everything else: service role only.
drop policy if exists "observations are readable" on public.observations;
create policy "observations are readable" on public.observations for select using (true);
