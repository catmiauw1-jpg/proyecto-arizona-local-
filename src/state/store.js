import { sampleData } from "../data/sampleData.js";
import { calculateState } from "../domain/calculations.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

let state = clone(sampleData);
const listeners = new Set();

export function getState() {
  return state;
}

export function getComputedState() {
  return calculateState(state);
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  listeners.forEach((listener) => listener());
}

export function updateConfig(key, value) {
  state = {
    ...state,
    config: { ...state.config, [key]: value },
  };
  emit();
}

export function updateDietField(dietId, key, value) {
  state = {
    ...state,
    diets: {
      ...state.diets,
      [dietId]: { ...state.diets[dietId], [key]: value },
    },
  };
  emit();
}

export function updateIngredient(dietId, ingredientId, key, value) {
  const diet = state.diets[dietId];
  state = {
    ...state,
    diets: {
      ...state.diets,
      [dietId]: {
        ...diet,
        ingredients: diet.ingredients.map((ingredient) =>
          ingredient.id === ingredientId ? { ...ingredient, [key]: value } : ingredient,
        ),
      },
    },
  };
  emit();
}

export function updateTreatment(dietId, treatmentNumber, key, value) {
  const diet = state.diets[dietId];
  state = {
    ...state,
    diets: {
      ...state.diets,
      [dietId]: {
        ...diet,
        treatments: diet.treatments.map((treatment) =>
          treatment.number === treatmentNumber ? { ...treatment, [key]: value } : treatment,
        ),
      },
    },
  };
  emit();
}

export function updateLot(lotId, key, value) {
  state = {
    ...state,
    lots: state.lots.map((lot) => (lot.id === lotId ? { ...lot, [key]: value } : lot)),
  };
  emit();
}

export function updateConsumption(lotId, key, value) {
  state = {
    ...state,
    consumptionNotes: {
      ...state.consumptionNotes,
      [lotId]: {
        ...(state.consumptionNotes[lotId] ?? {}),
        [key]: value,
      },
    },
  };
  emit();
}

export function applyConsumptionFromCalculated(consumptionRows) {
  const consumptionNotes = { ...state.consumptionNotes };

  consumptionRows.forEach((row) => {
    consumptionNotes[row.lotId] = {
      ...(consumptionNotes[row.lotId] ?? {}),
      msPlannedManual: row.expectedMs,
      msRealizedManual: row.realizedMs,
      moPlannedManual: row.expectedMo,
      moRealizedManual: row.realizedMo,
    };
  });

  state = {
    ...state,
    consumptionNotes,
  };
  emit();
}
