import assert from "node:assert/strict";
import test from "node:test";

import { createEmptyPeriodState } from "../src/data/baseData.js";
import { calculateState } from "../src/domain/calculations.js";
import {
  getComputedState,
  getState,
  resetState,
  setDietLocked,
  setInitialDataLocked,
  setState,
  updateConfig,
  updateLot,
} from "../src/state/store.js";

const expectedDefaults = {
  version: 1,
  initialDataLocked: false,
  dietLocks: {
    ADAPTACION: false,
    TRANSICION: false,
    TERMINACION: false,
  },
};

test("new and legacy states receive unlocked access-control defaults", () => {
  assert.deepEqual(createEmptyPeriodState().accessControl, expectedDefaults);

  setState({
    config: { clientName: "Snapshot anterior" },
    diets: {},
    lots: [],
  });

  assert.deepEqual(getState().accessControl, expectedDefaults);
  assert.equal(getState().config.activeLotCount, 20);
});

test("active lot count is normalized when loading and editing local data", () => {
  setState({
    ...createEmptyPeriodState(),
    config: {
      ...createEmptyPeriodState().config,
      activeLotCount: 999,
    },
  });
  assert.equal(getState().config.activeLotCount, 20);

  updateConfig("activeLotCount", 0);
  assert.equal(getState().config.activeLotCount, 1);

  updateConfig("activeLotCount", 7.9);
  assert.equal(getState().config.activeLotCount, 7);
});

test("hidden lot data returns intact when the active count increases", () => {
  resetState();
  updateLot("lot-10", "lotCode", "LOTE-CONSERVADO");
  updateLot("lot-10", "animalCount", 45);

  updateConfig("activeLotCount", 4);
  assert.equal(getComputedState().lots.some((lot) => lot.id === "lot-10"), false);
  assert.equal(getState().lots[9].lotCode, "LOTE-CONSERVADO");

  updateConfig("activeLotCount", 10);
  const restoredLot = getComputedState().lots.find((lot) => lot.id === "lot-10");
  assert.equal(restoredLot.lotCode, "LOTE-CONSERVADO");
  assert.equal(restoredLot.animalCount, 45);
});

test("lock setters update state immutably and reject unknown diets", () => {
  resetState();
  const original = getState();
  const originalAccessControl = original.accessControl;

  assert.equal(setInitialDataLocked(true), true);
  const initialLocked = getState();
  assert.notStrictEqual(initialLocked, original);
  assert.notStrictEqual(initialLocked.accessControl, originalAccessControl);
  assert.equal(original.accessControl.initialDataLocked, false);
  assert.equal(initialLocked.accessControl.initialDataLocked, true);

  assert.equal(setDietLocked("ADAPTACION", true), true);
  const dietLocked = getState();
  assert.notStrictEqual(dietLocked, initialLocked);
  assert.equal(initialLocked.accessControl.dietLocks.ADAPTACION, false);
  assert.equal(dietLocked.accessControl.dietLocks.ADAPTACION, true);

  const beforeUnknownDiet = getState();
  assert.equal(setDietLocked("DESCONOCIDA", true), false);
  assert.strictEqual(getState(), beforeUnknownDiet);
});

test("saved lock metadata survives snapshot cloning and reload", () => {
  resetState();
  setInitialDataLocked(true);
  setDietLocked("ADAPTACION", true);
  setDietLocked("TERMINACION", true);

  const snapshot = JSON.parse(JSON.stringify(getState()));
  resetState();
  setState(snapshot);

  assert.deepEqual(getState().accessControl, {
    version: 1,
    initialDataLocked: true,
    dietLocks: {
      ADAPTACION: true,
      TRANSICION: false,
      TERMINACION: true,
    },
  });
});

test("malformed lock values fail safely without changing the schema", () => {
  setState({
    ...createEmptyPeriodState(),
    accessControl: {
      version: 999,
      initialDataLocked: "false",
      dietLocks: {
        ADAPTACION: 1,
        TRANSICION: true,
        TERMINACION: null,
        DESCONOCIDA: true,
      },
    },
  });

  assert.deepEqual(getState().accessControl, {
    version: 1,
    initialDataLocked: false,
    dietLocks: {
      ADAPTACION: false,
      TRANSICION: true,
      TERMINACION: false,
    },
  });
});

function assertFiniteNumbers(value, path = "computed") {
  if (typeof value === "number") {
    assert.equal(Number.isFinite(value), true, `${path} debe ser finito`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertFiniteNumbers(item, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, item]) => assertFiniteNumbers(item, `${path}.${key}`));
  }
}

test("locks do not change calculations across diets, feeding, consumption or report", () => {
  const emptyState = createEmptyPeriodState();
  const dietIds = ["ADAPTACION", "TRANSICION", "TERMINACION"];
  const seededState = {
    ...emptyState,
    diets: Object.fromEntries(
      Object.entries(emptyState.diets).map(([dietId, diet]) => [
        dietId,
        {
          ...diet,
          ingredients: diet.ingredients.map((ingredient, index) => ({
            ...ingredient,
            dryMatterPct: 0.82 + index * 0.01,
            inclusionMsPct: index === 0 ? 1 : 0,
            costBsTon: 200 + index * 10,
          })),
        },
      ]),
    ),
    lots: emptyState.lots.map((lot, index) =>
      index < dietIds.length
        ? {
            ...lot,
            lotCode: `LOTE-${index + 1}`,
            animalCount: 10 + index,
            initialWeight: 300 + index * 20,
            currentDiet: dietIds[index],
          }
        : lot,
    ),
    feedingActuals: Object.fromEntries(
      dietIds.map((dietId, index) => [
        dietId,
        {
          [`lot-${index + 1}`]: {
            1: 10 + index,
            2: 11 + index,
            3: 12 + index,
            4: 13 + index,
            5: 14 + index,
          },
        },
      ]),
    ),
    consumptionNotes: Object.fromEntries(
      dietIds.map((dietId, index) => [
        `lot-${index + 1}`,
        {
          msPlannedManual: 50 + index,
          msRealizedManual: 48 + index,
          moPlannedManual: 60 + index,
          moRealizedManual: 58 + index,
        },
      ]),
    ),
  };

  const unlocked = calculateState(seededState);
  const locked = calculateState({
    ...seededState,
    accessControl: {
      version: 1,
      initialDataLocked: true,
      dietLocks: {
        ADAPTACION: true,
        TRANSICION: true,
        TERMINACION: true,
      },
    },
  });

  assert.deepEqual(locked, unlocked);
  for (const dietId of dietIds) {
    assert.ok(locked.diets[dietId]);
    assert.ok(locked.feedingPlan[dietId]);
    assert.equal(
      locked.feedingPlan[dietId].lotRows.length,
      emptyState.lots.length,
    );
  }
  assert.equal(locked.consumptionRows.length, emptyState.lots.length);
  assert.equal(locked.reportRows.length, emptyState.lots.length);
  assertFiniteNumbers(locked);
});
