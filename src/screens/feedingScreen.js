import { formatCurrency, formatNumber, formatPercent } from "../domain/formatters.js?v=20260620-client-clean-v1";
import { metricGrid, screenHeader, section, statusPill } from "../components/layout.js?v=20260620-client-clean-v1";
import { simpleTable } from "../components/table.js?v=20260620-client-clean-v1";

export function feedingScreen(sheet, state, computed) {
  const diet = state.diets[sheet.dietId];
  const calculatedDiet = computed.diets[sheet.dietId];
  const plan = computed.feedingPlan[sheet.dietId];

  const header = screenHeader({
    eyebrow: `Modulo ${sheet.id}`,
    title: `Reparto de tratos - ${sheet.label}`,
    description: "Organiza el reparto de alimento por dieta, piquete y trato.",
  });

  const treatmentInputs = `
    <div class="treatment-grid">
      ${diet.treatments
        .map(
          (treatment) => `
            <div class="treatment-row">
              <strong>${treatment.number}Â° trato</strong>
              <label>
                <span>Horario</span>
                <span class="locked-field">${treatment.time}</span>
              </label>
              <label>
                <span>Porcentaje</span>
                <input type="text" inputmode="decimal" step="0.001" value="${treatment.sharePct}" data-action="updateTreatment:${diet.id}:${treatment.number}:sharePct:percent" />
              </label>
            </div>
          `,
        )
        .join("")}
    </div>
  `;

  const metrics = metricGrid([
    { label: "AB2", value: formatPercent(calculatedDiet.totals.treatmentAb2) },
    { label: "AB3", value: statusPill(plan.treatmentStatus) },
    { label: "MO prevista", value: formatNumber(plan.expectedMo) },
    { label: "MS prevista", value: formatNumber(plan.expectedMs) },
  ]);

  const rows = plan.lotRows.flatMap((lot) =>
    lot.treatmentRows.map((treatment) => [
      lot.pen,
      lot.lotCode,
      `${treatment.treatment} (${treatment.time})`,
      formatPercent(treatment.sharePct),
      formatNumber(treatment.expectedMo),
      formatNumber(treatment.expectedMs),
      formatCurrency(treatment.cost),
    ]),
  );

  const planTable = simpleTable(
    ["Piquete", "Lote", "Trato", "%", "Previsto MO", "Previsto MS", "Costo"],
    rows.length ? rows : [["Sin piquetes asignados", "", "", "", "", "", ""]],
  );

  const ingredientRows = calculatedDiet.rows.map((row) => [
    row.name,
    formatPercent(row.normalizedMoPct),
    formatPercent(row.dietDryMatterPct),
    formatCurrency(row.costContributionBsTon),
  ]);

  return `
    ${header}
    ${section("Configuracion de tratos", treatmentInputs)}
    ${metrics}
    ${section("Plan por piquete y trato", planTable)}
    ${section("Base de dieta utilizada", simpleTable(["Insumo", "Inclusion M.O", "MS dieta", "Costo"], ingredientRows, { compact: true }))}
  `;
}




