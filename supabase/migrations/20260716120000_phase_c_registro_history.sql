begin;

alter table public.work_day_snapshots
  drop constraint if exists work_day_snapshots_snapshot_type_check;

alter table public.work_day_snapshots
  add constraint work_day_snapshots_snapshot_type_check
  check (snapshot_type in ('manual_save', 'initial', 'registro_history'));

create or replace function public.save_registro_history_snapshot(
  p_work_day_id uuid,
  p_input_state jsonb,
  p_computed_state jsonb,
  p_summary jsonb
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
    'registro_history',
    v_profile.user_id
  )
  returning * into v_snapshot;

  return jsonb_build_object(
    'snapshot_id', v_snapshot.id,
    'saved_at', v_snapshot.saved_at,
    'work_day_id', v_snapshot.work_day_id,
    'period_id', v_snapshot.period_id,
    'snapshot_type', v_snapshot.snapshot_type,
    'work_date', coalesce(v_snapshot.summary->>'workDate', v_work_day.work_date::text)
  );
end;
$$;

revoke execute on function public.save_registro_history_snapshot(uuid, jsonb, jsonb, jsonb)
  from public, anon, authenticated;

grant execute on function public.save_registro_history_snapshot(uuid, jsonb, jsonb, jsonb)
  to authenticated;

commit;
