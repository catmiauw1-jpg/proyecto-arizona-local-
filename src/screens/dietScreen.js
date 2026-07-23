import { INGREDIENT_COLUMNS } from "../domain/model.js?v=20260621-stage1-clean-all";
import { formatCurrency, formatPercent } from "../domain/formatters.js?v=20260621-stage1-clean-all";
import { metricGrid, screenHeader, section, statusPill } from "../components/layout.js?v=20260723-phase-d";
import { dataTable, simpleTable } from "../components/table.js?v=20260723-phase-d";

const EXCEL_DIET_COLUMNS = [
  { key: "name", label: "INSUMOS", type: "text", input: true },
  { key: "dryMatterPct", label: "%MS", type: "percent", input: true },
  { key: "inclusionMsPct", label: "%INCLUSIÓN EN MS", type: "percent", input: true },
  { key: "normalizedMoPct", label: "%INCLUSIÓN EN M.O", type: "percent", input: false },
  { key: "dietDryMatterPct", label: "%MS DIETA", type: "percent", input: false },
  { key: "costBsTon", label: "Costo (Bs/ton)", type: "currency", input: true },
  { key: "costContributionBsTon", label: "Costo (Bs/ton)", type: "currency", input: false },
];

import {
  canEditDiet,
  canLockDiet,
  canUnlockDiet,
} from "../domain/permissions.js?v=20260723-phase-d";
import { escapeHtml } from "../domain/html.js?v=20260723-history-validation";

export function dietScreen(sheet, state, computed, permissionContext = {}) {
  const { role, dietLocked = false } = permissionContext;
  const diet = computed.diets[sheet.dietId];
  const rawDiet = state.diets[sheet.dietId];
  const usesExcelDietColumns = sheet.id === "ADAPT" || sheet.id === "TRANS" || sheet.id === "TERM";
  const ingredientColumns = usesExcelDietColumns ? EXCEL_DIET_COLUMNS : INGREDIENT_COLUMNS;
  const totalHeaders = usesExcelDietColumns
    ? ["Total MS", "Total MO", "Inclusión M.O", "MS Dieta", "Costo dieta"]
    : ["Total MS", "Total MO", "Total inclusion M.O", "MS dieta", "Costo Bs/ton"];

  const header = screenHeader({
    eyebrow: `Modulo ${sheet.id}`,
    title: rawDiet.title,
    description: "Gestiona ingredientes, costos y resultados calculados de la dieta.",
    actions: canLockDiet(role, dietLocked)
      ? `<button class="primary-action" type="button" data-action="lockDiet:${sheet.dietId}">Guardar y bloquear dieta</button>`
      : canUnlockDiet(role, dietLocked)
        ? `<button class="secondary-action" type="button" data-action="unlockDiet:${sheet.dietId}">Desbloquear dieta</button>`
        : "",
  });

  const lockStatus = `
    <div class="lock-banner ${dietLocked ? "is-locked" : "is-editable"}">
      <strong>${dietLocked ? "Dieta bloqueada" : "Dieta editable"}</strong>
      <span>
        ${
          dietLocked
            ? "La configuración requiere desbloqueo administrativo para modificarse."
            : "La configuración todavía no fue bloqueada."
        }
      </span>
    </div>
  `;

  const metrics = metricGrid([
    { label: "MS dieta", value: formatPercent(diet.totals.dietDryMatterPct) },
    { label: "Costo dieta", value: formatCurrency(diet.totals.costBsTon) },
    { label: "Costo kg", value: formatCurrency(diet.totals.costBsKg) },
    { label: "Inclusion MS", value: `${formatPercent(diet.totals.totalInclusionMsPct)} ${statusPill(diet.totals.status)}` },
  ]);

  const setup = `
    <div class="form-grid small">
      <label>
        <span>Consumo</span>
        <span class="locked-field">${escapeHtml(rawDiet.consumption)}</span>
      </label>
      <label>
        <span>GMD estimado</span>
        <span class="locked-field">${escapeHtml(rawDiet.estimatedGmd)}</span>
      </label>
    </div>
  `;

  const table = dataTable({
    columns: ingredientColumns,
    rows: diet.rows,
    rowId: (row) => row.id,
    actionPrefix: `updateIngredient:${sheet.dietId}`,
    isEditable: () => canEditDiet(role, dietLocked),
  });

  const totals = simpleTable(
    totalHeaders,
    [
      [
        formatPercent(diet.totals.totalInclusionMsPct),
        formatPercent(diet.totals.totalInclusionMoPct),
        formatPercent(diet.totals.normalizedMoPct),
        formatPercent(diet.totals.dietDryMatterPct),
        formatCurrency(diet.totals.costBsTon),
      ],
    ],
    { compact: true },
  );

  return `
    ${header}
    ${lockStatus}
    ${metrics}
    ${section("Parametros de dieta", setup)}
    ${section("Ingredientes", table)}
    ${section("Totales calculados", totals)}
  `;
}






