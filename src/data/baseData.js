export const baseDiets = {
  ADAPTACION: {
    id: "ADAPTACION",
    sheetCode: "ADAPT",
    title: "DIETA ADAPTACION",
    consumption: 0,
    estimatedGmd: 0,
    treatments: [
      { number: 1, time: "07:00", sharePct: 0.2 },
      { number: 2, time: "10:00", sharePct: 0.2 },
      { number: 3, time: "10:00", sharePct: 0.2 },
      { number: 4, time: "14:00", sharePct: 0.2 },
      { number: 5, time: "18:00", sharePct: 0.2 },
    ],
    ingredients: [
      { id: "ad-1", name: "Rollo de Pasto", dryMatterPct: 0, inclusionMsPct: 0, costBsTon: 0 },
      { id: "ad-2", name: "Sorgo Molido", dryMatterPct: 0, inclusionMsPct: 0, costBsTon: 0 },
      { id: "ad-3", name: "Maíz", dryMatterPct: 0, inclusionMsPct: 0, costBsTon: 0 },
      { id: "ad-4", name: "A. Arroz", dryMatterPct: 0, inclusionMsPct: 0, costBsTon: 0 },
      { id: "ad-5", name: "A. Trigo", dryMatterPct: 0, inclusionMsPct: 0, costBsTon: 0 },
      { id: "ad-6", name: "T. Girasol", dryMatterPct: 0, inclusionMsPct: 0, costBsTon: 0 },
      { id: "ad-7", name: "Soya Cruda", dryMatterPct: 0, inclusionMsPct: 0, costBsTon: 0 },
      { id: "ad-8", name: "Agua", dryMatterPct: 0, inclusionMsPct: 0, costBsTon: 0 },
      { id: "ad-9", name: "Núcleo", dryMatterPct: 0, inclusionMsPct: 0, costBsTon: 0 },
    ],
  },
  TRANSICION: {
    id: "TRANSICION",
    sheetCode: "TRANS",
    title: "DIETA TRANSICION",
    consumption: 0,
    estimatedGmd: 0,
    treatments: [
      { number: 1, time: "07:00", sharePct: 0.2 },
      { number: 2, time: "10:00", sharePct: 0.2 },
      { number: 3, time: "10:00", sharePct: 0.2 },
      { number: 4, time: "14:00", sharePct: 0.2 },
      { number: 5, time: "18:00", sharePct: 0.2 },
    ],
    ingredients: [
      { id: "tr-1", name: "Rollo de Pasto", dryMatterPct: 0, inclusionMsPct: 0, costBsTon: 0 },
      { id: "tr-2", name: "Sorgo Molido", dryMatterPct: 0, inclusionMsPct: 0, costBsTon: 0 },
      { id: "tr-3", name: "Maíz", dryMatterPct: 0, inclusionMsPct: 0, costBsTon: 0 },
      { id: "tr-4", name: "A. Arroz", dryMatterPct: 0, inclusionMsPct: 0, costBsTon: 0 },
      { id: "tr-5", name: "A. Trigo", dryMatterPct: 0, inclusionMsPct: 0, costBsTon: 0 },
      { id: "tr-6", name: "T. Girasol", dryMatterPct: 0, inclusionMsPct: 0, costBsTon: 0 },
      { id: "tr-7", name: "Soya Cruda", dryMatterPct: 0, inclusionMsPct: 0, costBsTon: 0 },
      { id: "tr-8", name: "Agua", dryMatterPct: 0, inclusionMsPct: 0, costBsTon: 0 },
      { id: "tr-9", name: "Núcleo", dryMatterPct: 0, inclusionMsPct: 0, costBsTon: 0 },
    ],
  },
  TERMINACION: {
    id: "TERMINACION",
    sheetCode: "TERM",
    title: "DIETA TERMINACION",
    consumption: 0,
    estimatedGmd: 0,
    treatments: [
      { number: 1, time: "07:00", sharePct: 0.2 },
      { number: 2, time: "10:00", sharePct: 0.2 },
      { number: 3, time: "10:00", sharePct: 0.2 },
      { number: 4, time: "14:00", sharePct: 0.2 },
      { number: 5, time: "18:00", sharePct: 0.2 },
    ],
    ingredients: [
      { id: "te-1", name: "Rollo de Pasto", dryMatterPct: 0, inclusionMsPct: 0, costBsTon: 0 },
      { id: "te-2", name: "Sorgo Molido", dryMatterPct: 0, inclusionMsPct: 0, costBsTon: 0 },
      { id: "te-3", name: "Maíz", dryMatterPct: 0, inclusionMsPct: 0, costBsTon: 0 },
      { id: "te-4", name: "A. Arroz", dryMatterPct: 0, inclusionMsPct: 0, costBsTon: 0 },
      { id: "te-5", name: "A. Trigo", dryMatterPct: 0, inclusionMsPct: 0, costBsTon: 0 },
      { id: "te-6", name: "T. Girasol", dryMatterPct: 0, inclusionMsPct: 0, costBsTon: 0 },
      { id: "te-7", name: "H. de Soya", dryMatterPct: 0, inclusionMsPct: 0, costBsTon: 0 },
      { id: "te-8", name: "Agua", dryMatterPct: 0, inclusionMsPct: 0, costBsTon: 0 },
      { id: "te-9", name: "Núcleo", dryMatterPct: 0, inclusionMsPct: 0, costBsTon: 0 },
    ],
  },
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function buildEmptyLots(totalLots = 20) {
  return Array.from({ length: totalLots }, (_, index) => {
    const lotNumber = index + 1;
    return {
      id: `lot-${lotNumber}`,
      entryDate: "",
      pen: `A-${lotNumber}`,
      lotCode: "",
      animalCount: "",
      initialWeight: "",
      initialImsPct: 0.016,
      estimatedGmd: 1.5,
      currentDiet: "",
      consumptionAdjustmentPct: 0,
    };
  });
}

export function createEmptyPeriodState() {
  return {
    config: {
      clientName: "Confinamiento Arizona",
      startDate: "",
      workDate: todayIso(),
      activeLotCount: 20,
    },
    diets: JSON.parse(JSON.stringify(baseDiets)),
    lots: buildEmptyLots(20),
    consumptionNotes: {},
    feedingActuals: {},
    treatmentIngredientActuals: {},
    reportOverrides: {},
    accessControl: {
      version: 1,
      initialDataLocked: false,
      dietLocks: {
        ADAPTACION: false,
        TRANSICION: false,
        TERMINACION: false,
      },
    },
  };
}

export const baseData = createEmptyPeriodState();
