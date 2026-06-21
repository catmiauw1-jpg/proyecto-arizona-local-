import { SHEETS } from "./domain/model.js?v=20260621-stage1-clean-all";
import { toNumber } from "./domain/formatters.js?v=20260621-stage1-clean-all";
import { appLayout } from "./components/layout.js?v=20260621-stage1-clean-all";
import { dietScreen } from "./screens/dietScreen.js?v=20260621-stage1-clean-all";
import { feedingScreen } from "./screens/feedingScreen.js?v=20260621-stage1-clean-all";
import { incomeScreen } from "./screens/incomeScreen.js?v=20260621-stage1-clean-all";
import { consumptionScreen } from "./screens/consumptionScreen.js?v=20260621-stage1-clean-all";
import { reportScreen } from "./screens/reportScreen.js?v=20260621-stage1-clean-all";
import {
  applyConsumptionFromCalculated,
  getComputedState,
  getState,
  subscribe,
  updateConfig,
  updateConsumption,
  updateDietField,
  updateIngredient,
  updateLot,
  updateTreatment,
} from "./state/store.js?v=20260621-stage1-clean-all";

const app = document.querySelector("#app");

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

function render() {
  const sheet = findSheet();
  const state = getState();
  const computed = getComputedState();

  app.innerHTML = appLayout({
    activeSheet: sheet.id,
    content: routeContent(sheet, state, computed),
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
  }

  if (command === "updateDiet") {
    const [, dietId, key, type] = parts;
    updateDietField(dietId, key, parseValue(event.target.value, type));
  }

  if (command === "updateIngredient") {
    const [, dietId, ingredientId, key, type] = parts;
    updateIngredient(dietId, ingredientId, key, parseValue(event.target.value, type));
  }

  if (command === "updateTreatment") {
    const [, dietId, treatmentNumber, key, type] = parts;
    updateTreatment(dietId, Number(treatmentNumber), key, parseValue(event.target.value, type));
  }

  if (command === "updateLot") {
    const [, lotId, key, type] = parts;
    updateLot(lotId, key, parseValue(event.target.value, type));
  }

  if (command === "updateConsumption") {
    const [, lotId, key, type] = parts;
    updateConsumption(lotId, key, parseValue(event.target.value, type));
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
  if (action !== "applyConsumptionFromCalculated") return;

  applyConsumptionFromCalculated(getComputedState().consumptionRows);
}

window.addEventListener("hashchange", render);
app.addEventListener("change", handleCommit);
app.addEventListener("keydown", handleKeyDown);
app.addEventListener("click", handleClick);
subscribe(render);

render();








