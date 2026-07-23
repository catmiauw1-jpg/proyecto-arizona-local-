import { formatNumber, round } from "../domain/formatters.js?v=20260621-stage1-clean-all";
import { metricGrid, screenHeader, section } from "../components/layout.js?v=20260723-phase-d";
import { simpleTable } from "../components/table.js?v=20260723-phase-d";

import { valueInput } from "../components/fields.js?v=20260723-phase-d";
import { canEditConsumptionNotes } from "../domain/permissions.js?v=20260723-phase-d";
import { escapeHtml } from "../domain/html.js?v=20260723-history-validation";

function inputNumber(value) {
  if (value === "" || value === null || value === undefined) return "";
  return round(value, 2).toFixed(2);
}

export function consumptionScreen(computed, permissionContext = {}) {
  const editable = canEditConsumptionNotes(permissionContext.role);
  const totalExpectedMs = computed.consumptionRows.reduce((total, row) => total + row.expectedMs, 0);
  const totalRealizedMs = computed.consumptionRows.reduce((total, row) => total + row.realizedMs, 0);
  const totalExpectedMo = computed.consumptionRows.reduce((total, row) => total + row.expectedMo, 0);
  const totalRealizedMo = computed.consumptionRows.reduce((total, row) => total + row.realizedMo, 0);

  const header = screenHeader({
    eyebrow: "Modulo ANOTACION DE CONSUMO",
    title: "Anotacion de consumo",
    description: "Consolida previsto/realizado y permite capturar ajustes manuales por piquete.",
    actions: `
      <button
        class="primary-action"
        type="button"
        data-action="applyConsumptionFromCalculated"
        title="Copia los valores calculados a los campos editables"
        ${editable ? "" : 'disabled aria-disabled="true"'}
      >
        Copiar valores calculados
      </button>
    `,
  });

  const metrics = metricGrid([
    { label: "Previsto MS", value: formatNumber(totalExpectedMs) },
    { label: "Realizado MS", value: formatNumber(totalRealizedMs) },
    { label: "Previsto MO", value: formatNumber(totalExpectedMo) },
    { label: "Realizado MO", value: formatNumber(totalRealizedMo) },
  ]);

  const rows = computed.consumptionRows.map((row) => [
    escapeHtml(row.pen),
    escapeHtml(row.currentDiet),
    formatNumber(row.expectedMs),
    formatNumber(row.realizedMs),
    formatNumber(row.expectedMo),
    formatNumber(row.realizedMo),
    valueInput({
      value: inputNumber(row.msPlannedManual),
      type: "number",
      onInput: `updateConsumption:${row.lotId}:msPlannedManual:number`,
      disabled: !editable,
    }),
    valueInput({
      value: inputNumber(row.msRealizedManual),
      type: "number",
      onInput: `updateConsumption:${row.lotId}:msRealizedManual:number`,
      disabled: !editable,
    }),
    valueInput({
      value: inputNumber(row.moPlannedManual),
      type: "number",
      onInput: `updateConsumption:${row.lotId}:moPlannedManual:number`,
      disabled: !editable,
    }),
    valueInput({
      value: inputNumber(row.moRealizedManual),
      type: "number",
      onInput: `updateConsumption:${row.lotId}:moRealizedManual:number`,
      disabled: !editable,
    }),
  ]);

  const table = simpleTable(
    [
      "CORRAL",
      "DIETA ACTUAL",
      "PREVISTO MS",
      "REALIZADO MS",
      "PREVISTO MO",
      "REALIZADO MO",
      "MS / PREVISTO",
      "MS / REALIZADO",
      "MO / PREVISTO",
      "MO / REALIZADO",
    ],
    rows,
  );

  return `
    ${header}
    ${metrics}
    ${section("Consumo por piquete", table)}
  `;
}








