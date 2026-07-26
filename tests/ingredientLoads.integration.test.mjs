import assert from "node:assert/strict";
import test from "node:test";

import {
  getState,
  resetState,
  setState,
  updateTreatmentIngredientActual,
} from "../src/state/store.js";

test("manual ingredient loads update immutably and survive state reload", () => {
  resetState();
  const original = getState();

  assert.equal(
    updateTreatmentIngredientActual("ADAPTACION", 1, "ad-1", 123.45),
    true,
  );

  const updated = getState();
  assert.notStrictEqual(updated, original);
  assert.deepEqual(original.treatmentIngredientActuals, {});
  assert.equal(
    updated.treatmentIngredientActuals.ADAPTACION[1]["ad-1"],
    123.45,
  );

  const snapshot = JSON.parse(JSON.stringify(updated));
  resetState();
  setState(snapshot);

  assert.equal(
    getState().treatmentIngredientActuals.ADAPTACION[1]["ad-1"],
    123.45,
  );
});

test("manual ingredient loads reject unknown diets, treatments and ingredients", () => {
  resetState();
  const original = getState();

  assert.equal(
    updateTreatmentIngredientActual("DESCONOCIDA", 1, "ad-1", 10),
    false,
  );
  assert.equal(
    updateTreatmentIngredientActual("ADAPTACION", 99, "ad-1", 10),
    false,
  );
  assert.equal(
    updateTreatmentIngredientActual("ADAPTACION", 1, "desconocido", 10),
    false,
  );
  assert.strictEqual(getState(), original);
});

test("clearing a manual ingredient load restores the calculated value", () => {
  resetState();
  updateTreatmentIngredientActual("ADAPTACION", 1, "ad-1", 123.45);

  assert.equal(
    updateTreatmentIngredientActual("ADAPTACION", 1, "ad-1", null),
    true,
  );
  assert.deepEqual(getState().treatmentIngredientActuals, {});
});

test("unchanged rounded calculated loads do not become persistent overrides", () => {
  resetState();

  assert.equal(
    updateTreatmentIngredientActual(
      "ADAPTACION",
      1,
      "ad-1",
      123.46,
      123.456,
    ),
    true,
  );
  assert.deepEqual(getState().treatmentIngredientActuals, {});

  assert.equal(
    updateTreatmentIngredientActual(
      "ADAPTACION",
      1,
      "ad-1",
      123.45,
      123.456,
    ),
    true,
  );
  assert.equal(
    getState().treatmentIngredientActuals.ADAPTACION[1]["ad-1"],
    123.45,
  );
});
