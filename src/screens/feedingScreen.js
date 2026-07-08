import { valueInput } from "../components/fields.js?v=20260621-stage1-clean-all";
import { metricGrid, screenHeader, section, statusPill } from "../components/layout.js?v=20260621-stage1-clean-all";
import { simpleTable } from "../components/table.js?v=20260621-stage1-clean-all";
import { formatCurrency, formatNumber, formatPercent, toNumber } from "../domain/formatters.js?v=20260621-stage1-clean-all";

function adaptationActualValue(state, dietId, lotId, treatment) {
  return state.feedingActuals?.[dietId]?.[lotId]?.[treatment];
}

function buildAdaptationLotRows(state, calculatedDiet, plan) {
  const dietDryMatter = calculatedDiet.totals.dietDryMatterPct;
  const costBsKg = calculatedDiet.totals.costBsKg;

  return plan.lotRows.map((lot) => {
    const treatments = lot.treatmentRows.map((treatment) => {
      const storedActual = adaptationActualValue(state, plan.dietId, lot.lotId, treatment.treatment);
      const realizedMo = storedActual ?? treatment.expectedMo;
      const realizedMs = realizedMo * dietDryMatter;
      const cost = realizedMo * costBsKg;

      return {
        ...treatment,
        realizedMo,
        realizedMs,
        cost,
      };
    });

    const byTreatment = Object.fromEntries(treatments.map((treatment) => [treatment.treatment, treatment]));
    const realEspeTrato5 =
      toNumber(byTreatment[1]?.expectedMo) +
      toNumber(byTreatment[2]?.expectedMo) +
      toNumber(byTreatment[4]?.expectedMo) +
      toNumber(byTreatment[5]?.expectedMo) -
      (toNumber(byTreatment[4]?.realizedMo) +
        toNumber(byTreatment[2]?.realizedMo) +
        toNumber(byTreatment[1]?.realizedMo));
    const expectedMo = treatments.reduce((total, treatment) => total + toNumber(treatment.expectedMo), 0);
    const expectedMs = expectedMo * dietDryMatter;
    const realizedMo = treatments.reduce((total, treatment) => total + toNumber(treatment.realizedMo), 0);
    const realizedMs = realizedMo * dietDryMatter;
    const cost = treatments.reduce((total, treatment) => total + toNumber(treatment.cost), 0);
    const costPerAnimal = toNumber(lot.animalCount) === 0 ? 0 : cost / toNumber(lot.animalCount);

    return {
      ...lot,
      treatments,
      byTreatment,
      realEspeTrato5,
      expectedMo,
      expectedMs,
      realizedMo,
      realizedMs,
      cost,
      costPerAnimal,
    };
  });
}

function adaptationPlanTable(state, calculatedDiet, plan) {
  const lotRows = buildAdaptationLotRows(state, calculatedDiet, plan);
  const headers = [
    "Piquete",
    "Lote",
    "1° Prev.",
    "1° realizado",
    "1° Costo/trato",
    "2° Prev.",
    "2° realizado",
    "2° Costo/trato",
    "3° Prev.",
    "3° realizado",
    "3° Costo/trato",
    "4° Prev.",
    "4° realizado",
    "4° Costo/trato",
    "5° Prev.",
    "5° real espe.",
    "5° realizado",
    "5° Costo/trato",
    "COSTO LOTE",
    "DIARIA ALIMENTAR",
    "PREVISTO MO",
    "PREVISTO MS",
    "REALIZADO MO",
    "REALIZADO MS",
  ];

  if (!lotRows.length) {
    return simpleTable(headers, [["Sin piquetes asignados", ...Array(headers.length - 1).fill("")]]);
  }

  return `
    <div class="table-wrap adaptation-feeding-table">
      <table>
        <thead>
          <tr>
            ${headers
              .map((header) => {
                const isInput = header.includes("realizado");
                const isLocked = header === "Piquete" || header === "Lote";
                const className = isInput ? "input-head" : isLocked ? "locked-head" : "calc-head";
                return `<th class="${className}">${header}</th>`;
              })
              .join("")}
          </tr>
        </thead>
        <tbody>
          ${lotRows
            .map((lot) => {
              const treatmentCells = [1, 2, 3, 4, 5].flatMap((number) => {
                const treatment = lot.byTreatment[number] ?? {};
                const realizedValue =
                  adaptationActualValue(state, plan.dietId, lot.lotId, number) ?? treatment.expectedMo ?? 0;
                const cells = [
                  `<td class="calc-cell" data-label="${number}° Prev.">${formatNumber(treatment.expectedMo)}</td>`,
                ];

                if (number === 5) {
                  cells.push(
                    `<td class="calc-cell" data-label="real espe.">${formatNumber(lot.realEspeTrato5)}</td>`,
                  );
                }

                cells.push(
                  `<td class="input-cell" data-label="${number}° realizado">
                    ${valueInput({
                      value: realizedValue,
                      type: "number",
                      onInput: `updateFeedingActual:${plan.dietId}:${lot.lotId}:${number}:number`,
                    })}
                  </td>`,
                  `<td class="calc-cell" data-label="${number}° Costo/trato">${formatCurrency(treatment.cost)}</td>`,
                );

                return cells;
              });

              return `
                <tr>
                  <td class="locked-cell" data-label="Piquete">${lot.pen}</td>
                  <td class="locked-cell" data-label="Lote">${lot.lotCode}</td>
                  ${treatmentCells.join("")}
                  <td class="calc-cell" data-label="COSTO LOTE">${formatCurrency(lot.cost)}</td>
                  <td class="calc-cell" data-label="DIARIA ALIMENTAR">${formatCurrency(lot.costPerAnimal)}</td>
                  <td class="calc-cell" data-label="PREVISTO MO">${formatNumber(lot.expectedMo)}</td>
                  <td class="calc-cell" data-label="PREVISTO MS">${formatNumber(lot.expectedMs)}</td>
                  <td class="calc-cell" data-label="REALIZADO MO">${formatNumber(lot.realizedMo)}</td>
                  <td class="calc-cell" data-label="REALIZADO MS">${formatNumber(lot.realizedMs)}</td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function defaultPlanTable(plan) {
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

  return simpleTable(
    ["Piquete", "Lote", "Trato", "%", "Previsto MO", "Previsto MS", "Costo"],
    rows.length ? rows : [["Sin piquetes asignados", "", "", "", "", "", ""]],
  );
}

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
              <strong>${treatment.number}° trato</strong>
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

  const planTable =
    sheet.id === "ADAPTACION" ? adaptationPlanTable(state, calculatedDiet, plan) : defaultPlanTable(plan);

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
