import { DIET_LABELS, LOT_COLUMNS } from "../domain/model.js?v=20260620-inputs2";
import { formatCell, formatNumber } from "../domain/formatters.js?v=20260620-inputs2";
import { formulaNote, metricGrid, screenHeader, section } from "../components/layout.js?v=20260620-inputs2";
import { dataTable, simpleTable } from "../components/table.js?v=20260620-inputs2";

export function incomeScreen(state, computed) {
  const columns = LOT_COLUMNS.map((column) =>
    column.key === "currentDiet" ? { ...column, options: DIET_LABELS } : column,
  );

  const totalAnimals = computed.lots.reduce((total, lot) => total + Number(lot.animalCount || 0), 0);
  const totalMs = computed.lots.reduce((total, lot) => total + lot.totalFeedMs, 0);
  const totalMo = computed.lots.reduce((total, lot) => total + lot.totalFeedMo, 0);

  const header = screenHeader({
    eyebrow: "Hoja Ingreso",
    title: "Ingreso de lotes y calculo inicial",
    description: "Primera pantalla funcional: edita los datos manuales y revisa los resultados equivalentes a formulas.",
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
    ${formulaNote({
      status: "exact",
      title: "Formula Excel replicada",
      text: "Se replican F, I, J, L, M, O, P, Q y el resumen B30:D32. Los campos amarillos A, B, C, D, K y N son editables.",
    })}
    ${section("Datos generales", config)}
    ${metrics}
    ${section("Lotes / piquetes", lotsTable)}
    ${section("Resumen por dieta", dietTotals)}
  `;
}

