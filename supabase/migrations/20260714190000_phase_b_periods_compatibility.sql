begin;

alter table public.periods
  add column if not exists period_date date default current_date;

alter table public.periods
  alter column period_date set default current_date;

alter table public.periods
  add column if not exists work_date date;

alter table public.periods
  add column if not exists updated_by uuid references auth.users(id);

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
    and p.status in ('active', 'activo')
  order by
    case when p.status = 'active' then 0 else 1 end,
    p.created_at desc
  limit 1;

  if v_period.id is null then
    insert into public.periods (
      client_id,
      name,
      period_date,
      start_date,
      work_date,
      status,
      created_by,
      updated_by
    )
    values (
      v_profile.client_id,
      'Periodo activo',
      current_date,
      current_date,
      current_date,
      'active',
      v_profile.user_id,
      v_profile.user_id
    )
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

commit;
