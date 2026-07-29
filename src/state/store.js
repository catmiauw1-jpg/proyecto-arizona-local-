import { createEmptyPeriodState } from "../data/baseData.js?v=20260723-editable-loads-v2";
import {
  calculateState,
  normalizeActiveLotCount,
} from "../domain/calculations.js?v=20260727-active-lots-v1";

import { DIET_IDS, createDefaultAccessControl } from "../domain/permissions.js?v=20260727-history-delete-v1";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

let state = clone(createEmptyPeriodState());
const listeners = new Set();

export function getState() {
  return state;
}

export function setState(nextState) {
  const emptyState = createEmptyPeriodState();
  const accessControl = nextState?.accessControl ?? {};
  const dietLocks = accessControl.dietLocks ?? {};

  state = clone({
    ...emptyState,
    ...(nextState ?? {}),
    config: {
      ...emptyState.config,
      ...(nextState?.config ?? {}),
      activeLotCount: normalizeActiveLotCount(
        nextState?.config?.activeLotCount,
      ),
    },
    diets: nextState?.diets ?? emptyState.diets,
    lots: nextState?.lots ?? emptyState.lots,
    consumptionNotes: nextState?.consumptionNotes ?? {},
    feedingActuals: nextState?.feedingActuals ?? {},
    treatmentIngredientActuals: nextState?.treatmentIngredientActuals ?? {},
    reportOverrides: nextState?.reportOverrides ?? {},
    accessControl: {
      ...createDefaultAccessControl(),
      initialDataLocked: accessControl.initialDataLocked === true,
      dietLocks: Object.fromEntries(
        DIET_IDS.map((dietId) => [dietId, dietLocks[dietId] === true]),
      ),
    },
  });
  emit();
}

export function resetState(overrides = {}) {
  setState({
    ...createEmptyPeriodState(),
    ...overrides,
    config: {
      ...createEmptyPeriodState().config,
      ...(overrides.config ?? {}),
    },
  });
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
  const nextValue =
    key === "activeLotCount" ? normalizeActiveLotCount(value) : value;
  state = {
    ...state,
    config: { ...state.config, [key]: nextValue },
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

export function updateFeedingActual(dietId, lotId, treatmentNumber, value) {
  const dietActuals = state.feedingActuals?.[dietId] ?? {};
  const lotActuals = dietActuals[lotId] ?? {};

  state = {
    ...state,
    feedingActuals: {
      ...(state.feedingActuals ?? {}),
      [dietId]: {
        ...dietActuals,
        [lotId]: {
          ...lotActuals,
          [treatmentNumber]: value,
        },
      },
    },
  };
  emit();
}

export function updateReportOverride(lotId, key, value) {
  const lotOverrides = state.reportOverrides?.[lotId] ?? {};
  state = {
    ...state,
    reportOverrides: {
      ...(state.reportOverrides ?? {}),
      [lotId]: {
        ...lotOverrides,
        [key]: value,
      },
    },
  };
  emit();
}

export function clearReportOverrides() {
  state = {
    ...state,
    reportOverrides: {},
  };
  emit();
}

export function updateTreatmentIngredientActual(
  dietId,
  treatmentNumber,
  ingredientId,
  value,
  calculatedValue,
) {
  const diet = state.diets[dietId];
  const hasTreatment = diet?.treatments.some(
    (treatment) => treatment.number === treatmentNumber,
  );
  const hasIngredient = diet?.ingredients.some(
    (ingredient) => ingredient.id === ingredientId,
  );

  if (!diet || !hasTreatment || !hasIngredient) {
    return false;
  }

  const normalizedValue =
    value !== null &&
    calculatedValue !== undefined &&
    calculatedValue !== null &&
    calculatedValue !== "" &&
    Number.isFinite(Number(value)) &&
    Number.isFinite(Number(calculatedValue)) &&
    Math.abs(Number(value) - Number(calculatedValue)) <= 0.005 + Number.EPSILON
      ? null
      : value;
  const dietActuals = state.treatmentIngredientActuals?.[dietId] ?? {};
  const treatmentActuals = dietActuals[treatmentNumber] ?? {};

  if (normalizedValue === null) {
    const { [ingredientId]: removedIngredient, ...remainingTreatmentActuals } =
      treatmentActuals;
    const { [treatmentNumber]: removedTreatment, ...otherTreatmentActuals } =
      dietActuals;
    const nextDietActuals = Object.keys(remainingTreatmentActuals).length
      ? {
          ...otherTreatmentActuals,
          [treatmentNumber]: remainingTreatmentActuals,
        }
      : otherTreatmentActuals;
    const {
      [dietId]: removedDiet,
      ...otherDietActuals
    } = state.treatmentIngredientActuals ?? {};
    const nextIngredientActuals = Object.keys(nextDietActuals).length
      ? {
          ...otherDietActuals,
          [dietId]: nextDietActuals,
        }
      : otherDietActuals;

    state = {
      ...state,
      treatmentIngredientActuals: nextIngredientActuals,
    };
    emit();
    return true;
  }

  state = {
    ...state,
    treatmentIngredientActuals: {
      ...(state.treatmentIngredientActuals ?? {}),
      [dietId]: {
        ...dietActuals,
        [treatmentNumber]: {
          ...treatmentActuals,
          [ingredientId]: normalizedValue,
        },
      },
    },
  };
  emit();
  return true;
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

export function setInitialDataLocked(locked) {
  state = {
    ...state,
    accessControl: {
      ...state.accessControl,
      initialDataLocked: locked === true,
    },
  };
  emit();
  return true;
}

export function setDietLocked(dietId, locked) {
  if (!DIET_IDS.includes(dietId)) return false;

  state = {
    ...state,
    accessControl: {
      ...state.accessControl,
      dietLocks: {
        ...state.accessControl.dietLocks,
        [dietId]: locked === true,
      },
    },
  };
  emit();
  return true;
}






