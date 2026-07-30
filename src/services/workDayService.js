import { getSupabaseClient } from "./supabaseClient.js?v=20260621-stage1-clean-all";

function normalizeWorkDayPayload(data) {
  return {
    period: data?.period ?? null,
    workDay: data?.work_day ?? null,
    snapshot: data?.snapshot ?? null,
    reopened: data?.reopened === true,
  };
}

export async function loadActiveWorkDay() {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase.rpc("ensure_active_work_day");

  if (error) {
    throw new Error(error.message || "No se pudo cargar el dia activo.");
  }

  return normalizeWorkDayPayload(data);
}

export async function saveWorkDaySnapshot({ workDayId, inputState, computedState, summary }) {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase.rpc("save_work_day_snapshot", {
    p_work_day_id: workDayId,
    p_input_state: inputState,
    p_computed_state: computedState,
    p_summary: summary,
    p_snapshot_type: "manual_save",
  });

  if (error) {
    throw new Error(error.message || "No se pudo guardar el dia.");
  }

  return data;
}

export async function changeActiveWorkDate({
  workDayId,
  workDate,
  actorRole,
  inputState,
  computedState,
  summary,
}) {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase.rpc("change_active_work_date", {
    p_work_day_id: workDayId,
    p_work_date: workDate,
    p_actor_role: actorRole,
    p_input_state: inputState,
    p_computed_state: computedState,
    p_summary: summary,
  });

  if (error) {
    throw new Error(error.message || "No se pudo actualizar la Fecha inicial.");
  }

  return normalizeWorkDayPayload(data);
}

export async function saveRegistroHistorySnapshot({ workDayId, inputState, computedState, summary }) {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase.rpc("save_registro_history_snapshot", {
    p_work_day_id: workDayId,
    p_input_state: inputState,
    p_computed_state: computedState,
    p_summary: summary,
  });

  if (error) {
    throw new Error(error.message || "No se pudo guardar el registro historico.");
  }

  return data;
}

export async function deleteRegistroHistorySnapshot({ snapshotId, periodId, actorRole }) {
  if (typeof snapshotId !== "string" || snapshotId.trim() === "") {
    throw new Error("El registro historico no es valido.");
  }
  if (typeof periodId !== "string" || periodId.trim() === "") {
    throw new Error("El periodo activo no es valido.");
  }

  const supabase = await getSupabaseClient();
  const { data, error } = await supabase.rpc("delete_registro_history_snapshot", {
    p_snapshot_id: snapshotId,
    p_period_id: periodId,
    p_actor_role: actorRole,
  });

  if (error) {
    throw new Error(error.message || "No se pudo eliminar el registro historico.");
  }

  return data;
}

export async function closeWorkDayAndStartNext({
  workDayId,
  inputState,
  computedState,
  summary,
  nextInputState,
  nextComputedState,
  nextSummary,
}) {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase.rpc("close_work_day", {
    p_work_day_id: workDayId,
    p_input_state: inputState,
    p_computed_state: computedState,
    p_summary: summary,
    p_next_input_state: nextInputState,
    p_next_computed_state: nextComputedState,
    p_next_summary: nextSummary,
  });

  if (error) {
    throw new Error(error.message || "No se pudo cerrar el día.");
  }

  return data;
}

export async function listRegistroHistorySnapshots(periodId) {
  if (!periodId) return [];

  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from("work_day_snapshots")
    .select("id, period_id, work_day_id, snapshot_type, saved_by, saved_at, summary, input_state, computed_state")
    .eq("snapshot_type", "registro_history")
    .eq("period_id", periodId)
    .order("saved_at", { ascending: false });

  if (error) {
    throw new Error(error.message || "No se pudo cargar el historial.");
  }

  return data ?? [];
}
