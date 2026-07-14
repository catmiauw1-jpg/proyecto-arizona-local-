import { SHEETS } from "./domain/model.js?v=20260621-stage1-clean-all";
import { toNumber } from "./domain/formatters.js?v=20260621-stage1-clean-all";
import { appLayout } from "./components/layout.js?v=20260621-stage1-clean-all";
import { dietScreen } from "./screens/dietScreen.js?v=20260621-stage1-clean-all";
import { feedingScreen } from "./screens/feedingScreen.js?v=20260621-stage1-clean-all";
import { incomeScreen } from "./screens/incomeScreen.js?v=20260621-stage1-clean-all";
import { consumptionScreen } from "./screens/consumptionScreen.js?v=20260621-stage1-clean-all";
import { reportScreen } from "./screens/reportScreen.js?v=20260621-stage1-clean-all";
import { loadingScreen, loginScreen } from "./screens/loginScreen.js?v=20260621-stage1-clean-all";
import { loadAuthorizedSession, signInWithPassword, signOut } from "./services/authService.js?v=20260621-stage1-clean-all";
import { loadActiveWorkDay, saveWorkDaySnapshot } from "./services/workDayService.js?v=20260621-stage1-clean-all";
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
  period: null,
  workDay: null,
  lastSavedAt: null,
  message: "",
};

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

function cleanStateFromWorkDay(period, workDay) {
  resetState({
    config: {
      clientName: authState.client?.name ?? "Confinamiento Arizona",
      startDate: period?.start_date ?? "",
      workDate: workDay?.work_date ?? "",
    },
  });
}

function applyLoadedWorkDay({ period, workDay, snapshot }) {
  if (snapshot?.input_state) {
    setState(snapshot.input_state);
  } else {
    cleanStateFromWorkDay(period, workDay);
  }

  workDayState = {
    status: "ready",
    saveStatus: snapshot ? "saved" : "ready",
    period,
    workDay,
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
      period: null,
      workDay: null,
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

  app.innerHTML = appLayout({
    activeSheet: sheet.id,
    content: routeContent(sheet, state, computed),
    sessionContext: authState,
    workDayContext: workDayState,
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

  if (action === "authSignOut") {
    authState = { ...authState, status: "loading" };
    workDayState = { status: "idle", saveStatus: "ready", period: null, workDay: null, lastSavedAt: null, message: "" };
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
app.addEventListener("keydown", handleKeyDown);
app.addEventListener("click", handleClick);
app.addEventListener("submit", handleLoginSubmit);
subscribe(render);

render();
initializeAuth();








