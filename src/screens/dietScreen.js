import { INGREDIENT_COLUMNS } from "../domain/model.js?v=20260620-inputs2";
import { formatCurrency, formatPercent } from "../domain/formatters.js?v=20260620-inputs2";
import { formulaNote, metricGrid, screenHeader, section, statusPill } from "../components/layout.js?v=20260620-inputs2";
import { dataTable, simpleTable } from "../components/table.js?v=20260620-inputs2";

export function dietScreen(sheet, state, computed) {
  const diet = computed.diets[sheet.dietId];
  const rawDiet = state.diets[sheet.dietId];

  const header = screenHeader({
    eyebrow: `Hoja ${sheet.id}`,
    title: rawDiet.title,
    description: "Formula base de dieta: entradas manuales a la izquierda, resultados calculados bloqueados.",
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
    ${formulaNote({
      status: "exact",
      title: "Formula Excel replicada",
      text: "Se replica el bloque D7:H17: inclusion MO, normalizacion, MS dieta, costo por insumo y totales. La validacion C17 conserva la condicion original >= 99.9.",
    })}
    ${metrics}
    ${section("Parametros de dieta", setup)}
    ${section("Ingredientes", table)}
    ${section("Totales calculados", totals)}
  `;
}

