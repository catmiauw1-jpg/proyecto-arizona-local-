import { DIET_LABELS, LOT_COLUMNS } from "../domain/model.js?v=20260621-stage1-clean-all";
import { formatCell, formatNumber } from "../domain/formatters.js?v=20260621-stage1-clean-all";
import { metricGrid, screenHeader, section } from "../components/layout.js?v=20260621-stage1-clean-all";
import { dataTable, simpleTable } from "../components/table.js?v=20260621-stage1-clean-all";

export function incomeScreen(state, computed) {
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
  });

  const config = `
    <div class="form-grid">
      <label>
        <span>Cliente</span>
        <input type="text" value="${state.config.clientName}" data-action="updateConfig:clientName:text" />
      </label>
      <label>
        <span>Fecha inicial</span>
        <input type="date" value="${state.config.startDate}" data-action="updateConfig:startDate:date" />
      </label>
      <label>
        <span>Fecha de trabajo</span>
        <span class="locked-field">${state.config.workDate}</span>
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
    ${section("Datos generales", config)}
    ${metrics}
    ${section("Lotes / piquetes", lotsTable)}
    ${section("Consumo por animal", animalConsumptionTable)}
    ${section("Resumen por dieta", dietTotals)}
  `;
}







