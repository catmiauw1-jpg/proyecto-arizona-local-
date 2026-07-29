import { dateDiffInDays, toNumber } from "./formatters.js?v=20260621-stage1-clean-all";

export const MIN_ACTIVE_LOTS = 1;
export const MAX_ACTIVE_LOTS = 20;

export function normalizeActiveLotCount(value) {
  if (value === undefined || value === null || value === "") {
    return MAX_ACTIVE_LOTS;
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return MAX_ACTIVE_LOTS;

  return Math.min(
    MAX_ACTIVE_LOTS,
    Math.max(MIN_ACTIVE_LOTS, Math.trunc(numericValue)),
  );
}

function sum(items, selector) {
  return items.reduce((total, item) => total + toNumber(selector(item)), 0);
}

function safeDivide(numerator, denominator) {
  const divisor = toNumber(denominator);
  return divisor === 0 ? 0 : toNumber(numerator) / divisor;
}

function percentFraction(value) {
  const number = toNumber(value);
  return Math.abs(number) > 1 ? number / 100 : number;
}

export function calculateTreatmentIngredientLoads(calculatedDiet, dietTotalMo, treatment) {
  return calculatedDiet.rows.map((ingredient) => ({
    ingredientId: ingredient.id,
    name: ingredient.name,
    kg:
      toNumber(dietTotalMo) *
      toNumber(ingredient.normalizedMoPct) *
      percentFraction(treatment.sharePct),
  }));
}

export function calculateFifthTreatmentBalance(expectedByTreatment, manualActuals) {
  const expectedTotal = [1, 2, 3, 4, 5].reduce(
    (total, number) => total + toNumber(expectedByTreatment[number]?.expectedMo),
    0,
  );
  const realizedBeforeFifth = [1, 2, 3, 4].reduce(
    (total, number) =>
      total +
      toNumber(manualActuals[number] ?? expectedByTreatment[number]?.expectedMo),
    0,
  );

  return expectedTotal - realizedBeforeFifth;
}

function isCompletePercent(value) {
  const number = toNumber(value);
  return number <= 1.01 ? number >= 0.999 : number >= 99.9;
}

export function hasOperationalLot(lot) {
  return Boolean(
    lot.entryDate ||
      lot.lotCode ||
      lot.currentDiet ||
      toNumber(lot.animalCount) > 0 ||
      toNumber(lot.initialWeight) > 0 ||
      toNumber(lot.consumptionAdjustmentPct) !== 0
  );
}

export function calculateDiet(diet) {
  const rawRows = diet.ingredients.map((ingredient) => {
    const dryMatterPct = percentFraction(ingredient.dryMatterPct);
    const inclusionMsPct = percentFraction(ingredient.inclusionMsPct);
    const inclusionMoPct = safeDivide(inclusionMsPct, dryMatterPct);

    return {
      ...ingredient,
      dryMatterPct,
      inclusionMsPct,
      inclusionMoPct,
      costBsTon: toNumber(ingredient.costBsTon),
    };
  });

  const totalInclusionMsPct = sum(rawRows, (row) => row.inclusionMsPct);
  const totalInclusionMoPct = sum(rawRows, (row) => row.inclusionMoPct);
  const rows = rawRows.map((row) => {
    const normalizedMoPct = safeDivide(row.inclusionMoPct, totalInclusionMoPct);
    const dietDryMatterPct = normalizedMoPct * row.dryMatterPct;
    const costContributionBsTon = normalizedMoPct * row.costBsTon;

    return {
      ...row,
      normalizedMoPct,
      dietDryMatterPct,
      costContributionBsTon,
    };
  });

  const totals = {
    totalInclusionMsPct,
    totalInclusionMoPct,
    normalizedMoPct: sum(rows, (row) => row.normalizedMoPct),
    dietDryMatterPct: sum(rows, (row) => row.dietDryMatterPct),
    costBsTon: sum(rows, (row) => row.costContributionBsTon),
  };

  totals.costBsKg = totals.costBsTon / 1000;
  totals.status = isCompletePercent(totalInclusionMsPct) ? "Correcto" : "Incorrecto";
  totals.treatmentSharePct = sum(diet.treatments, (treatment) =>
    percentFraction(treatment.sharePct),
  );
  totals.treatmentAb2 = totals.treatmentSharePct;
  totals.treatmentAb3Basis = totals.treatmentSharePct;
  totals.treatmentStatus = isCompletePercent(totals.treatmentAb3Basis) ? "Correcto" : "Incorrecto";

  return { ...diet, rows, totals };
}

export function calculateAllDiets(diets) {
  return Object.fromEntries(
    Object.entries(diets).map(([id, diet]) => [id, calculateDiet(diet)]),
  );
}

export function calculateLots(state, calculatedDiets) {
  const workDate = state.config.workDate;
  const activeLotCount = normalizeActiveLotCount(
    state.config.activeLotCount,
  );
  const activeLots = state.lots.slice(0, activeLotCount);

  return activeLots.map((lot) => {
    const diet = calculatedDiets[lot.currentDiet];
    const consumption = state.consumptionNotes[lot.id] ?? {};
    const daysInConfinement = dateDiffInDays(workDate, lot.entryDate);
    const estimatedWeight = toNumber(lot.initialWeight) + daysInConfinement * toNumber(lot.estimatedGmd);
    const initialImsPct = percentFraction(lot.initialImsPct);
    const consumptionAdjustmentPct = percentFraction(lot.consumptionAdjustmentPct);
    const initialCmsKg =
      toNumber(lot.initialWeight) * initialImsPct * toNumber(lot.animalCount);
    const baseTotalMs =
      estimatedWeight *
      toNumber(lot.animalCount) *
      initialImsPct *
      (1 + consumptionAdjustmentPct);
    const totalFeedMs =
      baseTotalMs -
      toNumber(consumption.msPlannedManual) +
      toNumber(consumption.msRealizedManual);
    const cmsPerAnimal = safeDivide(totalFeedMs, lot.animalCount);
    const dietDryMatter = diet?.totals.dietDryMatterPct ?? 0;
    const cmoPerAnimal = safeDivide(cmsPerAnimal, dietDryMatter);
    const totalFeedMo = cmoPerAnimal * toNumber(lot.animalCount);
    const cmsPctAnimal = safeDivide(cmsPerAnimal, estimatedWeight);

    return {
      ...lot,
      initialImsPct,
      consumptionAdjustmentPct,
      daysInConfinement,
      estimatedWeight,
      initialCmsKg,
      totalFeedMs,
      totalFeedMo,
      cmsPerAnimal,
      cmoPerAnimal,
      cmsPctAnimal,
    };
  });
}

export function calculateDietTotals(lots) {
  const totals = {
    ADAPTACION: { totalFeedMs: 0, totalFeedMo: 0 },
    TRANSICION: { totalFeedMs: 0, totalFeedMo: 0 },
    TERMINACION: { totalFeedMs: 0, totalFeedMo: 0 },
  };

  lots.forEach((lot) => {
    if (!totals[lot.currentDiet]) return;
    totals[lot.currentDiet].totalFeedMs += lot.totalFeedMs;
    totals[lot.currentDiet].totalFeedMo += lot.totalFeedMo;
  });

  return totals;
}

export function calculateFeedingPlan(state, calculatedDiets, calculatedLots) {
  const planByDiet = {};

  Object.values(calculatedDiets).forEach((diet) => {
    const lotRows = calculatedLots.map((lot) => {
      const expectedLotMo =
        lot.currentDiet === diet.id ? toNumber(lot.totalFeedMo) : 0;
      const treatmentRows = diet.treatments.map((treatment) => {
        const expectedMo =
          expectedLotMo * percentFraction(treatment.sharePct);
        const expectedMs = expectedMo * diet.totals.dietDryMatterPct;
        const storedActual =
          state.feedingActuals?.[diet.id]?.[lot.id]?.[treatment.number];
        const realizedMo = storedActual ?? expectedMo;
        const realizedMs =
          toNumber(realizedMo) * diet.totals.dietDryMatterPct;
        const cost = toNumber(realizedMo) * diet.totals.costBsKg;

        return {
          treatment: treatment.number,
          time: treatment.time,
          sharePct: treatment.sharePct,
          expectedMo,
          expectedMs,
          realizedMo,
          realizedMs,
          cost,
        };
      });

      return {
        lotId: lot.id,
        pen: lot.pen,
        lotCode: lot.lotCode,
        animalCount: lot.animalCount,
        treatmentRows,
        expectedMo: sum(treatmentRows, (row) => row.expectedMo),
        expectedMs: sum(treatmentRows, (row) => row.expectedMs),
        realizedMo: sum(treatmentRows, (row) => row.realizedMo),
        realizedMs: sum(treatmentRows, (row) => row.realizedMs),
        cost: sum(treatmentRows, (row) => row.cost),
        costPerAnimal: safeDivide(sum(treatmentRows, (row) => row.cost), lot.animalCount),
      };
    });

    planByDiet[diet.id] = {
      dietId: diet.id,
      treatmentSharePct: diet.totals.treatmentSharePct,
      treatmentStatus: diet.totals.treatmentStatus,
      lotRows,
      expectedMo: sum(lotRows, (row) => row.expectedMo),
      expectedMs: sum(lotRows, (row) => row.expectedMs),
      realizedMo: sum(lotRows, (row) => row.realizedMo),
      realizedMs: sum(lotRows, (row) => row.realizedMs),
      cost: sum(lotRows, (row) => row.cost),
    };
  });

  return planByDiet;
}

function calculateLotRealizedFromActuals(state, diet, plan, lotRow) {
  const dietDryMatter = diet?.totals.dietDryMatterPct ?? 0;
  const manualActuals = Object.fromEntries(
    [1, 2, 3, 4, 5].map((number) => [
      number,
      state.feedingActuals?.[plan.dietId]?.[lotRow.lotId]?.[number],
    ]),
  );
  const realizedMo = lotRow.treatmentRows.reduce((total, treatment) => {
    const storedActual = manualActuals[treatment.treatment];
    return total + toNumber(storedActual ?? treatment.expectedMo);
  }, 0);

  return {
    realizedMo,
    realizedMs: realizedMo * dietDryMatter,
  };
}

function consumptionTotalsForLot(state, lot, calculatedDiets, feedingPlan) {
  return ["ADAPTACION", "TRANSICION", "TERMINACION"].reduce(
    (totals, dietId) => {
      const plan = feedingPlan[dietId];
      const lotRow = plan?.lotRows.find((row) => row.lotId === lot.id);
      if (!plan || !lotRow) return totals;

      const realized = calculateLotRealizedFromActuals(state, calculatedDiets[dietId], plan, lotRow);

      return {
        expectedMs: totals.expectedMs + toNumber(lotRow.expectedMs),
        realizedMs: totals.realizedMs + toNumber(realized.realizedMs),
        expectedMo: totals.expectedMo + toNumber(lotRow.expectedMo),
        realizedMo: totals.realizedMo + toNumber(realized.realizedMo),
      };
    },
    { expectedMs: 0, realizedMs: 0, expectedMo: 0, realizedMo: 0 },
  );
}

export function calculateConsumptionRows(state, calculatedLots, calculatedDiets, feedingPlan) {
  return calculatedLots.map((lot) => {
    const totals = consumptionTotalsForLot(state, lot, calculatedDiets, feedingPlan);
    const note = state.consumptionNotes[lot.id] ?? {};
    const msPlannedManual = note.msPlannedManual ?? 0;
    const msRealizedManual = note.msRealizedManual ?? 0;
    const moPlannedManual = note.moPlannedManual ?? 0;
    const moRealizedManual = note.moRealizedManual ?? 0;

    return {
      lotId: lot.id,
      pen: lot.pen,
      currentDiet: lot.currentDiet,
      expectedMs: totals.expectedMs,
      realizedMs: totals.realizedMs,
      expectedMo: totals.expectedMo,
      realizedMo: totals.realizedMo,
      msPlannedManual,
      msRealizedManual,
      moPlannedManual,
      moRealizedManual,
    };
  });
}

function calculateLegacyConsumptionRows(state, calculatedLots, feedingPlan) {
  return calculatedLots.filter(hasOperationalLot).map((lot) => {
    const plan = feedingPlan[lot.currentDiet]?.lotRows.find((row) => row.lotId === lot.id);
    const note = state.consumptionNotes[lot.id] ?? {};

    return {
      lotId: lot.id,
      pen: lot.pen,
      currentDiet: lot.currentDiet,
      expectedMs: plan?.expectedMs ?? 0,
      realizedMs: plan?.realizedMs ?? 0,
      expectedMo: plan?.expectedMo ?? 0,
      realizedMo: plan?.realizedMo ?? 0,
      msPlannedManual: note.msPlannedManual ?? "",
      msRealizedManual: note.msRealizedManual ?? "",
      moPlannedManual: note.moPlannedManual ?? "",
      moRealizedManual: note.moRealizedManual ?? "",
    };
  });
}

function costPerAnimalFromModules(feedingPlan, lotId) {
  return ["ADAPTACION", "TRANSICION", "TERMINACION"].reduce((total, dietId) => {
    const planRow = feedingPlan[dietId]?.lotRows.find((row) => row.lotId === lotId);
    return total + toNumber(planRow?.costPerAnimal);
  }, 0);
}

export function recalculateReportRow(row, editedKey) {
  const next = { ...row };

  if (["cmoLot", "animalCount"].includes(editedKey)) {
    next.cmoAnimal = safeDivide(next.cmoLot, next.animalCount);
  }
  if (["cmsLot", "animalCount"].includes(editedKey)) {
    next.cmsAnimal = safeDivide(next.cmsLot, next.animalCount);
  }
  if (
    ["cmsLot", "cmsAnimal", "animalCount", "estimatedWeight"].includes(
      editedKey,
    )
  ) {
    next.imsPct = safeDivide(next.cmsAnimal, next.estimatedWeight);
  }
  if (["nutritionalCostAnimal", "animalCount"].includes(editedKey)) {
    next.nutritionalCostLot =
      toNumber(next.nutritionalCostAnimal) * toNumber(next.animalCount);
  }

  next.financialAverage = toNumber(next.nutritionalCostAnimal);
  next.financialTotal = toNumber(next.nutritionalCostLot);
  return next;
}

function applyReportOverride(row, override = {}) {
  const merged = { ...row, ...override };
  if (!Object.hasOwn(override, "cmoAnimal")) {
    merged.cmoAnimal = safeDivide(merged.cmoLot, merged.animalCount);
  }
  if (!Object.hasOwn(override, "cmsAnimal")) {
    merged.cmsAnimal = safeDivide(merged.cmsLot, merged.animalCount);
  }
  if (!Object.hasOwn(override, "imsPct")) {
    merged.imsPct = safeDivide(merged.cmsAnimal, merged.estimatedWeight);
  }
  if (!Object.hasOwn(override, "nutritionalCostLot")) {
    merged.nutritionalCostLot =
      toNumber(merged.nutritionalCostAnimal) * toNumber(merged.animalCount);
  }
  if (!Object.hasOwn(override, "financialAverage")) {
    merged.financialAverage = toNumber(merged.nutritionalCostAnimal);
  }
  if (!Object.hasOwn(override, "financialTotal")) {
    merged.financialTotal = toNumber(merged.nutritionalCostLot);
  }
  return merged;
}

export function calculateReportRows(
  calculatedLots,
  consumptionRows,
  feedingPlan,
  calculatedDiets,
  reportOverrides = {},
) {
  return calculatedLots.map((lot) => {
    const consumption = consumptionRows.find((row) => row.lotId === lot.id);
    const cmoLot = toNumber(consumption?.moRealizedManual);
    const cmsLot = toNumber(consumption?.msRealizedManual);
    const cmoAnimal = safeDivide(cmoLot, lot.animalCount);
    const cmsAnimal = safeDivide(cmsLot, lot.animalCount);
    const imsPct = safeDivide(cmsAnimal, lot.estimatedWeight);
    const nutritionalCostAnimal = costPerAnimalFromModules(feedingPlan, lot.id);
    const nutritionalCostLot = nutritionalCostAnimal * toNumber(lot.animalCount);

    const row = {
      lotId: lot.id,
      pen: lot.pen,
      currentDiet: lot.currentDiet,
      dietName: calculatedDiets[lot.currentDiet]?.title ?? "",
      lotCode: lot.lotCode,
      animalCount: lot.animalCount,
      estimatedWeight: lot.estimatedWeight,
      cmoLot,
      cmoAnimal,
      cmsLot,
      cmsAnimal,
      imsPct,
      nutritionalCostAnimal,
      nutritionalCostLot,
      financialAverage: nutritionalCostAnimal,
      financialTotal: nutritionalCostLot,
    };

    return applyReportOverride(row, reportOverrides?.[lot.id]);
  });
}

export function calculateState(state) {
  const diets = calculateAllDiets(state.diets);
  const lots = calculateLots(state, diets);
  const dietTotals = calculateDietTotals(lots);
  const feedingPlan = calculateFeedingPlan(state, diets, lots);
  const consumptionRows = calculateConsumptionRows(state, lots, diets, feedingPlan);
  const reportRows = calculateReportRows(
    lots,
    consumptionRows,
    feedingPlan,
    diets,
    state.reportOverrides,
  );

  return {
    diets,
    lots,
    dietTotals,
    feedingPlan,
    consumptionRows,
    reportRows,
  };
}








