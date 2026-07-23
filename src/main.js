import { SHEETS } from "./domain/model.js?v=20260621-stage1-clean-all";
import { toNumber } from "./domain/formatters.js?v=20260621-stage1-clean-all";
import { appLayout } from "./components/layout.js?v=20260723-phase-d";
import { dietScreen } from "./screens/dietScreen.js?v=20260723-phase-d";
import { feedingScreen } from "./screens/feedingScreen.js?v=20260723-phase-d";
import { incomeScreen } from "./screens/incomeScreen.js?v=20260723-phase-d";
import { consumptionScreen } from "./screens/consumptionScreen.js?v=20260723-phase-d";
import { reportScreen } from "./screens/reportScreen.js?v=20260723-phase-d";
import { historyScreen } from "./screens/historyScreen.js?v=20260723-phase-d";
import { loadingScreen, loginScreen } from "./screens/loginScreen.js?v=20260621-stage1-clean-all";
import { loadAuthorizedSession, signInWithPassword, signOut } from "./services/authService.js?v=20260621-stage1-clean-all";
import {
  listRegistroHistorySnapshots,
  loadActiveWorkDay,
  saveRegistroHistorySnapshot,
  saveWorkDaySnapshot,
} from "./services/workDayService.js?v=20260621-stage1-clean-all";
import {
  applyConsumptionFromCalculated,
  getComputedState,
  getState,
  resetState,
  setDietLocked,
  setInitialDataLocked,
  setState,
  subscribe,
  updateConfig,
  updateConsumption,
  updateDietField,
  updateFeedingActual,
  updateIngredient,
  updateLot,
  updateTreatment,
} from "./state/store.js?v=20260723-phase-d";

import {
  canEditConsumptionNotes,
  canEditDiet,
  canEditFeedingActuals,
  canEditHistory,
  canEditIncomeConfig,
  canEditLotField,
  canEditTreatmentConfig,
  canLockDiet,
  canLockInitialData,
  canSaveHistory,
  canSaveWorkDay,
  canUnlockDiet,
  canUnlockInitialData,
  canViewHistory,
  isLocalDevelopmentHost,
  normalizeRole,
} from "./domain/permissions.js?v=20260723-phase-d";
import {
  buildDaySummary,
  buildRegistroHistorySummary,
} from "./domain/snapshotSummaries.js?v=20260723-phase-d";

const app = document.querySelector("#app");
const localRoleToolEnabled = isLocalDevelopmentHost(window.location.hostname);
let localRoleOverride = null;
let authState = {
  status: "loading",
  user: null,
  profile: null,
  client: null,
  error: "",
  loading: false,
};
let workDayState = {
  status: "idle",
  saveStatus: "ready",
  historyStatus: "ready",
  period: null,
  workDay: null,
  workDate: null,
  lastSavedAt: null,
  message: "",
};
let historyState = {
  status: "idle",
  snapshots: [],
  selectedSnapshot: null,
  filters: {
    date: "",
    pen: "",
    lot: "",
    diet: "",
  },
  message: "",
};

function todayIsoDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function currentSheetId() {
  const hash = window.location.hash.replace(/^#\/?/, "");
  return decodeURIComponent(hash || "Ingreso");
}

function findSheet() {
  const active = currentSheetId();
  return SHEETS.find((sheet) => sheet.id === active) ?? SHEETS.find((sheet) => sheet.id === "Ingreso");
}

function parseValue(value, type) {
  if (type === "number" || type === "percent" || type === "currency" || type === "integer") {
    return toNumber(value);
  }
  return value;
}

function activeRole() {
  return localRoleOverride ?? normalizeRole(authState.profile?.role);
}

function buildPermissionContext(state, sheet = findSheet()) {
  return {
    role: activeRole(),
    initialDataLocked: state.accessControl.initialDataLocked,
    dietLocked: sheet.dietId ? state.accessControl.dietLocks[sheet.dietId] === true : false,
  };
}

function routeContent(sheet, state, computed, permissionContext) {
  if (sheet.id === "Ingreso") return incomeScreen(state, computed, permissionContext);
  if (sheet.kind === "diet") return dietScreen(sheet, state, computed, permissionContext);
  if (sheet.kind === "feeding") return feedingScreen(sheet, state, computed, permissionContext);
  if (sheet.kind === "consumption") return consumptionScreen(computed, permissionContext);
  if (sheet.kind === "report") return reportScreen(computed);
  if (sheet.kind === "history" && canViewHistory(permissionContext.role)) return historyScreen(historyState);
  return "";
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function cleanStateFromWorkDay(period, workDay) {
  resetState({
    config: {
      clientName: authState.client?.name ?? "Confinamiento Arizona",
      startDate: period?.start_date ?? "",
      workDate: workDay?.work_date ?? todayIsoDate(),
    },
  });
}

function applyLoadedWorkDay({ period, workDay, snapshot }) {
  const workDate = workDay?.work_date ?? snapshot?.input_state?.config?.workDate ?? todayIsoDate();
  if (snapshot?.input_state) {
    setState({
      ...snapshot.input_state,
      config: {
        ...(snapshot.input_state.config ?? {}),
        workDate,
      },
    });
  } else {
    cleanStateFromWorkDay(period, workDay);
  }

  workDayState = {
    status: "ready",
    saveStatus: snapshot ? "saved" : "ready",
    historyStatus: "ready",
    period,
    workDay,
    workDate,
    lastSavedAt: snapshot?.saved_at ?? workDay?.last_saved_at ?? null,
    message: snapshot ? "Día recuperado correctamente." : "Día activo iniciado sin datos guardados.",
  };
}

async function initializeWorkDay() {
  workDayState = { ...workDayState, status: "loading", message: "" };
  render();

  try {
    const activeWorkDay = await loadActiveWorkDay();
    applyLoadedWorkDay(activeWorkDay);
  } catch (error) {
    workDayState = {
      status: "error",
      saveStatus: "error",
      historyStatus: "ready",
      period: null,
      workDay: null,
      workDate: null,
      lastSavedAt: null,
      message: error.message || "No se pudo cargar el día activo.",
    };
  }

  render();
}

function markUnsaved() {
  if (workDayState.status !== "ready") return;
  workDayState = {
    ...workDayState,
    saveStatus: "ready",
    message: "",
  };
  render();
}

function render() {
  if (authState.status === "loading" || (authState.status === "authorized" && workDayState.status === "loading")) {
    app.innerHTML = loadingScreen();
    return;
  }

  if (authState.status !== "authorized") {
    app.innerHTML = loginScreen(authState);
    return;
  }

  const sheet = findSheet();
  const state = getState();
  const computed = getComputedState();
  const permissionContext = buildPermissionContext(state, sheet);
  if (
    sheet.kind === "history" &&
    historyState.status === "idle" &&
    canViewHistory(permissionContext.role)
  ) {
    void handleLoadHistory();
  }

  app.innerHTML = appLayout({
    activeSheet: sheet.id,
    content: routeContent(sheet, state, computed, permissionContext),
    sessionContext: authState,
    workDayContext: {
      ...workDayState,
      isHistoryView: sheet.kind === "history" && Boolean(historyState.selectedSnapshot),
      permissions: {
        canSaveWorkDay: canSaveWorkDay(permissionContext.role),
        canSaveHistory: canSaveHistory(permissionContext.role),
      },
    },
    roleContext: {
      role: permissionContext.role,
      localToolEnabled: localRoleToolEnabled,
    },
  });
}

function rejectUnauthorizedChange() {
  workDayState = {
    ...workDayState,
    message: "Acción no permitida para el rol activo.",
  };
  render();
}

function editingHistoricalSnapshot() {
  return findSheet().kind === "history" && Boolean(historyState.selectedSnapshot);
}

function handleCommit(event) {
  const action = event.target?.dataset?.action;
  if (!action) return;

  const parts = action.split(":");
  const command = parts[0];
  const role = activeRole();
  const state = getState();

  if (command === "setLocalRole") {
    const nextRole = normalizeRole(event.target.value);
    if (!localRoleToolEnabled || !nextRole) {
      rejectUnauthorizedChange();
      return;
    }
    localRoleOverride = nextRole;
    render();
    return;
  }

  if (editingHistoricalSnapshot() && !canEditHistory(role)) {
    rejectUnauthorizedChange();
    return;
  }

  if (command === "updateConfig") {
    if (!canEditIncomeConfig(role)) {
      rejectUnauthorizedChange();
      return;
    }
    const [, key, type] = parts;
    updateConfig(key, parseValue(event.target.value, type));
    markUnsaved();
    return;
  }

  if (command === "updateDiet") {
    const [, dietId, key, type] = parts;
    if (!canEditDiet(role, state.accessControl.dietLocks[dietId])) {
      rejectUnauthorizedChange();
      return;
    }
    updateDietField(dietId, key, parseValue(event.target.value, type));
    markUnsaved();
    return;
  }

  if (command === "updateIngredient") {
    const [, dietId, ingredientId, key, type] = parts;
    if (!canEditDiet(role, state.accessControl.dietLocks[dietId])) {
      rejectUnauthorizedChange();
      return;
    }
    updateIngredient(dietId, ingredientId, key, parseValue(event.target.value, type));
    markUnsaved();
    return;
  }

  if (command === "updateTreatment") {
    const [, dietId, treatmentNumber, key, type] = parts;
    if (!canEditTreatmentConfig(role, state.accessControl.dietLocks[dietId])) {
      rejectUnauthorizedChange();
      return;
    }
    updateTreatment(dietId, Number(treatmentNumber), key, parseValue(event.target.value, type));
    markUnsaved();
    return;
  }

  if (command === "updateLot") {
    const [, lotId, key, type] = parts;
    if (!canEditLotField(role, state.accessControl.initialDataLocked, key)) {
      rejectUnauthorizedChange();
      return;
    }
    updateLot(lotId, key, parseValue(event.target.value, type));
    markUnsaved();
    return;
  }

  if (command === "updateConsumption") {
    const [, lotId, key, type] = parts;
    if (!canEditConsumptionNotes(role)) {
      rejectUnauthorizedChange();
      return;
    }
    updateConsumption(lotId, key, parseValue(event.target.value, type));
    markUnsaved();
    return;
  }

  if (command === "updateFeedingActual") {
    const [, dietId, lotId, treatmentNumber, type] = parts;
    if (!canEditFeedingActuals(role)) {
      rejectUnauthorizedChange();
      return;
    }
    updateFeedingActual(dietId, lotId, Number(treatmentNumber), parseValue(event.target.value, type));
    markUnsaved();
    return;
  }

}

function handleKeyDown(event) {
  if (event.key !== "Enter") return;
  if (!event.target?.dataset?.action) return;

  event.preventDefault();
  handleCommit(event);
}
function handleClick(event) {
  const action = event.target?.closest("[data-action]")?.dataset?.action;
  const role = activeRole();

  if (action === "applyConsumptionFromCalculated") {
    if (!canEditConsumptionNotes(role) || editingHistoricalSnapshot()) {
      rejectUnauthorizedChange();
      return;
    }
    applyConsumptionFromCalculated(getComputedState().consumptionRows);
    markUnsaved();
    return;
  }

  if (action === "saveWorkDay") {
    if (!canSaveWorkDay(role) || editingHistoricalSnapshot()) {
      rejectUnauthorizedChange();
      return;
    }
    void handleSaveWorkDay();
    return;
  }

  if (action === "saveRegistroHistory") {
    if (!canSaveHistory(role) || editingHistoricalSnapshot()) {
      rejectUnauthorizedChange();
      return;
    }
    void handleSaveRegistroHistory();
    return;
  }

  if (action === "lockInitialData") {
    void handleInitialDataLock(true);
    return;
  }

  if (action === "unlockInitialData") {
    void handleInitialDataLock(false);
    return;
  }

  if (action?.startsWith("lockDiet:")) {
    const [, dietId] = action.split(":");
    void handleDietLock(dietId, true);
    return;
  }

  if (action?.startsWith("unlockDiet:")) {
    const [, dietId] = action.split(":");
    void handleDietLock(dietId, false);
    return;
  }

  if (action === "loadHistory") {
    if (!canViewHistory(role)) {
      rejectUnauthorizedChange();
      return;
    }
    void handleLoadHistory();
    return;
  }

  if (action?.startsWith("openHistorySnapshot:")) {
    if (!canViewHistory(role)) {
      rejectUnauthorizedChange();
      return;
    }
    const [, snapshotId] = action.split(":");
    historyState = {
      ...historyState,
      selectedSnapshot: historyState.snapshots.find((snapshot) => snapshot.id === snapshotId) ?? null,
    };
    render();
    return;
  }

  if (action === "closeHistorySnapshot") {
    historyState = { ...historyState, selectedSnapshot: null };
    window.location.hash = "#/Ingreso";
    render();
    return;
  }

  if (action === "authSignOut") {
    localRoleOverride = null;
    authState = { ...authState, status: "loading" };
    workDayState = {
      status: "idle",
      saveStatus: "ready",
      historyStatus: "ready",
      period: null,
      workDay: null,
      workDate: null,
      lastSavedAt: null,
      message: "",
    };
    historyState = {
      status: "idle",
      snapshots: [],
      selectedSnapshot: null,
      filters: { date: "", pen: "", lot: "", diet: "" },
      message: "",
    };
    render();
    signOut()
      .catch(() => {})
      .finally(() => {
        resetState();
        authState = { status: "signedOut", user: null, profile: null, client: null, error: "" };
        render();
      });
  }
}

function handleHistoryFilter(event) {
  const key = event.target?.dataset?.historyFilter;
  if (!key) return;

  historyState = {
    ...historyState,
    filters: {
      ...historyState.filters,
      [key]: event.target.value,
    },
  };
  render();
}

async function handleSaveWorkDay(successMessage = "Guardado correctamente.") {
  if (workDayState.saveStatus === "saving") return false;
  if (!workDayState.workDay?.id) {
    workDayState = {
      ...workDayState,
      saveStatus: "error",
      message: "No hay un día activo para guardar.",
    };
    render();
    return false;
  }

  workDayState = { ...workDayState, saveStatus: "saving", message: "" };
  render();

  let saved = false;
  try {
    const inputState = clone(getState());
    const computedState = clone(getComputedState());
    const summary = buildDaySummary(inputState, computedState);
    const result = await saveWorkDaySnapshot({
      workDayId: workDayState.workDay.id,
      inputState,
      computedState,
      summary,
    });

    workDayState = {
      ...workDayState,
      saveStatus: "saved",
      lastSavedAt: result?.saved_at ?? new Date().toISOString(),
      workDay: {
        ...workDayState.workDay,
        last_snapshot_id: result?.snapshot_id ?? workDayState.workDay.last_snapshot_id,
        last_saved_at: result?.saved_at ?? workDayState.workDay.last_saved_at,
      },
      message: successMessage,
    };
    saved = true;
  } catch (error) {
    workDayState = {
      ...workDayState,
      saveStatus: "error",
      message: error.message || "Error al guardar.",
    };
  }

  render();
  return saved;
}

async function handleInitialDataLock(locked) {
  const state = getState();
  const role = activeRole();
  const currentlyLocked = state.accessControl.initialDataLocked;
  const permitted = locked
    ? canLockInitialData(role, currentlyLocked)
    : canUnlockInitialData(role, currentlyLocked);

  if (!permitted || editingHistoricalSnapshot()) {
    rejectUnauthorizedChange();
    return;
  }
  if (!locked && !window.confirm("¿Desea desbloquear los datos iniciales?")) return;
  if (workDayState.saveStatus === "saving" || !workDayState.workDay?.id) {
    workDayState = {
      ...workDayState,
      message: "No es posible cambiar el bloqueo mientras el día no está listo.",
    };
    render();
    return;
  }

  setInitialDataLocked(locked);
  const saved = await handleSaveWorkDay(
    locked
      ? "Datos iniciales bloqueados y guardados."
      : "Datos iniciales desbloqueados y guardados.",
  );
  if (!saved) setInitialDataLocked(currentlyLocked);
}

async function handleDietLock(dietId, locked) {
  const state = getState();
  const role = activeRole();
  const currentlyLocked = state.accessControl.dietLocks[dietId];
  const permitted = locked
    ? canLockDiet(role, currentlyLocked)
    : canUnlockDiet(role, currentlyLocked);

  if (!Object.hasOwn(state.accessControl.dietLocks, dietId) || !permitted || editingHistoricalSnapshot()) {
    rejectUnauthorizedChange();
    return;
  }
  if (!locked && !window.confirm("¿Desea desbloquear la dieta?")) return;
  if (workDayState.saveStatus === "saving" || !workDayState.workDay?.id) {
    workDayState = {
      ...workDayState,
      message: "No es posible cambiar el bloqueo mientras el día no está listo.",
    };
    render();
    return;
  }

  setDietLocked(dietId, locked);
  const saved = await handleSaveWorkDay(
    locked ? "Dieta bloqueada y guardada." : "Dieta desbloqueada y guardada.",
  );
  if (!saved) setDietLocked(dietId, currentlyLocked);
}

async function handleSaveRegistroHistory() {
  if (workDayState.historyStatus === "saving") return;
  if (!workDayState.workDay?.id) {
    workDayState = {
      ...workDayState,
      historyStatus: "error",
      message: "No hay un día activo para guardar en historial.",
    };
    render();
    return;
  }

  workDayState = { ...workDayState, historyStatus: "saving", message: "" };
  render();

  try {
    const inputState = clone(getState());
    const computedState = clone(getComputedState());
    const summary = buildRegistroHistorySummary(inputState, computedState);
    const result = await saveRegistroHistorySnapshot({
      workDayId: workDayState.workDay.id,
      inputState,
      computedState,
      summary,
    });

    workDayState = {
      ...workDayState,
      historyStatus: "saved",
      message: `Registro histórico guardado correctamente (${result?.saved_at ?? ""}).`,
    };
    historyState = {
      ...historyState,
      status: "idle",
      selectedSnapshot: null,
    };
  } catch (error) {
    workDayState = {
      ...workDayState,
      historyStatus: "error",
      message: error.message || "Error al guardar el registro histórico.",
    };
  }

  render();
}

async function handleLoadHistory() {
  if (historyState.status === "loading") return;

  historyState = { ...historyState, status: "loading", message: "" };
  render();

  try {
    const snapshots = await listRegistroHistorySnapshots();
    historyState = {
      ...historyState,
      status: "ready",
      snapshots,
      message: snapshots.length ? "" : "Todavía no hay días guardados en historial.",
    };
  } catch (error) {
    historyState = {
      ...historyState,
      status: "error",
      snapshots: [],
      message: error.message || "No se pudo cargar el historial.",
    };
  }

  render();
}

async function handleLoginSubmit(event) {
  const form = event.target?.closest?.("[data-auth-form='login']");
  if (!form) return;

  event.preventDefault();
  const formData = new FormData(form);
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  authState = { ...authState, loading: true, error: "" };
  render();

  try {
    authState = await signInWithPassword(email, password);
    if (authState.status === "authorized") {
      await initializeWorkDay();
      return;
    }
  } catch (error) {
    authState = {
      status: "signedOut",
      user: null,
      profile: null,
      client: null,
      error: error.message || "No se pudo iniciar sesion.",
      loading: false,
    };
  }

  render();
}

async function initializeAuth() {
  try {
    authState = await loadAuthorizedSession();
    if (authState.status === "authorized") {
      await initializeWorkDay();
      return;
    }
  } catch (error) {
    authState = {
      status: "signedOut",
      user: null,
      profile: null,
      client: null,
      error: error.message || "No se pudo validar la sesion.",
    };
  }

  render();
}

window.addEventListener("hashchange", render);
app.addEventListener("change", handleCommit);
app.addEventListener("input", handleHistoryFilter);
app.addEventListener("keydown", handleKeyDown);
app.addEventListener("click", handleClick);
app.addEventListener("submit", handleLoginSubmit);
subscribe(render);

render();
initializeAuth();








