import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateDiet,
  calculateFifthTreatmentBalance,
  calculateState,
  calculateTreatmentIngredientLoads,
  hasOperationalLot,
  normalizeActiveLotCount,
  recalculateReportRow,
} from "../src/domain/calculations.js";

function buildDiet(overrides = {}) {
  return {
    id: "ADAPTACION",
    treatments: [
      { number: 1, sharePct: 0.2 },
      { number: 2, sharePct: 0.2 },
      { number: 3, sharePct: 0.2 },
      { number: 4, sharePct: 0.2 },
      { number: 5, sharePct: 0.2 },
    ],
    ingredients: [
      {
        id: "rollo",
        name: "Rollo",
        dryMatterPct: 0.5,
        inclusionMsPct: 0.25,
        costBsTon: 400,
      },
      {
        id: "cascarilla",
        name: "Cascarilla",
        dryMatterPct: 1,
        inclusionMsPct: 0.5,
        costBsTon: 800,
      },
    ],
    ...overrides,
  };
}

function buildAllDiets() {
  return Object.fromEntries(
    ["ADAPTACION", "TRANSICION", "TERMINACION"].map((id) => [
      id,
      buildDiet({
        id,
        title: `DIETA ${id}`,
        treatments: buildDiet().treatments.map((treatment) => ({
          ...treatment,
          time: "07:00",
        })),
      }),
    ]),
  );
}

test("AB2 and AB3 include all five treatment percentages", () => {
  const calculated = calculateDiet(buildDiet());

  assert.equal(calculated.totals.treatmentAb2, 1);
  assert.equal(calculated.totals.treatmentAb3Basis, 1);
  assert.equal(calculated.totals.treatmentStatus, "Correcto");
});

test("whole-number diet percentages keep MO totals at the full-lot scale", () => {
  const diets = buildAllDiets();
  diets.ADAPTACION = buildDiet({
    id: "ADAPTACION",
    title: "DIETA ADAPTACION",
    ingredients: [
      {
        id: "rollo",
        name: "Rollo",
        dryMatterPct: 88,
        inclusionMsPct: 100,
        costBsTon: 500,
      },
    ],
  });
  const state = {
    config: { workDate: "2026-07-24" },
    diets,
    lots: [
      {
        id: "lot-1",
        entryDate: "2026-07-24",
        pen: "A-1",
        lotCode: "LOTE-1",
        animalCount: 150,
        initialWeight: 300,
        initialImsPct: 1.6,
        estimatedGmd: 0,
        currentDiet: "ADAPTACION",
        consumptionAdjustmentPct: 0,
      },
    ],
    consumptionNotes: {},
    feedingActuals: {},
  };

  const calculated = calculateState(state);
  const lot = calculated.lots[0];

  assert.equal(calculated.diets.ADAPTACION.totals.dietDryMatterPct, 0.88);
  assert.equal(lot.totalFeedMs, 720);
  assert.ok(Math.abs(lot.totalFeedMo - 818.1818181818181) < 1e-9);
  assert.ok(
    Math.abs(calculated.feedingPlan.ADAPTACION.lotRows[0].treatmentRows[0].expectedMo - 163.63636363636363) <
      1e-9,
  );
});

test("a future entry date never produces negative confinement days", () => {
  const computed = calculateState({
    config: {
      workDate: "2026-07-27",
      activeLotCount: 1,
    },
    diets: buildAllDiets(),
    lots: [
      {
        id: "lot-1",
        entryDate: "2026-07-29",
        pen: "A-1",
        lotCode: "NUEVO",
        animalCount: 10,
        initialWeight: 300,
        initialImsPct: 1.6,
        estimatedGmd: 1.5,
        currentDiet: "ADAPTACION",
        consumptionAdjustmentPct: 0,
      },
    ],
    consumptionNotes: {},
    feedingActuals: {},
    treatmentIngredientActuals: {},
    reportOverrides: {},
  });

  assert.equal(computed.lots[0].daysInConfinement, 0);
  assert.equal(computed.lots[0].estimatedWeight, 300);
});

test("active lot count is normalized to the supported range", () => {
  assert.equal(normalizeActiveLotCount(undefined), 20);
  assert.equal(normalizeActiveLotCount("4"), 4);
  assert.equal(normalizeActiveLotCount(4.9), 4);
  assert.equal(normalizeActiveLotCount(0), 1);
  assert.equal(normalizeActiveLotCount(21), 20);
  assert.equal(normalizeActiveLotCount(Number.NaN), 20);
});

test("active lot count excludes hidden lots from every calculated module", () => {
  const lots = [1, 2, 3, 4].map((number) => ({
    id: `lot-${number}`,
    entryDate: "2026-07-24",
    pen: `A-${number}`,
    lotCode: `LOTE-${number}`,
    animalCount: number === 3 ? 999 : number * 10,
    initialWeight: 300,
    initialImsPct: 0.016,
    estimatedGmd: 0,
    currentDiet: "ADAPTACION",
    consumptionAdjustmentPct: 0,
  }));
  const state = {
    config: {
      workDate: "2026-07-24",
      activeLotCount: 2,
    },
    diets: buildAllDiets(),
    lots,
    consumptionNotes: {},
    feedingActuals: {},
    reportOverrides: {},
  };

  const calculated = calculateState(state);

  assert.equal(state.lots.length, 4);
  assert.deepEqual(
    calculated.lots.map((lot) => lot.id),
    ["lot-1", "lot-2"],
  );
  assert.equal(calculated.consumptionRows.length, 2);
  assert.equal(calculated.reportRows.length, 2);
  Object.values(calculated.feedingPlan).forEach((plan) => {
    assert.deepEqual(
      plan.lotRows.map((row) => row.lotId),
      ["lot-1", "lot-2"],
    );
  });
  assert.equal(
    calculated.dietTotals.ADAPTACION.totalFeedMs,
    calculated.lots[0].totalFeedMs + calculated.lots[1].totalFeedMs,
  );
  assert.equal(
    calculated.reportRows.some((row) => row.lotId === "lot-3"),
    false,
  );
});

test("Excel ADAPTACION flow distributes four lots across all five treatments", () => {
  const state = {
    config: { workDate: "2026-07-24" },
    diets: buildAllDiets(),
    lots: [
      {
        id: "lot-1",
        entryDate: "2026-07-24",
        pen: "A-1",
        lotCode: "1",
        animalCount: 150,
        initialWeight: 300,
        initialImsPct: 0.016,
        estimatedGmd: 1.5,
        currentDiet: "ADAPTACION",
        consumptionAdjustmentPct: 0,
      },
      {
        id: "lot-2",
        entryDate: "2026-07-24",
        pen: "A-2",
        lotCode: "2",
        animalCount: 120,
        initialWeight: 323,
        initialImsPct: 0.016,
        estimatedGmd: 1.5,
        currentDiet: "ADAPTACION",
        consumptionAdjustmentPct: 0,
      },
      {
        id: "lot-3",
        entryDate: "2026-07-24",
        pen: "A-3",
        lotCode: "3",
        animalCount: 100,
        initialWeight: 350,
        initialImsPct: 0.016,
        estimatedGmd: 1.5,
        currentDiet: "ADAPTACION",
        consumptionAdjustmentPct: 0,
      },
      {
        id: "lot-4",
        entryDate: "2026-07-24",
        pen: "A-4",
        lotCode: "4",
        animalCount: 55,
        initialWeight: 400,
        initialImsPct: 0.016,
        estimatedGmd: 1.5,
        currentDiet: "ADAPTACION",
        consumptionAdjustmentPct: 0,
      },
    ],
    consumptionNotes: {},
    feedingActuals: {},
  };
  state.diets.ADAPTACION = buildDiet({
    id: "ADAPTACION",
    title: "DIETA ADAPTACION",
    ingredients: [
      {
        id: "rollo",
        name: "Rollo de Pasto",
        dryMatterPct: 0.88,
        inclusionMsPct: 0.2,
        costBsTon: 500,
      },
      {
        id: "sorgo",
        name: "Sorgo Molido",
        dryMatterPct: 0.89149,
        inclusionMsPct: 0.8,
        costBsTon: 2600,
      },
    ],
  });

  const calculated = calculateState(state);
  const adaptation = calculated.feedingPlan.ADAPTACION;
  const firstLotTreatments = adaptation.lotRows[0].treatmentRows;
  const firstTreatmentLoads = calculateTreatmentIngredientLoads(
    calculated.diets.ADAPTACION,
    calculated.dietTotals.ADAPTACION.totalFeedMo,
    state.diets.ADAPTACION.treatments[0],
  );

  assert.ok(
    Math.abs(calculated.dietTotals.ADAPTACION.totalFeedMo - 2532.884506530945) <
      1e-9,
  );
  assert.equal(firstLotTreatments.length, 5);
  firstLotTreatments.forEach((treatment) => {
    assert.ok(Math.abs(treatment.expectedMo - 161.94913724622415) < 1e-9);
  });
  assert.ok(Math.abs(firstTreatmentLoads[0].kg - 102.37090909090908) < 1e-9);
  assert.ok(Math.abs(firstTreatmentLoads[1].kg - 404.20599221528) < 1e-9);
  assert.ok(
    Math.abs(
      firstTreatmentLoads.reduce((total, ingredient) => total + ingredient.kg, 0) -
        adaptation.expectedMo / 5,
    ) < 1e-9,
  );
});

test("historical report corrections recalculate dependent values", () => {
  const correctedCmo = recalculateReportRow(
    {
      animalCount: 10,
      estimatedWeight: 300,
      cmoLot: 99,
      cmoAnimal: 1,
      cmsLot: 60,
      cmsAnimal: 6,
      imsPct: 0.02,
      nutritionalCostAnimal: 4,
      nutritionalCostLot: 40,
    },
    "cmoLot",
  );
  assert.equal(correctedCmo.cmoAnimal, 9.9);

  const correctedAnimals = recalculateReportRow(
    { ...correctedCmo, animalCount: 20 },
    "animalCount",
  );
  assert.equal(correctedAnimals.cmoAnimal, 4.95);
  assert.equal(correctedAnimals.cmsAnimal, 3);
  assert.equal(correctedAnimals.imsPct, 0.01);
  assert.equal(correctedAnimals.nutritionalCostLot, 80);
});

test("ingredient loads follow total MO x normalized inclusion x treatment share", () => {
  const calculated = calculateDiet(buildDiet());
  const loads = calculateTreatmentIngredientLoads(calculated, 1_000, {
    number: 1,
    sharePct: 0.2,
  });

  assert.deepEqual(
    loads.map(({ name, kg }) => ({ name, kg })),
    [
      { name: "Rollo", kg: 100 },
      { name: "Cascarilla", kg: 100 },
    ],
  );
  assert.equal(loads[0].ingredientId, "rollo");
  assert.equal(loads.reduce((total, row) => total + row.kg, 0), 200);
});

test("fifth treatment balance includes deviations from the third treatment", () => {
  const expectedByTreatment = Object.fromEntries(
    [1, 2, 3, 4, 5].map((number) => [number, { expectedMo: 100 }]),
  );
  const manualActuals = {
    1: 90,
    2: 100,
    3: 80,
    4: 110,
  };

  assert.equal(calculateFifthTreatmentBalance(expectedByTreatment, manualActuals), 120);
});

test("fifth treatment recommendation affects totals only after it is recorded", () => {
  const diets = buildAllDiets();
  const baseState = {
    config: { workDate: "2026-04-22" },
    diets,
    lots: [
      {
        id: "lot-1",
        entryDate: "2026-04-12",
        pen: "A-1",
        lotCode: "20251",
        animalCount: 10,
        initialWeight: 300,
        initialImsPct: 0.02,
        estimatedGmd: 1,
        currentDiet: "TRANSICION",
        consumptionAdjustmentPct: 0,
      },
    ],
    consumptionNotes: { "lot-1": {} },
    feedingActuals: {},
  };
  const initial = calculateState(baseState);
  const expected = initial.feedingPlan.TRANSICION.lotRows[0].treatmentRows[0].expectedMo;
  const withActuals = {
    ...baseState,
    feedingActuals: {
      TRANSICION: {
        "lot-1": {
          1: expected - 10,
          2: expected,
          3: expected - 20,
          4: expected + 10,
        },
      },
    },
  };
  const unbalanced = calculateState(withActuals);
  assert.ok(
    unbalanced.consumptionRows[0].realizedMo <
      unbalanced.consumptionRows[0].expectedMo,
  );

  const recommendedFifth = calculateFifthTreatmentBalance(
    Object.fromEntries(
      initial.feedingPlan.TRANSICION.lotRows[0].treatmentRows.map(
        (treatment) => [treatment.treatment, treatment],
      ),
    ),
    withActuals.feedingActuals.TRANSICION["lot-1"],
  );
  const withRecommendedFifth = {
    ...withActuals,
    feedingActuals: {
      TRANSICION: {
        "lot-1": {
          ...withActuals.feedingActuals.TRANSICION["lot-1"],
          5: recommendedFifth,
        },
      },
    },
  };
  const balanced = calculateState(withRecommendedFifth);
  const consumption = balanced.consumptionRows[0];
  assert.ok(Math.abs(consumption.realizedMo - consumption.expectedMo) < 1e-9);

  const withAppliedConsumption = {
    ...withRecommendedFifth,
    consumptionNotes: {
      "lot-1": {
        msPlannedManual: consumption.expectedMs,
        msRealizedManual: consumption.realizedMs,
        moPlannedManual: consumption.expectedMo,
        moRealizedManual: consumption.realizedMo,
      },
    },
  };
  const report = calculateState(withAppliedConsumption).reportRows[0];

  assert.ok(Math.abs(report.cmoLot - consumption.realizedMo) < 1e-9);
  assert.ok(Math.abs(report.cmsLot - consumption.realizedMs) < 1e-9);
});

test("all diet modules consolidate realized feed and cost by piquete", () => {
  const diets = buildAllDiets();
  const baseState = {
    config: { workDate: "2026-04-22" },
    diets,
    lots: [
      {
        id: "lot-1",
        entryDate: "2026-04-12",
        pen: "A-1",
        lotCode: "20251",
        animalCount: 10,
        initialWeight: 300,
        initialImsPct: 0.02,
        estimatedGmd: 1,
        currentDiet: "ADAPTACION",
        consumptionAdjustmentPct: 0,
      },
    ],
    consumptionNotes: { "lot-1": {} },
    feedingActuals: {},
  };
  const initial = calculateState(baseState);
  const expectedMo =
    initial.feedingPlan.ADAPTACION.lotRows[0].expectedMo;

  for (const dietId of ["ADAPTACION", "TRANSICION", "TERMINACION"]) {
    assert.equal(initial.feedingPlan[dietId].lotRows.length, 1);
  }
  assert.equal(initial.feedingPlan.TRANSICION.lotRows[0].expectedMo, 0);
  assert.equal(initial.feedingPlan.TERMINACION.lotRows[0].expectedMo, 0);

  const connected = calculateState({
    ...baseState,
    feedingActuals: {
      TRANSICION: { "lot-1": { 1: 7 } },
      TERMINACION: { "lot-1": { 2: 3 } },
    },
  });
  const consumption = connected.consumptionRows[0];
  const expectedCost =
    expectedMo * connected.diets.ADAPTACION.totals.costBsKg +
    7 * connected.diets.TRANSICION.totals.costBsKg +
    3 * connected.diets.TERMINACION.totals.costBsKg;

  assert.ok(Math.abs(consumption.expectedMo - expectedMo) < 1e-9);
  assert.ok(Math.abs(consumption.realizedMo - (expectedMo + 10)) < 1e-9);
  assert.ok(
    Math.abs(connected.reportRows[0].nutritionalCostLot - expectedCost) < 1e-9,
  );
});

test("report overrides preserve an administrator correction without changing source modules", () => {
  const diets = buildAllDiets();
  const baseState = {
    config: { workDate: "2026-07-24" },
    diets,
    lots: [
      {
        id: "lot-1",
        entryDate: "2026-07-24",
        pen: "A-1",
        lotCode: "LOTE-1",
        animalCount: 10,
        initialWeight: 300,
        initialImsPct: 0.02,
        estimatedGmd: 0,
        currentDiet: "ADAPTACION",
        consumptionAdjustmentPct: 0,
      },
    ],
    consumptionNotes: {
      "lot-1": {
        msRealizedManual: 60,
        moRealizedManual: 75,
      },
    },
    feedingActuals: {},
    reportOverrides: {
      "lot-1": {
        cmoLot: 80,
      },
    },
  };

  const calculated = calculateState(baseState);

  assert.equal(calculated.consumptionRows[0].moRealizedManual, 75);
  assert.equal(calculated.reportRows[0].cmoLot, 80);
  assert.equal(calculated.reportRows[0].cmoAnimal, 8);
});

test("operational lot detection remains fail-safe for empty and adjusted rows", () => {
  assert.equal(hasOperationalLot({}), false);
  assert.equal(hasOperationalLot({ consumptionAdjustmentPct: 0.1 }), true);
});
