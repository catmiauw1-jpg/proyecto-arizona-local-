import { DIET_LABELS, LOT_COLUMNS } from "../domain/model.js?v=20260723-phase-e";
import { formatCell, formatNumber } from "../domain/formatters.js?v=20260621-stage1-clean-all";
import { metricGrid, screenHeader, section } from "../components/layout.js?v=20260723-phase-e";
import { dataTable, simpleTable } from "../components/table.js?v=20260723-phase-d";

import {
  canEditIncomeConfig,
  canEditLotField,
  canLockInitialData,
  canUnlockInitialData,
} from "../domain/permissions.js?v=20260723-phase-e";
import { escapeHtml } from "../domain/html.js?v=20260723-history-validation";
import { valueInput } from "../components/fields.js?v=20260723-phase-d";

export function incomeScreen(state, computed, permissionContext = {}) {
  const { role, initialDataLocked = false } = permissionContext;
  const columns = LOT_COLUMNS.map((column) =>
    column.key === "currentDiet" ? { ...column, options: ["", ...DIET_LABELS] } : column,
  );

  const totalAnimals = computed.lots.reduce((total, lot) => total + Number(lot.animalCount || 0), 0);
  const totalMs = computed.lots.reduce((total, lot) => total + lot.totalFeedMs, 0);
  const totalMo = computed.lots.reduce((total, lot) => total + lot.totalFeedMo, 0);

  const header = screenHeader({
    eyebrow: "Modulo Ingreso",
    title: "Ingreso de lotes y calculo inicial",
    description: "Edita los datos de lotes y revisa los resultados iniciales.",
    actions: canLockInitialData(role, initialDataLocked)
      ? '<button class="primary-action" type="button" data-action="lockInitialData">Guardar y bloquear datos iniciales</button>'
      : canUnlockInitialData(role, initialDataLocked)
        ? '<button class="secondary-action" type="button" data-action="unlockInitialData">Desbloquear datos iniciales</button>'
        : "",
  });

  const lockStatus = `
    <div class="lock-banner ${initialDataLocked ? "is-locked" : "is-editable"}">
      <strong>${initialDataLocked ? "Datos iniciales bloqueados" : "Datos iniciales editables"}</strong>
      <span>
        ${
          initialDataLocked
            ? "Los datos de ingreso requieren desbloqueo administrativo para modificarse."
            : "Los datos de ingreso pueden registrarse antes del bloqueo."
        }
      </span>
    </div>
  `;

  const configEditable = canEditIncomeConfig(role);
  const config = `
    <div class="form-grid">
      <label>
        <span>Cliente</span>
        ${valueInput({
          value: state.config.clientName,
          type: "text",
          onInput: "updateConfig:clientName:text",
          disabled: !configEditable,
        })}
      </label>
      <label>
        <span>Fecha inicial</span>
        ${valueInput({
          value: state.config.startDate,
          type: "date",
          onInput: "updateConfig:startDate:date",
          disabled: !configEditable,
        })}
      </label>
      <label>
        <span>Fecha de trabajo</span>
        <span class="locked-field">${escapeHtml(state.config.workDate)}</span>
      </label>
    </div>
  `;

  const metrics = metricGrid([
    { label: "Animales", value: formatCell(totalAnimals, "integer") },
    { label: "Total alimento MS", value: formatNumber(totalMs) },
    { label: "Total alimento MO", value: formatNumber(totalMo) },
    { label: "Piquetes activos", value: formatCell(computed.lots.length, "integer") },
  ]);

  const lotsTable = dataTable({
    columns,
    rows: computed.lots,
    rowId: (row) => row.id,
    actionPrefix: "updateLot",
    isEditable: ({ column }) => canEditLotField(role, initialDataLocked, column.key),
  });

  const animalConsumptionColumns = [
    { key: "pen", label: "Piquete", input: false, role: "locked", type: "text" },
    { key: "lotCode", label: "Lote", input: false, role: "locked", type: "text" },
    { key: "consumptionAdjustmentPct", label: "Ajuste de Consumo", input: true, type: "percent" },
    { key: "cmsPerAnimal", label: "CMS/ Animal", input: false, type: "number" },
    { key: "cmoPerAnimal", label: "CMO/ Animal", input: false, type: "number" },
    { key: "cmsPctAnimal", label: "%CMS/ Animal", input: false, type: "percent" },
  ];

  const animalConsumptionTable = `
    <div class="animal-consumption-table">
      ${dataTable({
        columns: animalConsumptionColumns,
        rows: computed.lots,
        rowId: (row) => row.id,
        actionPrefix: "updateLot",
        compact: true,
        isEditable: ({ column }) => canEditLotField(role, initialDataLocked, column.key),
      })}
    </div>
  `;

  const dietTotals = simpleTable(
    ["Dieta", "Cantidad kg/MS", "Cantidad kg/MO", "%MS"],
    DIET_LABELS.map((dietId) => [
      dietId,
      formatNumber(computed.dietTotals[dietId].totalFeedMs),
      formatNumber(computed.dietTotals[dietId].totalFeedMo),
      formatCell(computed.diets[dietId].totals.dietDryMatterPct, "percent"),
    ]),
    { compact: true },
  );

  return `
    ${header}
    ${lockStatus}
    ${section("Datos generales", config)}
    ${metrics}
    ${section("Lotes / piquetes", lotsTable)}
    ${section("Consumo por animal", animalConsumptionTable)}
    ${section("Resumen por dieta", dietTotals)}
  `;
}







