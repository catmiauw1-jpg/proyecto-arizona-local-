import { INGREDIENT_COLUMNS } from "../domain/model.js?v=20260621-stage1-clean-state";
import { formatCurrency, formatPercent } from "../domain/formatters.js?v=20260621-stage1-clean-state";
import { metricGrid, screenHeader, section, statusPill } from "../components/layout.js?v=20260621-stage1-clean-state";
import { dataTable, simpleTable } from "../components/table.js?v=20260621-stage1-clean-state";

export function dietScreen(sheet, state, computed) {
  const diet = computed.diets[sheet.dietId];
  const rawDiet = state.diets[sheet.dietId];

  const header = screenHeader({
    eyebrow: `Modulo ${sheet.id}`,
    title: rawDiet.title,
    description: "Gestiona ingredientes, costos y resultados calculados de la dieta.",
  });

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
        <span class="locked-field">${rawDiet.consumption}</span>
      </label>
      <label>
        <span>GMD estimado</span>
        <span class="locked-field">${rawDiet.estimatedGmd}</span>
      </label>
    </div>
  `;

  const table = dataTable({
    columns: INGREDIENT_COLUMNS,
    rows: diet.rows,
    rowId: (row) => row.id,
    actionPrefix: `updateIngredient:${rawDiet.id}`,
  });

  const totals = simpleTable(
    ["Total MS", "Total MO", "Total inclusion M.O", "MS dieta", "Costo Bs/ton"],
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
    ${metrics}
    ${section("Parametros de dieta", setup)}
    ${section("Ingredientes", table)}
    ${section("Totales calculados", totals)}
  `;
}





