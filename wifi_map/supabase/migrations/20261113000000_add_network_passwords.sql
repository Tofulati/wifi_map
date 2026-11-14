create table public.network_passwords (
  id uuid primary key default gen_random_uuid(),
  network_id uuid not null references public.networks(id) on delete cascade,
  latitude_e4 integer not null check (latitude_e4 between -900000 and 900000),
  longitude_e4 integer not null check (longitude_e4 between -1800000 and 1800000),
  password_hash text not null,
  created_at timestamptz not null default now(),
  unique (network_id, latitude_e4, longitude_e4)
);

alter table public.network_passwords enable row level security;

create or replace function public.network_password_exists(
  p_network_name text,
  p_latitude double precision,
  p_longitude double precision
)
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.network_passwords password_entry
    join public.networks network on network.id = password_entry.network_id
    where network.network_scope = 'anonymous'
      and network.normalized_ssid = lower(trim(p_network_name))
      and password_entry.latitude_e4 = round(p_latitude * 10000)::integer
      and password_entry.longitude_e4 = round(p_longitude * 10000)::integer
  );
$$;

create or replace function public.add_network_password(
  p_network_name text,
  p_latitude double precision,
  p_longitude double precision,
  p_password text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  network_uuid uuid;
begin
  if p_password is null or char_length(p_password) = 0 or char_length(p_password) > 128 then
    raise exception 'Network password must be between 1 and 128 characters';
  end if;

  select id into network_uuid
  from public.networks
  where network_scope = 'anonymous'
    and normalized_ssid = lower(trim(p_network_name));

  if network_uuid is null then
    return false;
  end if;

  insert into public.network_passwords (
    network_id,
    latitude_e4,
    longitude_e4,
    password_hash
  )
  values (
    network_uuid,
    round(p_latitude * 10000)::integer,
    round(p_longitude * 10000)::integer,
    crypt(p_password, gen_salt('bf'))
  )
  on conflict (network_id, latitude_e4, longitude_e4) do nothing;

  return found;
end;
$$;

revoke all on public.network_passwords from anon, authenticated;
grant execute on function public.network_password_exists(text, double precision, double precision)
  to anon, authenticated;
grant execute on function public.add_network_password(text, double precision, double precision, text)
  to anon, authenticated;
