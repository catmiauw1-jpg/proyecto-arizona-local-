create extension if not exists pgcrypto;

create table if not exists public.periods (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id),
  name text not null default 'Periodo activo',
  status text not null default 'active' check (status in ('active', 'archived')),
  start_date date not null default current_date,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.work_days (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id),
  period_id uuid not null references public.periods(id),
  work_date date not null default current_date,
  status text not null default 'active' check (status in ('active', 'closed')),
  last_snapshot_id uuid,
  last_saved_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.work_day_snapshots (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id),
  period_id uuid not null references public.periods(id),
  work_day_id uuid not null references public.work_days(id),
  input_state jsonb not null,
  computed_state jsonb not null,
  summary jsonb not null default '{}'::jsonb,
  snapshot_type text not null default 'manual_save' check (snapshot_type in ('manual_save', 'initial')),
  saved_by uuid not null references auth.users(id),
  saved_at timestamptz not null default now()
);

alter table public.work_days
  drop constraint if exists work_days_last_snapshot_id_fkey;

alter table public.work_days
  add constraint work_days_last_snapshot_id_fkey
  foreign key (last_snapshot_id) references public.work_day_snapshots(id);

create unique index if not exists periods_one_active_per_client
  on public.periods (client_id)
  where status = 'active';

create unique index if not exists work_days_one_active_per_period
  on public.work_days (period_id)
  where status = 'active';

create index if not exists periods_client_status_idx
  on public.periods (client_id, status);

create index if not exists work_days_client_period_status_idx
  on public.work_days (client_id, period_id, status);

create index if not exists work_day_snapshots_work_day_saved_idx
  on public.work_day_snapshots (work_day_id, saved_at desc);

alter table public.periods enable row level security;
alter table public.work_days enable row level security;
alter table public.work_day_snapshots enable row level security;

create or replace function public.current_active_app_user()
returns table (
  user_id uuid,
  client_id uuid,
  role text
)
language sql
stable
security definer
set search_path = ''
as $$
  select au.auth_user_id, au.client_id, au.role
  from public.app_users au
  where au.auth_user_id = (select auth.uid())
    and au.active = true
  limit 1
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists periods_touch_updated_at on public.periods;
create trigger periods_touch_updated_at
before update on public.periods
for each row execute function public.touch_updated_at();

drop trigger if exists work_days_touch_updated_at on public.work_days;
create trigger work_days_touch_updated_at
before update on public.work_days
for each row execute function public.touch_updated_at();

create or replace function public.set_work_day_snapshot_system_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile record;
  v_work_day record;
begin
  select * into v_profile from public.current_active_app_user() limit 1;

  if v_profile.user_id is null then
    raise exception 'Usuario no autorizado';
  end if;

  select wd.id, wd.client_id, wd.period_id
    into v_work_day
  from public.work_days wd
  where wd.id = new.work_day_id
    and wd.client_id = v_profile.client_id;

  if v_work_day.id is null then
    raise exception 'Dia de trabajo no autorizado';
  end if;

  new.client_id = v_profile.client_id;
  new.period_id = v_work_day.period_id;
  new.saved_by = v_profile.user_id;
  new.saved_at = coalesce(new.saved_at, now());
  new.snapshot_type = coalesce(new.snapshot_type, 'manual_save');

  return new;
end;
$$;

drop trigger if exists work_day_snapshots_system_fields on public.work_day_snapshots;
create trigger work_day_snapshots_system_fields
before insert on public.work_day_snapshots
for each row execute function public.set_work_day_snapshot_system_fields();

create or replace function public.ensure_active_work_day()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile record;
  v_period public.periods%rowtype;
  v_work_day public.work_days%rowtype;
  v_snapshot public.work_day_snapshots%rowtype;
begin
  select * into v_profile from public.current_active_app_user() limit 1;

  if v_profile.user_id is null then
    raise exception 'Usuario no autorizado';
  end if;

  select *
    into v_period
  from public.periods p
  where p.client_id = v_profile.client_id
    and p.status = 'active'
  order by p.created_at desc
  limit 1;

  if v_period.id is null then
    insert into public.periods (client_id, name, status, start_date, created_by)
    values (v_profile.client_id, 'Periodo activo', 'active', current_date, v_profile.user_id)
    returning * into v_period;
  end if;

  select *
    into v_work_day
  from public.work_days wd
  where wd.client_id = v_profile.client_id
    and wd.period_id = v_period.id
    and wd.status = 'active'
  order by wd.created_at desc
  limit 1;

  if v_work_day.id is null then
    insert into public.work_days (client_id, period_id, work_date, status, created_by)
    values (v_profile.client_id, v_period.id, current_date, 'active', v_profile.user_id)
    returning * into v_work_day;
  end if;

  if v_work_day.last_snapshot_id is not null then
    select *
      into v_snapshot
    from public.work_day_snapshots s
    where s.id = v_work_day.last_snapshot_id
      and s.client_id = v_profile.client_id;
  end if;

  return jsonb_build_object(
    'period', to_jsonb(v_period),
    'work_day', to_jsonb(v_work_day),
    'snapshot', case when v_snapshot.id is null then null else to_jsonb(v_snapshot) end
  );
end;
$$;

create or replace function public.save_work_day_snapshot(
  p_work_day_id uuid,
  p_input_state jsonb,
  p_computed_state jsonb,
  p_summary jsonb,
  p_snapshot_type text default 'manual_save'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile record;
  v_work_day public.work_days%rowtype;
  v_snapshot public.work_day_snapshots%rowtype;
begin
  select * into v_profile from public.current_active_app_user() limit 1;

  if v_profile.user_id is null then
    raise exception 'Usuario no autorizado';
  end if;

  select *
    into v_work_day
  from public.work_days wd
  where wd.id = p_work_day_id
    and wd.client_id = v_profile.client_id
    and wd.status = 'active';

  if v_work_day.id is null then
    raise exception 'Dia de trabajo no autorizado o cerrado';
  end if;

  insert into public.work_day_snapshots (
    client_id,
    period_id,
    work_day_id,
    input_state,
    computed_state,
    summary,
    snapshot_type,
    saved_by
  )
  values (
    v_profile.client_id,
    v_work_day.period_id,
    v_work_day.id,
    p_input_state,
    p_computed_state,
    coalesce(p_summary, '{}'::jsonb),
    coalesce(p_snapshot_type, 'manual_save'),
    v_profile.user_id
  )
  returning * into v_snapshot;

  update public.work_days
    set last_snapshot_id = v_snapshot.id,
        last_saved_at = v_snapshot.saved_at,
        updated_at = now()
  where id = v_work_day.id
    and client_id = v_profile.client_id
  returning * into v_work_day;

  return jsonb_build_object(
    'snapshot_id', v_snapshot.id,
    'saved_at', v_snapshot.saved_at,
    'work_day_id', v_work_day.id,
    'period_id', v_work_day.period_id,
    'period_name', (
      select p.name
      from public.periods p
      where p.id = v_work_day.period_id
    )
  );
end;
$$;

revoke all on table public.periods from anon, authenticated;
revoke all on table public.work_days from anon, authenticated;
revoke all on table public.work_day_snapshots from anon, authenticated;

grant select on table public.periods to authenticated;
grant select on table public.work_days to authenticated;
grant select, insert on table public.work_day_snapshots to authenticated;

revoke execute on function public.current_active_app_user() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
revoke execute on function public.set_work_day_snapshot_system_fields() from public, anon, authenticated;
revoke execute on function public.ensure_active_work_day() from public, anon, authenticated;
revoke execute on function public.save_work_day_snapshot(uuid, jsonb, jsonb, jsonb, text) from public, anon, authenticated;

grant execute on function public.current_active_app_user() to authenticated;
grant execute on function public.ensure_active_work_day() to authenticated;
grant execute on function public.save_work_day_snapshot(uuid, jsonb, jsonb, jsonb, text) to authenticated;

drop policy if exists periods_select_own_client on public.periods;
create policy periods_select_own_client
on public.periods
for select
to authenticated
using (
  client_id = (select client_id from public.current_active_app_user())
);

drop policy if exists work_days_select_own_client on public.work_days;
create policy work_days_select_own_client
on public.work_days
for select
to authenticated
using (
  client_id = (select client_id from public.current_active_app_user())
);

drop policy if exists work_day_snapshots_select_own_client on public.work_day_snapshots;
create policy work_day_snapshots_select_own_client
on public.work_day_snapshots
for select
to authenticated
using (
  client_id = (select client_id from public.current_active_app_user())
);

drop policy if exists work_day_snapshots_insert_own_active_day on public.work_day_snapshots;
create policy work_day_snapshots_insert_own_active_day
on public.work_day_snapshots
for insert
to authenticated
with check (
  client_id = (select client_id from public.current_active_app_user())
  and exists (
    select 1
    from public.work_days wd
    where wd.id = work_day_id
      and wd.client_id = (select client_id from public.current_active_app_user())
      and wd.status = 'active'
  )
);
