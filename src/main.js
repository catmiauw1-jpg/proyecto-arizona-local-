import { SHEETS } from "./domain/model.js?v=20260621-stage1-clean-all";
import { toNumber } from "./domain/formatters.js?v=20260621-stage1-clean-all";
import { appLayout } from "./components/layout.js?v=20260621-stage1-clean-all";
import { dietScreen } from "./screens/dietScreen.js?v=20260621-stage1-clean-all";
import { feedingScreen } from "./screens/feedingScreen.js?v=20260621-stage1-clean-all";
import { incomeScreen } from "./screens/incomeScreen.js?v=20260621-stage1-clean-all";
import { consumptionScreen } from "./screens/consumptionScreen.js?v=20260621-stage1-clean-all";
import { reportScreen } from "./screens/reportScreen.js?v=20260621-stage1-clean-all";
import { historyScreen } from "./screens/historyScreen.js?v=20260621-stage1-clean-all";
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
  setState,
  subscribe,
  updateConfig,
  updateConsumption,
  updateDietField,
  updateFeedingActual,
  updateIngredient,
  updateLot,
  updateTreatment,
} from "./state/store.js?v=20260621-stage1-clean-all";

const app = document.querySelector("#app");
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

function routeContent(sheet, state, computed) {
  if (sheet.id === "Ingreso") return incomeScreen(state, computed);
  if (sheet.kind === "diet") return dietScreen(sheet, state, computed);
  if (sheet.kind === "feeding") return feedingScreen(sheet, state, computed);
  if (sheet.kind === "consumption") return consumptionScreen(computed);
  if (sheet.kind === "report") return reportScreen(computed);
  if (sheet.kind === "history") return historyScreen(historyState);
  return "";
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildDaySummary(state, computed) {
  const totalAnimals = computed.lots.reduce((total, lot) => total + Number(lot.animalCount || 0), 0);
  const totalFeedMs = computed.lots.reduce((total, lot) => total + Number(lot.totalFeedMs || 0), 0);
  const totalFeedMo = computed.lots.reduce((total, lot) => total + Number(lot.totalFeedMo || 0), 0);
  const totalFinancial = computed.reportRows.reduce((total, row) => total + Number(row.financialTotal || 0), 0);
  const activeLots = computed.lots.filter(
    (lot) => lot.lotCode || Number(lot.animalCount || 0) > 0 || lot.currentDiet,
  ).length;

  return {
    clientName: state.config.clientName,
    workDate: state.config.workDate,
    activeLots,
    totalAnimals,
    totalFeedMs,
    totalFeedMo,
    totalFinancial,
    diets: Object.fromEntries(
      Object.entries(computed.diets).map(([dietId, diet]) => [
        dietId,
        {
          status: diet.totals.status,
          treatmentStatus: diet.totals.treatmentStatus,
          dietDryMatterPct: diet.totals.dietDryMatterPct,
          costBsKg: diet.totals.costBsKg,
        },
      ]),
    ),
  };
}

function compactReportRows(reportRows) {
  return reportRows.map((row) => ({
    pen: row.pen,
    currentDiet: row.currentDiet,
    dietName: row.dietName,
    lotCode: row.lotCode,
    animalCount: Number(row.animalCount || 0),
    estimatedWeight: Number(row.estimatedWeight || 0),
    cmoLot: Number(row.cmoLot || 0),
    cmoAnimal: Number(row.cmoAnimal || 0),
    cmsLot: Number(row.cmsLot || 0),
    cmsAnimal: Number(row.cmsAnimal || 0),
    imsPct: Number(row.imsPct || 0),
    nutritionalCostAnimal: Number(row.nutritionalCostAnimal || 0),
    nutritionalCostLot: Number(row.nutritionalCostLot || 0),
    financialAverage: Number(row.financialAverage || 0),
    financialTotal: Number(row.financialTotal || 0),
  }));
}

function buildRegistroHistorySummary(state, computed) {
  const reportRows = compactReportRows(computed.reportRows);
  const activeRows = reportRows.filter(
    (row) => row.lotCode || row.animalCount > 0 || row.currentDiet,
  );

  return {
    clientName: state.config.clientName,
    workDate: state.config.workDate,
    activePens: activeRows.length,
    totalAnimals: reportRows.reduce((total, row) => total + row.animalCount, 0),
    totalCmsLot: reportRows.reduce((total, row) => total + row.cmsLot, 0),
    totalCmoLot: reportRows.reduce((total, row) => total + row.cmoLot, 0),
    totalNutritionalCost: reportRows.reduce((total, row) => total + row.nutritionalCostLot, 0),
    totalFinancial: reportRows.reduce((total, row) => total + row.financialTotal, 0),
    reportRows,
  };
}

function cleanStateFromWorkDay(period, workDay) {
  resetState({
    config: {
      clientName: authState.client?.name ?? "Confinamiento Arizona",
      startDate: period?.start_date ?? "",
      workDate: todayIsoDate(),
    },
  });
}

function applyLoadedWorkDay({ period, workDay, snapshot }) {
  if (snapshot?.input_state) {
    setState({
      ...snapshot.input_state,
      config: {
        ...(snapshot.input_state.config ?? {}),
        workDate: todayIsoDate(),
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
    workDate: getState().config.workDate,
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
  if (sheet.kind === "history" && historyState.status === "idle") {
    void handleLoadHistory();
  }

  const state = getState();
  const computed = getComputedState();

  app.innerHTML = appLayout({
    activeSheet: sheet.id,
    content: routeContent(sheet, state, computed),
    sessionContext: authState,
    workDayContext: {
      ...workDayState,
      isHistoryView: sheet.kind === "history" && Boolean(historyState.selectedSnapshot),
    },
  });
}

function handleCommit(event) {
  const action = event.target?.dataset?.action;
  if (!action) return;

  const parts = action.split(":");
  const command = parts[0];

  if (command === "updateConfig") {
    const [, key, type] = parts;
    updateConfig(key, parseValue(event.target.value, type));
    markUnsaved();
  }

  if (command === "updateDiet") {
    const [, dietId, key, type] = parts;
    updateDietField(dietId, key, parseValue(event.target.value, type));
    markUnsaved();
  }

  if (command === "updateIngredient") {
    const [, dietId, ingredientId, key, type] = parts;
    updateIngredient(dietId, ingredientId, key, parseValue(event.target.value, type));
    markUnsaved();
  }

  if (command === "updateTreatment") {
    const [, dietId, treatmentNumber, key, type] = parts;
    updateTreatment(dietId, Number(treatmentNumber), key, parseValue(event.target.value, type));
    markUnsaved();
  }

  if (command === "updateLot") {
    const [, lotId, key, type] = parts;
    updateLot(lotId, key, parseValue(event.target.value, type));
    markUnsaved();
  }

  if (command === "updateConsumption") {
    const [, lotId, key, type] = parts;
    updateConsumption(lotId, key, parseValue(event.target.value, type));
    markUnsaved();
  }

  if (command === "updateFeedingActual") {
    const [, dietId, lotId, treatmentNumber, type] = parts;
    updateFeedingActual(dietId, lotId, Number(treatmentNumber), parseValue(event.target.value, type));
    markUnsaved();
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

  if (action === "applyConsumptionFromCalculated") {
    applyConsumptionFromCalculated(getComputedState().consumptionRows);
    markUnsaved();
  }

  if (action === "saveWorkDay") {
    void handleSaveWorkDay();
  }

  if (action === "saveRegistroHistory") {
    void handleSaveRegistroHistory();
  }

  if (action === "loadHistory") {
    void handleLoadHistory();
  }

  if (action?.startsWith("openHistorySnapshot:")) {
    const [, snapshotId] = action.split(":");
    historyState = {
      ...historyState,
      selectedSnapshot: historyState.snapshots.find((snapshot) => snapshot.id === snapshotId) ?? null,
    };
    render();
  }

  if (action === "closeHistorySnapshot") {
    historyState = { ...historyState, selectedSnapshot: null };
    window.location.hash = "#/Ingreso";
    render();
  }

  if (action === "authSignOut") {
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

async function handleSaveWorkDay() {
  if (workDayState.saveStatus === "saving") return;
  if (!workDayState.workDay?.id) {
    workDayState = {
      ...workDayState,
      saveStatus: "error",
      message: "No hay un día activo para guardar.",
    };
    render();
    return;
  }

  workDayState = { ...workDayState, saveStatus: "saving", message: "" };
  render();

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
      message: "Guardado correctamente.",
    };
  } catch (error) {
    workDayState = {
      ...workDayState,
      saveStatus: "error",
      message: error.message || "Error al guardar.",
    };
  }

  render();
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








