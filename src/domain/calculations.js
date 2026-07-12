import { dateDiffInDays, toNumber } from "./formatters.js?v=20260621-stage1-clean-all";

function sum(items, selector) {
  return items.reduce((total, item) => total + toNumber(selector(item)), 0);
}

function safeDivide(numerator, denominator) {
  const divisor = toNumber(denominator);
  return divisor === 0 ? 0 : toNumber(numerator) / divisor;
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
    const dryMatterPct = toNumber(ingredient.dryMatterPct);
    const inclusionMsPct = toNumber(ingredient.inclusionMsPct);
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
  totals.treatmentSharePct = sum(diet.treatments, (treatment) => treatment.sharePct);
  totals.treatmentAb2 =
    diet.id === "ADAPTACION"
      ? toNumber(diet.treatments[0]?.sharePct) +
        toNumber(diet.treatments[1]?.sharePct) +
        toNumber(diet.treatments[3]?.sharePct) +
        toNumber(diet.treatments[4]?.sharePct)
      : totals.treatmentSharePct;
  totals.treatmentAb3Basis =
    toNumber(diet.treatments[0]?.sharePct) +
    toNumber(diet.treatments[1]?.sharePct) +
    toNumber(diet.treatments[3]?.sharePct) +
    toNumber(diet.treatments[4]?.sharePct);
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

  return state.lots.map((lot) => {
    const diet = calculatedDiets[lot.currentDiet];
    const consumption = state.consumptionNotes[lot.id] ?? {};
    const daysInConfinement = dateDiffInDays(workDate, lot.entryDate);
    const estimatedWeight = toNumber(lot.initialWeight) + daysInConfinement * toNumber(lot.estimatedGmd);
    const initialCmsKg = toNumber(lot.initialWeight) * toNumber(lot.initialImsPct) * toNumber(lot.animalCount);
    const baseTotalMs =
      estimatedWeight *
      toNumber(lot.animalCount) *
      toNumber(lot.initialImsPct) *
      (1 + toNumber(lot.consumptionAdjustmentPct));
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
    const dietLots = calculatedLots.filter((lot) => lot.currentDiet === diet.id);
    const lotRows = dietLots.map((lot) => {
      const treatmentRows = diet.treatments.map((treatment) => {
        const expectedMo = lot.totalFeedMo * toNumber(treatment.sharePct);
        const expectedMs = expectedMo * diet.totals.dietDryMatterPct;
        const cost = expectedMo * diet.totals.costBsKg;

        return {
          treatment: treatment.number,
          time: treatment.time,
          sharePct: treatment.sharePct,
          expectedMo,
          expectedMs,
          realizedMo: expectedMo,
          realizedMs: expectedMs,
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
  const expectedByTreatment = Object.fromEntries(
    lotRow.treatmentRows.map((treatment) => [treatment.treatment, treatment]),
  );
  const manualActuals = Object.fromEntries(
    [1, 2, 3, 4, 5].map((number) => [
      number,
      state.feedingActuals?.[plan.dietId]?.[lotRow.lotId]?.[number],
    ]),
  );
  const realEspeTrato5 =
    toNumber(expectedByTreatment[1]?.expectedMo) +
    toNumber(expectedByTreatment[2]?.expectedMo) +
    toNumber(expectedByTreatment[4]?.expectedMo) +
    toNumber(expectedByTreatment[5]?.expectedMo) -
    (toNumber(manualActuals[4] ?? expectedByTreatment[4]?.expectedMo) +
      toNumber(manualActuals[2] ?? expectedByTreatment[2]?.expectedMo) +
      toNumber(manualActuals[1] ?? expectedByTreatment[1]?.expectedMo));
  const realizedMo = lotRow.treatmentRows.reduce((total, treatment) => {
    const storedActual = manualActuals[treatment.treatment];
    const fallbackActual =
      ["TRANSICION", "TERMINACION"].includes(plan.dietId) && treatment.treatment === 5
        ? realEspeTrato5
        : treatment.expectedMo;

    return total + toNumber(storedActual ?? fallbackActual);
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

export function calculateReportRows(calculatedLots, consumptionRows, feedingPlan) {
  return calculatedLots.filter(hasOperationalLot).map((lot) => {
    const consumption = consumptionRows.find((row) => row.lotId === lot.id);
    const planRow = feedingPlan[lot.currentDiet]?.lotRows.find((row) => row.lotId === lot.id);
    const cmoLot = consumption?.moRealizedManual || consumption?.realizedMo || 0;
    const cmsLot = consumption?.msRealizedManual || consumption?.realizedMs || 0;
    const cmoAnimal = safeDivide(cmoLot, lot.animalCount);
    const cmsAnimal = safeDivide(cmsLot, lot.animalCount);
    const imsPct = safeDivide(cmsAnimal, lot.estimatedWeight);
    const nutritionalCostAnimal = planRow?.costPerAnimal ?? 0;

    return {
      pen: lot.pen,
      currentDiet: lot.currentDiet,
      lotCode: lot.lotCode,
      animalCount: lot.animalCount,
      estimatedWeight: lot.estimatedWeight,
      cmoLot,
      cmoAnimal,
      cmsLot,
      cmsAnimal,
      imsPct,
      nutritionalCostAnimal,
      nutritionalCostLot: nutritionalCostAnimal * lot.animalCount,
    };
  });
}

export function calculateState(state) {
  const diets = calculateAllDiets(state.diets);
  const lots = calculateLots(state, diets);
  const dietTotals = calculateDietTotals(lots);
  const feedingPlan = calculateFeedingPlan(state, diets, lots);
  const consumptionRows = calculateConsumptionRows(state, lots, diets, feedingPlan);
  const reportRows = calculateReportRows(lots, calculateLegacyConsumptionRows(state, lots, feedingPlan), feedingPlan);

  return {
    diets,
    lots,
    dietTotals,
    feedingPlan,
    consumptionRows,
    reportRows,
  };
}








