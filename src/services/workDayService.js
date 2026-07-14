import { getSupabaseClient } from "./supabaseClient.js?v=20260621-stage1-clean-all";

function normalizeWorkDayPayload(data) {
  return {
    period: data?.period ?? null,
    workDay: data?.work_day ?? null,
    snapshot: data?.snapshot ?? null,
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
