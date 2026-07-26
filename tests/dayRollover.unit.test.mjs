import assert from "node:assert/strict";
import test from "node:test";

import { createEmptyPeriodState } from "../src/data/baseData.js";
import {
  buildNextWorkDayState,
  nextIsoDate,
} from "../src/domain/dayRollover.js";

test("nextIsoDate advances calendar dates without timezone drift", () => {
  assert.equal(nextIsoDate("2026-07-26"), "2026-07-27");
  assert.equal(nextIsoDate("2026-12-31"), "2027-01-01");
  assert.equal(nextIsoDate("2028-02-28"), "2028-02-29");
});

test("next day preserves master data and clears only daily operational values", () => {
  const emptyState = createEmptyPeriodState();
  const currentState = {
    ...emptyState,
    config: {
      ...emptyState.config,
      workDate: "2026-07-26",
    },
    lots: emptyState.lots.map((lot, index) =>
      index === 0
        ? {
            ...lot,
            entryDate: "2026-07-20",
            lotCode: "LOTE-1",
            animalCount: 150,
            initialWeight: 300,
            currentDiet: "ADAPTACION",
            consumptionAdjustmentPct: 0.05,
          }
        : lot,
    ),
    consumptionNotes: {
      "lot-1": {
        msPlannedManual: 100,
        msRealizedManual: 98,
        moPlannedManual: 120,
        moRealizedManual: 118,
      },
    },
    feedingActuals: {
      ADAPTACION: {
        "lot-1": { 1: 165, 2: 165, 3: 165, 4: 165, 5: 165 },
      },
    },
    treatmentIngredientActuals: {
      ADAPTACION: {
        1: { "ad-1": 40 },
      },
    },
    reportOverrides: {
      "lot-1": { cmoLot: 900 },
    },
    accessControl: {
      version: 1,
      initialDataLocked: true,
      dietLocks: {
        ADAPTACION: true,
        TRANSICION: false,
        TERMINACION: false,
      },
    },
  };

  const nextState = buildNextWorkDayState(currentState);

  assert.notStrictEqual(nextState, currentState);
  assert.equal(nextState.config.workDate, "2026-07-27");
  assert.deepEqual(nextState.diets, currentState.diets);
  assert.deepEqual(nextState.lots, currentState.lots);
  assert.equal(nextState.lots[0].consumptionAdjustmentPct, 0.05);
  assert.deepEqual(nextState.accessControl, currentState.accessControl);
  assert.deepEqual(nextState.consumptionNotes, {});
  assert.deepEqual(nextState.feedingActuals, {});
  assert.deepEqual(nextState.treatmentIngredientActuals, {});
  assert.deepEqual(nextState.reportOverrides, {});

  nextState.lots[0].lotCode = "CAMBIO";
  assert.equal(currentState.lots[0].lotCode, "LOTE-1");
});

test("rollover rejects invalid work dates", () => {
  assert.throws(() => nextIsoDate("26/07/2026"), /fecha de trabajo/i);
  assert.throws(
    () =>
      buildNextWorkDayState({
        ...createEmptyPeriodState(),
        config: { workDate: "" },
      }),
    /fecha de trabajo/i,
  );
});
