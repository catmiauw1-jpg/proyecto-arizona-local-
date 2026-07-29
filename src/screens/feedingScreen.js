import { valueInput } from "../components/fields.js?v=20260723-excel-parity-v1";
import {
  metricGrid,
  screenHeader,
  section,
  statusPill,
} from "../components/layout.js?v=20260723-editable-loads-v2";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  toNumber,
} from "../domain/formatters.js?v=20260621-stage1-clean-all";
import {
  calculateFifthTreatmentBalance,
  calculateTreatmentIngredientLoads,
} from "../domain/calculations.js?v=20260727-active-lots-v1";
import {
  canEditFeedingActuals,
  canEditTreatmentConfig,
  canEditTreatmentIngredientLoads,
} from "../domain/permissions.js?v=20260727-history-delete-v1";
import { escapeHtml } from "../domain/html.js?v=20260723-history-validation";

function feedingActualValue(state, dietId, lotId, treatment) {
  return state.feedingActuals?.[dietId]?.[lotId]?.[treatment];
}

function emptyTreatmentRows(calculatedDiet) {
  return calculatedDiet.treatments.map((treatment) => ({
    treatment: treatment.number,
    time: treatment.time,
    sharePct: treatment.sharePct,
    expectedMo: 0,
    expectedMs: 0,
    realizedMo: 0,
    realizedMs: 0,
    cost: 0,
  }));
}

function buildExcelLotRows(state, calculatedDiet, plan) {
  const dietDryMatter = calculatedDiet.totals.dietDryMatterPct;
  const costBsKg = calculatedDiet.totals.costBsKg;
  const plannedRows = new Map(plan.lotRows.map((lot) => [lot.lotId, lot]));
  const sourceLots = state.lots.filter((lot) => plannedRows.has(lot.id));

  return sourceLots.map((sourceLot) => {
    const lot = plannedRows.get(sourceLot.id) ?? {
      lotId: sourceLot.id,
      pen: sourceLot.pen,
      lotCode: sourceLot.lotCode,
      animalCount: sourceLot.animalCount,
      treatmentRows: emptyTreatmentRows(calculatedDiet),
    };
    const expectedByTreatment = Object.fromEntries(
      lot.treatmentRows.map((treatment) => [treatment.treatment, treatment]),
    );
    const manualActuals = Object.fromEntries(
      [1, 2, 3, 4, 5].map((number) => [
        number,
        feedingActualValue(state, plan.dietId, lot.lotId, number),
      ]),
    );
    const realEspeTrato5 = calculateFifthTreatmentBalance(
      expectedByTreatment,
      manualActuals,
    );
    const treatments = lot.treatmentRows.map((treatment) => {
      const storedActual = manualActuals[treatment.treatment];
      const realizedMo = storedActual ?? treatment.expectedMo;

      return {
        ...treatment,
        realizedMo,
        realizedMs: realizedMo * dietDryMatter,
        cost: realizedMo * costBsKg,
      };
    });
    const byTreatment = Object.fromEntries(
      treatments.map((treatment) => [treatment.treatment, treatment]),
    );
    const expectedMo = treatments.reduce(
      (total, treatment) => total + toNumber(treatment.expectedMo),
      0,
    );
    const expectedMs = expectedMo * dietDryMatter;
    const realizedMo = treatments.reduce(
      (total, treatment) => total + toNumber(treatment.realizedMo),
      0,
    );
    const realizedMs = realizedMo * dietDryMatter;
    const cost = treatments.reduce(
      (total, treatment) => total + toNumber(treatment.cost),
      0,
    );
    const animalCount = toNumber(sourceLot.animalCount);

    return {
      ...lot,
      pen: sourceLot.pen,
      lotCode: sourceLot.lotCode,
      animalCount: sourceLot.animalCount,
      treatments,
      byTreatment,
      realEspeTrato5,
      expectedMo,
      expectedMs,
      realizedMo,
      realizedMs,
      cost,
      costPerAnimal: animalCount === 0 ? 0 : cost / animalCount,
    };
  });
}

function excelTreatmentPiqueteTable(
  state,
  plan,
  lotRows,
  treatmentNumber,
  permissionContext,
  { includeFinalSummary = true } = {},
) {
  const isFifthTreatment = treatmentNumber === 5;
  const showFinalSummary = isFifthTreatment && includeFinalSummary;

  return `
    <table class="treatment-piquete-table">
      <thead>
        <tr>
          <th class="locked-head">Piquete</th>
          <th class="calc-head">Prev.</th>
          ${isFifthTreatment ? '<th class="calc-head">real espe.</th>' : ""}
          <th class="input-head">realizado</th>
          <th class="calc-head">Costo/trato</th>
          ${
            isFifthTreatment
              ? `
                <th class="calc-head">COSTO LOTE</th>
                <th class="calc-head">DIARIA ALIMENTAR</th>
              `
              : ""
          }
          ${
            showFinalSummary
              ? `
                <th class="calc-head">PREVISTO MO</th>
                <th class="calc-head">PREVISTO MS</th>
                <th class="calc-head">REALIZADO MO</th>
                <th class="calc-head">REALIZADO MS</th>
              `
              : ""
          }
        </tr>
      </thead>
      <tbody>
        ${lotRows
          .map((lot) => {
            const treatment = lot.byTreatment[treatmentNumber] ?? {};
            const realizedValue =
              feedingActualValue(
                state,
                plan.dietId,
                lot.lotId,
                treatmentNumber,
              ) ??
              treatment.realizedMo ??
              0;

            return `
              <tr data-treatment-piquete="${treatmentNumber}">
                <td class="locked-cell" data-label="Piquete">${escapeHtml(lot.pen)}</td>
                <td
                  class="calc-cell"
                  data-label="Prev."
                  data-expected-mo="${escapeHtml(treatment.expectedMo)}"
                >${formatNumber(treatment.expectedMo)}</td>
                ${
                  isFifthTreatment
                    ? `<td class="calc-cell" data-label="real espe.">${formatNumber(lot.realEspeTrato5)}</td>`
                    : ""
                }
                <td class="excel-realized-cell" data-label="realizado">
                  ${valueInput({
                    value: realizedValue,
                    type: "number",
                    onInput: `updateFeedingActual:${plan.dietId}:${lot.lotId}:${treatmentNumber}:number`,
                    disabled: !canEditFeedingActuals(permissionContext.role),
                  })}
                </td>
                <td class="calc-cell" data-label="Costo/trato">${formatCurrency(treatment.cost)}</td>
                ${
                  isFifthTreatment
                    ? `
                      <td class="calc-cell" data-label="COSTO LOTE">${formatCurrency(lot.cost)}</td>
                      <td class="calc-cell" data-label="DIARIA ALIMENTAR">${formatCurrency(lot.costPerAnimal)}</td>
                    `
                    : ""
                }
                ${
                  showFinalSummary
                    ? `
                      <td class="calc-cell" data-label="PREVISTO MO">${formatNumber(lot.expectedMo)}</td>
                      <td class="calc-cell" data-label="PREVISTO MS">${formatNumber(lot.expectedMs)}</td>
                      <td class="calc-cell" data-label="REALIZADO MO">${formatNumber(lot.realizedMo)}</td>
                      <td class="calc-cell" data-label="REALIZADO MS">${formatNumber(lot.realizedMs)}</td>
                    `
                    : ""
                }
              </tr>
            `;
          })
          .join("")}
      </tbody>
    </table>
  `;
}

function treatmentIngredientLoadTable({
  calculatedDiet,
  dietId,
  dietTotalMo,
  permissionContext,
  state,
  treatment,
}) {
  const treatmentActuals =
    state.treatmentIngredientActuals?.[dietId]?.[treatment.number] ?? {};
  const rows = calculateTreatmentIngredientLoads(
    calculatedDiet,
    dietTotalMo,
    treatment,
  ).map((row) => ({
    ...row,
    effectiveKg: treatmentActuals[row.ingredientId] ?? row.kg,
  }));

  return `
    <div class="treatment-loads">
      <span>Kg por insumo</span>
      <table>
        <thead>
          <tr>
            <th>Insumo</th>
            <th>Prev. kg</th>
            <th>Kg a cargar</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `
                <tr>
                  <td>${escapeHtml(row.name)}</td>
                  <td
                    class="calculated-load-cell"
                    data-calculated-load="${escapeHtml(row.kg)}"
                  >
                    ${formatNumber(row.kg)}
                  </td>
                  <td>
                    ${valueInput({
                      value: formatNumber(row.effectiveKg),
                      type: "number",
                      onInput: `updateTreatmentIngredientActual:${dietId}:${treatment.number}:${row.ingredientId}:number`,
                      calculatedValue: row.kg,
                      disabled: !canEditTreatmentIngredientLoads(
                        permissionContext.role,
                      ),
                    })}
                  </td>
                </tr>
              `,
            )
            .join("")}
          <tr class="total-row">
            <td>Total</td>
            <td>${formatNumber(
              rows.reduce(
                (total, row) => total + toNumber(row.kg),
                0,
              ),
            )}</td>
            <td>${formatNumber(
              rows.reduce(
                (total, row) => total + toNumber(row.effectiveKg),
                0,
              ),
            )}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

function treatmentColumn({
  calculatedDiet,
  dietId,
  dietLocked,
  dietTotalMo,
  lotRows,
  permissionContext,
  plan,
  role,
  state,
  treatment,
}) {
  return `
    <article class="excel-treatment-column ${treatment.number === 5 ? "is-fifth" : ""}">
      <h3>${treatment.number}° TRATO</h3>
      <div class="treatment-configuration">
        <label>
          <span>Horario</span>
          ${valueInput({
            value: treatment.time,
            type: "text",
            onInput: `updateTreatment:${dietId}:${treatment.number}:time:text`,
            disabled: !canEditTreatmentConfig(role, dietLocked),
          })}
        </label>
        <label class="treatment-share-field">
          <span>Porcentaje</span>
          ${valueInput({
            value: treatment.sharePct,
            type: "percent",
            onInput: `updateTreatment:${dietId}:${treatment.number}:sharePct:percent`,
            disabled: !canEditTreatmentConfig(role, dietLocked),
          })}
        </label>
        ${treatmentIngredientLoadTable({
          calculatedDiet,
          dietId,
          dietTotalMo,
          permissionContext,
          state,
          treatment,
        })}
      </div>
      ${excelTreatmentPiqueteTable(
        state,
        plan,
        lotRows,
        treatment.number,
        permissionContext,
      )}
    </article>
  `;
}

function treatmentTabs(diet, selectedTreatmentNumber) {
  return `
    <div class="adaptation-treatment-tabs" role="tablist" aria-label="Tratos de ${escapeHtml(diet.id)}">
      ${diet.treatments
        .map((treatment) => {
          const active = treatment.number === selectedTreatmentNumber;
          return `
            <button
              class="adaptation-treatment-tab ${active ? "is-active" : ""}"
              type="button"
              role="tab"
              aria-selected="${active}"
              aria-controls="feeding-treatment-${diet.id}-${treatment.number}"
              data-action="selectFeedingTreatment:${diet.id}:${treatment.number}"
            >
              <span>${treatment.number}° trato</span>
              <small>${escapeHtml(treatment.time)} · ${formatPercent(treatment.sharePct)}</small>
            </button>
          `;
        })
        .join("")}
    </div>
  `;
}

function piqueteRangeLabel(lotRows) {
  if (!lotRows.length) return "Sin piquetes activos";
  if (lotRows.length === 1) return `Piquete ${lotRows[0].pen}`;
  return `Piquetes ${lotRows[0].pen} a ${lotRows.at(-1).pen}`;
}

function treatmentPanel({
  active,
  calculatedDiet,
  dietId,
  dietLocked,
  dietTotalMo,
  lotRows,
  permissionContext,
  plan,
  role,
  state,
  treatment,
}) {
  return `
    <article
      id="feeding-treatment-${dietId}-${treatment.number}"
      data-treatment-panel="${treatment.number}" class="adaptation-treatment-panel${active ? " is-active" : ""}"
      role="tabpanel"
      ${active ? "" : "hidden"}
    >
      <div class="adaptation-treatment-workspace">
        <div class="adaptation-treatment-setup">
          <div class="adaptation-panel-heading">
            <span>Configuración</span>
            <strong>${treatment.number}° trato</strong>
          </div>
          <div class="adaptation-config-grid">
            <label>
              <span>Horario</span>
              ${valueInput({
                value: treatment.time,
                type: "text",
                onInput: `updateTreatment:${dietId}:${treatment.number}:time:text`,
                disabled: !canEditTreatmentConfig(role, dietLocked),
              })}
            </label>
            <label class="treatment-share-field">
              <span>Porcentaje</span>
              ${valueInput({
                value: treatment.sharePct,
                type: "percentInteger",
                onInput: `updateTreatment:${dietId}:${treatment.number}:sharePct:percentInteger`,
                disabled: !canEditTreatmentConfig(role, dietLocked),
              })}
            </label>
          </div>
          ${treatmentIngredientLoadTable({
            calculatedDiet,
            dietId,
            dietTotalMo,
            permissionContext,
            state,
            treatment,
          })}
        </div>
        <div class="adaptation-piquete-area">
          <div class="adaptation-panel-heading">
            <span>Distribución diaria</span>
            <strong>${escapeHtml(piqueteRangeLabel(lotRows))}</strong>
          </div>
          <div class="table-wrap adaptation-piquete-table-wrap">
            ${excelTreatmentPiqueteTable(
              state,
              plan,
              lotRows,
              treatment.number,
              permissionContext,
              { includeFinalSummary: false },
            )}
          </div>
        </div>
      </div>
    </article>
  `;
}

function treatmentSummaryTable(lotRows) {
  return `
    <div class="table-wrap adaptation-summary-wrap">
      <table class="adaptation-summary-table">
        <thead>
          <tr>
            <th>Piquete</th>
            <th>PREVISTO MO</th>
            <th>PREVISTO MS</th>
            <th>REALIZADO MO</th>
            <th>REALIZADO MS</th>
          </tr>
        </thead>
        <tbody>
          ${lotRows
            .map(
              (lot) => `
                <tr data-summary-piquete="${escapeHtml(lot.pen)}">
                  <td class="locked-cell">${escapeHtml(lot.pen)}</td>
                  <td class="calc-cell">${formatNumber(lot.expectedMo)}</td>
                  <td class="calc-cell">${formatNumber(lot.expectedMs)}</td>
                  <td class="calc-cell">${formatNumber(lot.realizedMo)}</td>
                  <td class="calc-cell">${formatNumber(lot.realizedMs)}</td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

export function feedingScreen(sheet, state, computed, permissionContext = {}) {
  const { role, dietLocked = false } = permissionContext;
  const diet = state.diets[sheet.dietId];
  const calculatedDiet = computed.diets[sheet.dietId];
  const plan = computed.feedingPlan[sheet.dietId];
  const dietTotalMo = computed.dietTotals[sheet.dietId]?.totalFeedMo ?? 0;
  const usesModernTreatmentLayout = [
    "ADAPTACION",
    "TRANSICION",
    "TERMINACION",
  ].includes(sheet.id);
  const lotRows = buildExcelLotRows(state, calculatedDiet, plan);
  const requestedTreatmentNumber = Number(
    permissionContext.selectedTreatmentNumber,
  );
  const selectedTreatmentNumber = diet.treatments.some(
    (treatment) => treatment.number === requestedTreatmentNumber,
  )
    ? requestedTreatmentNumber
    : 1;

  const header = screenHeader({
    eyebrow: `Módulo ${sheet.id}`,
    title: `Reparto de tratos - ${sheet.label}`,
    description: "Organiza el reparto de alimento por dieta, piquete y trato.",
  });

  const treatmentBoard = `
    <div class="excel-treatment-scroll">
      <div class="excel-treatment-board">
        ${diet.treatments
          .map((treatment) =>
            treatmentColumn({
              calculatedDiet,
              dietId: sheet.dietId,
              dietLocked,
              dietTotalMo,
              lotRows,
              permissionContext,
              plan,
              role,
              state,
              treatment,
            }),
          )
          .join("")}
      </div>
    </div>
  `;
  const treatmentPlan = `
    ${treatmentTabs(diet, selectedTreatmentNumber)}
    <div class="adaptation-treatment-panels">
      ${diet.treatments
        .map((treatment) =>
          treatmentPanel({
            active: treatment.number === selectedTreatmentNumber,
            calculatedDiet,
            dietId: sheet.dietId,
            dietLocked,
            dietTotalMo,
            lotRows,
            permissionContext,
            plan,
            role,
            state,
            treatment,
          }),
        )
        .join("")}
    </div>
  `;

  const metrics = metricGrid([
    {
      label: "Porcentaje total",
      value: formatPercent(calculatedDiet.totals.treatmentAb2),
    },
    { label: "Validación", value: statusPill(plan.treatmentStatus) },
    { label: "MO prevista", value: formatNumber(plan.expectedMo) },
    { label: "MS prevista", value: formatNumber(plan.expectedMs) },
  ]);

  return `
    ${header}
    ${
      dietLocked
        ? '<div class="lock-banner is-locked"><strong>Dieta bloqueada</strong><span>La configuración de horarios y porcentajes está protegida.</span></div>'
        : ""
    }
    ${usesModernTreatmentLayout ? metrics : ""}
    ${section(
      usesModernTreatmentLayout
        ? `Plan diario de ${sheet.label.toLocaleLowerCase("es-BO")}`
        : "Configuración de tratos y piquetes",
      usesModernTreatmentLayout ? treatmentPlan : treatmentBoard,
    )}
    ${usesModernTreatmentLayout ? "" : metrics}
  `;
}
