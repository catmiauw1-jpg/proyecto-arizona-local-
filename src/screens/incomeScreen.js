import { DIET_LABELS, LOT_COLUMNS } from "../domain/model.js?v=20260723-phase-e";
import { formatCell, formatNumber } from "../domain/formatters.js?v=20260621-stage1-clean-all";
import { metricGrid, screenHeader, section } from "../components/layout.js?v=20260723-editable-loads-v2";
import { dataTable, simpleTable } from "../components/table.js?v=20260729-single-date-v2";

import {
  canEditIncomeConfig,
  canEditLotField,
  canLockInitialData,
  canUnlockInitialData,
} from "../domain/permissions.js?v=20260727-history-delete-v1";
import { valueInput } from "../components/fields.js?v=20260729-single-date-v2";
import {
  MAX_ACTIVE_LOTS,
  normalizeActiveLotCount,
} from "../domain/calculations.js?v=20260729-single-date-v2";

export function incomeScreen(state, computed, permissionContext = {}) {
  const {
    role,
    initialDataLocked = false,
    dateStatus = "ready",
  } = permissionContext;
  const columns = LOT_COLUMNS.map((column) => {
    if (column.key === "currentDiet") {
      return { ...column, options: ["", ...DIET_LABELS] };
    }
    if (column.key === "entryDate") {
      return { ...column, max: state.config.workDate };
    }
    return column;
  });

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
  const activeLotCount = normalizeActiveLotCount(
    state.config.activeLotCount,
  );
  const lotCountOptions = Array.from(
    { length: MAX_ACTIVE_LOTS },
    (_, index) => String(index + 1),
  );
  const config = `
    <div class="form-grid income-config-grid">
      <label>
        <span>Cliente</span>
        ${valueInput({
          value: state.config.clientName,
          type: "text",
          onInput: "updateConfig:clientName:text",
          disabled: !configEditable,
        })}
      </label>
      <div class="date-field">
        <label>
          <span>Fecha inicial</span>
          ${valueInput({
            value: state.config.workDate,
            type: "date",
            onInput: "changeActiveWorkDate:date",
            disabled: !configEditable || dateStatus === "saving",
          })}
        </label>
        <button
          class="secondary-action"
          type="button"
          data-action="syncActiveWorkDate"
          ${!configEditable || dateStatus === "saving" ? "disabled" : ""}
        >
          Usar fecha actual
        </button>
      </div>
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
  const lotCountControl = `
    <label class="lot-count-control">
      <span>Cantidad de lotes</span>
      ${valueInput({
        value: String(activeLotCount),
        type: "select",
        options: lotCountOptions,
        onInput: "updateConfig:activeLotCount:integer",
        disabled: !configEditable,
      })}
    </label>
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
    ${section("Lotes / piquetes", lotsTable, lotCountControl)}
    ${section("Resumen por dieta", dietTotals)}
  `;
}







