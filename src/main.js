import { SHEETS } from "./domain/model.js?v=20260723-phase-e";
import { toNumber } from "./domain/formatters.js?v=20260621-stage1-clean-all";
import {
  calculateState,
  recalculateReportRow,
} from "./domain/calculations.js?v=20260727-active-lots-v1";
import { buildNextWorkDayState } from "./domain/dayRollover.js?v=20260726-desktop-sqlite-v1";
import { appLayout } from "./components/layout.js?v=20260723-excel-parity-v1";
import { dietScreen } from "./screens/dietScreen.js?v=20260723-excel-parity-v1";
import { feedingScreen } from "./screens/feedingScreen.js?v=20260727-active-lots-v1";
import { incomeScreen } from "./screens/incomeScreen.js?v=20260727-active-lots-v1";
import { consumptionScreen } from "./screens/consumptionScreen.js?v=20260723-excel-parity-v1";
import { reportScreen } from "./screens/reportScreen.js?v=20260723-report-history-v1";
import { historyScreen } from "./screens/historyScreen.js?v=20260727-history-delete-v1";
import { licenseScreen } from "./screens/licenseScreen.js?v=20260723-phase-e";
import { loadingScreen, loginScreen } from "./screens/loginScreen.js?v=20260621-stage1-clean-all";
import { loadAuthorizedSession, signInWithPassword, signOut } from "./services/authService.js?v=20260621-stage1-clean-all";
import {
  closeWorkDayAndStartNext,
  deleteRegistroHistorySnapshot,
  listRegistroHistorySnapshots,
  loadActiveWorkDay,
  saveRegistroHistorySnapshot,
  saveWorkDaySnapshot,
} from "./services/workDayService.js?v=20260727-history-delete-v1";
import {
  applyConsumptionFromCalculated,
  clearReportOverrides,
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
  updateReportOverride,
  updateTreatmentIngredientActual,
  updateTreatment,
} from "./state/store.js?v=20260727-active-lots-v1";
import {
  createAuthRuntimeState,
  createHistoryRuntimeState,
  createWorkDayRuntimeState,
} from "./state/runtimeState.js?v=20260723-phase-e";
import {
  changeLocalLicenseScenario,
  getLicenseEvaluation,
  getLocalLicenseScenario,
  initializeLocalLicense,
  licenseAllowsOperations,
  resetLicenseRuntime,
} from "./services/localLicenseService.js?v=20260723-phase-e";
import {
  canDeleteHistory,
  canEditConsumptionNotes,
  canEditDiet,
  canEditFeedingActuals,
  canEditHistory,
  canEditIncomeConfig,
  canEditLotField,
  canEditReport,
  canEditTreatmentConfig,
  canEditTreatmentIngredientLoads,
  canLockDiet,
  canLockInitialData,
  canSaveHistory,
  canSaveWorkDay,
  canUnlockDiet,
  canUnlockInitialData,
  canViewHistory,
  canViewDietConfiguration,
  isLocalDevelopmentHost,
  normalizeRole,
  resolveOperationalRole,
} from "./domain/permissions.js?v=20260727-history-delete-v1";
import {
  buildDaySummary,
  buildRegistroHistorySummary,
} from "./domain/snapshotSummaries.js?v=20260723-phase-d";
const app = document.querySelector("#app");
const localRoleToolEnabled = isLocalDevelopmentHost(window.location.hostname);
let localRoleOverride = null;
let authState = createAuthRuntimeState();
let workDayState = createWorkDayRuntimeState();
let historyState = createHistoryRuntimeState();
let selectedFeedingTreatments = {
  ADAPTACION: 1,
  TRANSICION: 1,
  TERMINACION: 1,
};
const EDITABLE_REPORT_FIELDS = new Set([
  "pen",
  "currentDiet",
  "dietName",
  "lotCode",
  "animalCount",
  "estimatedWeight",
  "cmoLot",
  "cmoAnimal",
  "cmsLot",
  "cmsAnimal",
  "imsPct",
  "nutritionalCostAnimal",
]);
const EDITABLE_CONFIG_FIELDS = new Set([
  "clientName",
  "startDate",
  "activeLotCount",
]);

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
  if (type === "percentInteger") {
    return Math.round(toNumber(value)) / 100;
  }
  if (type === "percentInput") {
    return toNumber(value) / 100;
  }
  if (type === "number" || type === "percent" || type === "currency" || type === "integer") {
    return toNumber(value);
  }
  return value;
}

function activeRole() {
  return localRoleOverride ?? normalizeRole(authState.profile?.role);
}

function buildPermissionContext(state, sheet = findSheet()) {
  const license = getLicenseEvaluation();
  return {
    role: resolveOperationalRole(activeRole(), license.status),
    authenticatedRole: activeRole(),
    license,
    initialDataLocked: state.accessControl.initialDataLocked,
    dietLocked: sheet.dietId ? state.accessControl.dietLocks[sheet.dietId] === true : false,
  };
}

function routeContent(sheet, state, computed, permissionContext) {
  if (sheet.kind === "license") return licenseScreen(permissionContext.license);
  if (sheet.id === "Ingreso") return incomeScreen(state, computed, permissionContext);
  if (sheet.kind === "diet") {
    if (!canViewDietConfiguration(permissionContext.role)) {
      return '<div class="history-message">Este módulo está reservado para el administrador.</div>';
    }
    return dietScreen(sheet, state, computed, permissionContext);
  }
  if (sheet.kind === "feeding") {
    return feedingScreen(sheet, state, computed, {
      ...permissionContext,
      selectedTreatmentNumber: selectedFeedingTreatments[sheet.dietId] ?? 1,
    });
  }
  if (sheet.kind === "consumption") return consumptionScreen(computed, permissionContext);
  if (sheet.kind === "report") {
    return reportScreen(computed, {
      snapshots: historyState.snapshots,
      historyStatus: historyState.status,
      workDate: state.config.workDate || workDayState.workDate,
      editable: canEditReport(permissionContext.role),
      canSaveWorkDay: canSaveWorkDay(permissionContext.role),
      canCloseWorkDay: canSaveHistory(permissionContext.role),
      saveStatus: workDayState.saveStatus,
      closeStatus: workDayState.historyStatus,
    });
  }
  if (sheet.kind === "history" && canViewHistory(permissionContext.role)) {
    return historyScreen(historyState, permissionContext);
  }
  return "";
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function updateHistoricalDraftRow(rowIndex, key, value) {
  const rows = historyState.draftComputedState?.reportRows;
  if (!Array.isArray(rows) || !Number.isInteger(rowIndex) || !rows[rowIndex]) {
    return false;
  }
  if (!EDITABLE_REPORT_FIELDS.has(key)) return false;

  historyState = {
    ...historyState,
    draftComputedState: {
      ...historyState.draftComputedState,
      reportRows: rows.map((row, index) =>
        index === rowIndex
          ? recalculateReportRow({ ...row, [key]: value }, key)
          : row,
      ),
    },
    message: "",
  };
  render();
  return true;
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
    ["history", "report"].includes(sheet.kind) &&
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
      role: permissionContext.authenticatedRole,
      localToolEnabled: localRoleToolEnabled,
      licenseScenario: getLocalLicenseScenario(),
    },
    licenseContext: permissionContext.license,
  });
}

function rejectUnauthorizedChange() {
  workDayState = {
    ...workDayState,
    message: "Acción no permitida para el rol activo.",
  };
  render();
}

function rejectLicenseChange() {
  workDayState = {
    ...workDayState,
    message: getLicenseEvaluation().message || "La licencia no permite realizar esta acción.",
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

  if (command === "setLocalLicenseScenario") {
    const result = changeLocalLicenseScenario(event.target.value, {
      clientName: authState.client?.name,
      localToolEnabled: localRoleToolEnabled,
    });
    if (!result.changed) {
      rejectUnauthorizedChange();
      return;
    }

    historyState = { ...historyState, selectedSnapshot: null };
    if (!result.evaluation.operationalAccess) window.location.hash = "#/LICENCIA";
    render();
    return;
  }

  if (!licenseAllowsOperations()) {
    rejectLicenseChange();
    return;
  }

  if (
    editingHistoricalSnapshot() &&
    (command !== "updateHistoricalReport" || !canEditHistory(role))
  ) {
    rejectUnauthorizedChange();
    return;
  }

  if (command === "updateHistoricalReport") {
    const [, rowIndex, key, type] = parts;
    const changed = updateHistoricalDraftRow(
      Number(rowIndex),
      key,
      parseValue(event.target.value, type),
    );
    if (!changed) rejectUnauthorizedChange();
    return;
  }

  if (command === "updateReportOverride") {
    const [, lotId, key, type] = parts;
    if (
      !canEditReport(role) ||
      !EDITABLE_REPORT_FIELDS.has(key) ||
      !state.lots.some((lot) => lot.id === lotId)
    ) {
      rejectUnauthorizedChange();
      return;
    }
    updateReportOverride(lotId, key, parseValue(event.target.value, type));
    markUnsaved();
    return;
  }

  if (command === "updateConfig") {
    const [, key, type] = parts;
    if (
      !canEditIncomeConfig(role) ||
      !EDITABLE_CONFIG_FIELDS.has(key)
    ) {
      rejectUnauthorizedChange();
      return;
    }
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

  if (command === "updateTreatmentIngredientActual") {
    const [, dietId, treatmentNumber, ingredientId, type] = parts;
    if (!canEditTreatmentIngredientLoads(role)) {
      rejectUnauthorizedChange();
      return;
    }
    updateTreatmentIngredientActual(
      dietId,
      Number(treatmentNumber),
      ingredientId,
      event.target.value.trim() === "" ? null : parseValue(event.target.value, type),
      event.target.dataset.calculatedValue,
    );
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

function handleSignOut() {
  localRoleOverride = null;
  selectedFeedingTreatments = {
    ADAPTACION: 1,
    TRANSICION: 1,
    TERMINACION: 1,
  };
  resetLicenseRuntime();
  authState = { ...authState, status: "loading" };
  workDayState = createWorkDayRuntimeState();
  historyState = createHistoryRuntimeState();
  render();
  signOut()
    .catch(() => {})
    .finally(() => {
      resetState();
      authState = createAuthRuntimeState({ status: "signedOut" });
      render();
    });
}

function handleClick(event) {
  const action = event.target?.closest("[data-action]")?.dataset?.action;
  if (!action || ["setLocalRole", "setLocalLicenseScenario"].includes(action)) return;
  if (action.startsWith("selectFeedingTreatment:")) {
    const [, dietId, treatmentNumber] = action.split(":");
    const nextTreatmentNumber = Number(treatmentNumber);
    if (
      !["ADAPTACION", "TRANSICION", "TERMINACION"].includes(dietId) ||
      !Number.isInteger(nextTreatmentNumber) ||
      nextTreatmentNumber < 1 ||
      nextTreatmentNumber > 5
    ) {
      return;
    }
    selectedFeedingTreatments = {
      ...selectedFeedingTreatments,
      [dietId]: nextTreatmentNumber,
    };
    render();
    return;
  }
  if (action === "authSignOut") {
    handleSignOut();
    return;
  }
  if (!licenseAllowsOperations()) {
    rejectLicenseChange();
    return;
  }

  const role = activeRole();

  if (action === "clearReportOverrides") {
    if (!canEditReport(role) || editingHistoricalSnapshot()) {
      rejectUnauthorizedChange();
      return;
    }
    clearReportOverrides();
    markUnsaved();
    return;
  }

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

  if (action === "closeWorkDay") {
    if (!canSaveHistory(role) || editingHistoricalSnapshot()) {
      rejectUnauthorizedChange();
      return;
    }
    void handleCloseWorkDay();
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

  if (action?.startsWith("deleteHistorySnapshot:")) {
    if (!canDeleteHistory(role)) {
      rejectUnauthorizedChange();
      return;
    }
    const [, snapshotId] = action.split(":");
    const snapshot = historyState.snapshots.find((item) => item.id === snapshotId);
    if (!snapshot || snapshot.snapshot_type !== "registro_history") {
      historyState = {
        ...historyState,
        message: "El registro historico seleccionado ya no esta disponible.",
      };
      render();
      return;
    }
    if (historyState.deleteStatus === "deleting") return;

    const workDate = snapshot.summary?.workDate ?? "seleccionado";
    const confirmed = window.confirm(
      `¿Eliminar el registro historico del ${workDate}? Esta accion no se puede deshacer.`,
    );
    if (!confirmed) return;

    void handleDeleteHistorySnapshot(snapshotId, role);
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
      draftComputedState: null,
      isEditing: false,
      saveStatus: "ready",
      message: "",
    };
    render();
    return;
  }

  if (action === "startHistoryCorrection") {
    if (!canEditHistory(role) || !historyState.selectedSnapshot) {
      rejectUnauthorizedChange();
      return;
    }
    historyState = {
      ...historyState,
      draftComputedState: clone(
        historyState.selectedSnapshot.computed_state ?? { reportRows: [] },
      ),
      isEditing: true,
      saveStatus: "ready",
      message: "",
    };
    render();
    return;
  }

  if (action === "cancelHistoryCorrection") {
    if (!canEditHistory(role)) {
      rejectUnauthorizedChange();
      return;
    }
    historyState = {
      ...historyState,
      draftComputedState: null,
      isEditing: false,
      saveStatus: "ready",
      message: "",
    };
    render();
    return;
  }

  if (action === "saveHistoryCorrection") {
    if (!canEditHistory(role)) {
      rejectUnauthorizedChange();
      return;
    }
    void handleSaveHistoryCorrection();
    return;
  }

  if (action === "closeHistorySnapshot") {
    historyState = {
      ...historyState,
      selectedSnapshot: null,
      draftComputedState: null,
      isEditing: false,
      saveStatus: "ready",
      message: "",
    };
    window.location.hash = "#/Ingreso";
    render();
    return;
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
  if (!licenseAllowsOperations()) {
    rejectLicenseChange();
    return false;
  }
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
  if (!licenseAllowsOperations()) {
    rejectLicenseChange();
    return;
  }
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
  if (!licenseAllowsOperations()) {
    rejectLicenseChange();
    return;
  }
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
  if (!licenseAllowsOperations()) {
    rejectLicenseChange();
    return;
  }
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

async function handleCloseWorkDay() {
  if (!licenseAllowsOperations()) {
    rejectLicenseChange();
    return;
  }
  if (
    workDayState.historyStatus === "saving" ||
    !workDayState.workDay?.id
  ) {
    return;
  }

  const currentState = clone(getState());
  const currentDate =
    currentState.config?.workDate ?? workDayState.workDay.work_date;
  const confirmed = window.confirm(
    `Se cerrará el día ${currentDate} y se abrirá el día siguiente. ` +
      "El registro cerrado quedará guardado en HISTORIAL. ¿Desea continuar?",
  );
  if (!confirmed) return;

  workDayState = {
    ...workDayState,
    historyStatus: "saving",
    message: "",
  };
  render();

  try {
    const currentComputed = clone(getComputedState());
    const currentSummary = buildRegistroHistorySummary(
      currentState,
      currentComputed,
    );
    const nextInputState = buildNextWorkDayState(currentState);
    const nextComputedState = calculateState(nextInputState);
    const nextSummary = buildDaySummary(
      nextInputState,
      nextComputedState,
    );
    const result = await closeWorkDayAndStartNext({
      workDayId: workDayState.workDay.id,
      inputState: currentState,
      computedState: currentComputed,
      summary: currentSummary,
      nextInputState,
      nextComputedState,
      nextSummary,
    });
    const nextSnapshot = result?.next_snapshot;
    const nextWorkDay = result?.next_work_day;
    const loadedNextState = nextSnapshot?.input_state ?? nextInputState;

    setState(loadedNextState);
    workDayState = {
      ...workDayState,
      status: "ready",
      saveStatus: "saved",
      historyStatus: "saved",
      workDay: nextWorkDay,
      workDate: nextWorkDay?.work_date ?? loadedNextState.config.workDate,
      lastSavedAt: nextSnapshot?.saved_at ?? result?.saved_at ?? null,
      message: result?.already_closed
        ? "El día ya estaba cerrado. Se recuperó el día activo."
        : `Día ${currentDate} cerrado correctamente. Ya puede trabajar en ${loadedNextState.config.workDate}.`,
    };
    historyState = {
      ...createHistoryRuntimeState(),
      status: "idle",
    };
    selectedFeedingTreatments = {
      ADAPTACION: 1,
      TRANSICION: 1,
      TERMINACION: 1,
    };
    window.location.hash = "#/Ingreso";
  } catch (error) {
    workDayState = {
      ...workDayState,
      historyStatus: "error",
      message: error.message || "No se pudo cerrar el día.",
    };
  }

  render();
}

async function handleSaveHistoryCorrection() {
  const snapshot = historyState.selectedSnapshot;
  const draftComputedState = historyState.draftComputedState;
  if (
    historyState.saveStatus === "saving" ||
    !historyState.isEditing ||
    !snapshot ||
    !draftComputedState
  ) {
    return;
  }

  historyState = { ...historyState, saveStatus: "saving", message: "" };
  render();

  try {
    const inputState = clone(
      snapshot.input_state ?? {
        config: {
          clientName: authState.client?.name ?? "Confinamiento Arizona",
          workDate: snapshot.summary?.workDate ?? "",
        },
      },
    );
    inputState.config = {
      ...(inputState.config ?? {}),
      workDate: snapshot.summary?.workDate ?? inputState.config?.workDate ?? "",
    };
    const computedState = clone(draftComputedState);
    const summary = {
      ...buildRegistroHistorySummary(inputState, computedState),
      correctionOf: snapshot.id,
      correctedAt: new Date().toISOString(),
    };
    const result = await saveRegistroHistorySnapshot({
      workDayId: snapshot.work_day_id,
      inputState,
      computedState,
      summary,
    });
    const snapshots = await listRegistroHistorySnapshots(
      workDayState.period?.id ?? snapshot.period_id,
    );

    historyState = {
      ...historyState,
      status: "ready",
      saveStatus: "saved",
      snapshots,
      selectedSnapshot: snapshots.find(
        (item) => item.id === result?.snapshot_id,
      ) ?? null,
      draftComputedState: null,
      isEditing: false,
      message: "Corrección guardada como un nuevo registro; el original se conservó.",
    };
  } catch (error) {
    historyState = {
      ...historyState,
      saveStatus: "error",
      message: error.message || "No se pudo guardar la corrección histórica.",
    };
  }

  render();
}

async function handleDeleteHistorySnapshot(snapshotId, actorRole) {
  const snapshot = historyState.snapshots.find((item) => item.id === snapshotId);
  if (!snapshot || historyState.deleteStatus === "deleting") return;

  historyState = {
    ...historyState,
    deleteStatus: "deleting",
    deletingSnapshotId: snapshotId,
    message: "",
  };
  render();

  try {
    const periodId = workDayState.period?.id ?? snapshot.period_id;
    await deleteRegistroHistorySnapshot({ snapshotId, periodId, actorRole });
    const snapshots = await listRegistroHistorySnapshots(periodId);
    const deletedSelectedSnapshot = historyState.selectedSnapshot?.id === snapshotId;

    historyState = {
      ...historyState,
      status: "ready",
      snapshots,
      selectedSnapshot: deletedSelectedSnapshot ? null : historyState.selectedSnapshot,
      draftComputedState: deletedSelectedSnapshot ? null : historyState.draftComputedState,
      isEditing: deletedSelectedSnapshot ? false : historyState.isEditing,
      deleteStatus: "ready",
      deletingSnapshotId: null,
      message: "Registro histórico eliminado correctamente.",
    };
  } catch (error) {
    historyState = {
      ...historyState,
      deleteStatus: "error",
      deletingSnapshotId: null,
      message: error.message || "No se pudo eliminar el registro historico.",
    };
  }

  render();
}

async function handleLoadHistory() {
  if (!licenseAllowsOperations()) {
    rejectLicenseChange();
    return;
  }
  if (historyState.status === "loading") return;

  historyState = { ...historyState, status: "loading", message: "" };
  render();

  try {
    const snapshots = await listRegistroHistorySnapshots(
      workDayState.period?.id,
    );
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
      initializeLocalLicense({
        clientName: authState.client?.name,
        localToolEnabled: localRoleToolEnabled,
      });
      await initializeWorkDay();
      if (!licenseAllowsOperations()) window.location.hash = "#/LICENCIA";
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
      initializeLocalLicense({
        clientName: authState.client?.name,
        localToolEnabled: localRoleToolEnabled,
      });
      await initializeWorkDay();
      if (!licenseAllowsOperations()) window.location.hash = "#/LICENCIA";
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
