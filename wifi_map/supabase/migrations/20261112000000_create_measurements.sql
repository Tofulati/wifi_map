create extension if not exists pgcrypto;

create table public.networks (
  id uuid primary key default gen_random_uuid(),
  network_scope text not null default 'anonymous',
  ssid text not null check (char_length(ssid) between 1 and 32),
  normalized_ssid text not null check (char_length(normalized_ssid) between 1 and 32),
  created_at timestamptz not null default now(),
  unique (network_scope, normalized_ssid)
);

create table public.access_points (
  id uuid primary key default gen_random_uuid(),
  network_id uuid not null references public.networks(id) on delete cascade,
  bssid macaddr,
  frequency integer check (frequency is null or frequency > 0),
  channel integer check (channel is null or channel > 0),
  created_at timestamptz not null default now()
);

create table public.measurements (
  id uuid primary key,
  network_id uuid not null references public.networks(id) on delete cascade,
  access_point_id uuid references public.access_points(id) on delete set null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  download_mbps double precision not null check (download_mbps >= 0),
  upload_mbps double precision check (upload_mbps is null or upload_mbps >= 0),
  latency_ms double precision check (latency_ms is null or latency_ms >= 0),
  jitter_ms double precision check (jitter_ms is null or jitter_ms >= 0),
  signal_strength double precision,
  packet_loss double precision check (packet_loss is null or packet_loss between 0 and 100),
  additional_metrics jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index measurements_network_id_recorded_at_idx
  on public.measurements (network_id, recorded_at desc);
create index measurements_recorded_at_idx on public.measurements (recorded_at desc);
create index access_points_network_id_idx on public.access_points (network_id);

alter table public.networks enable row level security;
alter table public.access_points enable row level security;
alter table public.measurements enable row level security;

create policy "Anonymous clients can read networks"
  on public.networks for select to anon using (network_scope = 'anonymous');
create policy "Anonymous clients can create networks"
  on public.networks for insert to anon
  with check (network_scope = 'anonymous');
create policy "Anonymous clients can update anonymous networks"
  on public.networks for update to anon
  using (network_scope = 'anonymous')
  with check (network_scope = 'anonymous');
create policy "Anonymous clients can read measurements"
  on public.measurements for select to anon using (true);
create policy "Anonymous clients can create measurements"
  on public.measurements for insert to anon
  with check (true);
create policy "Anonymous clients can update measurements"
  on public.measurements for update to anon
  using (true)
  with check (true);
