function buildLots() {
  const seedLots = [
    { id: "lot-1", entryDate: "2025-09-08", pen: "A-1", lotCode: 20251, animalCount: 84, initialWeight: 380, initialImsPct: 0.016, estimatedGmd: 1.5, currentDiet: "TERMINACION", consumptionAdjustmentPct: 0 },
    { id: "lot-2", entryDate: "2025-08-29", pen: "A-2", lotCode: 20252, animalCount: 76, initialWeight: 350, initialImsPct: 0.016, estimatedGmd: 1.5, currentDiet: "TERMINACION", consumptionAdjustmentPct: 0 },
    { id: "lot-3", entryDate: "2025-08-29", pen: "A-3", lotCode: 20253, animalCount: 68, initialWeight: 400, initialImsPct: 0.016, estimatedGmd: 1.5, currentDiet: "TRANSICION", consumptionAdjustmentPct: 0 },
    { id: "lot-4", entryDate: "2025-08-21", pen: "A-4", lotCode: 20254, animalCount: 90, initialWeight: 350, initialImsPct: 0.016, estimatedGmd: 1.5, currentDiet: "ADAPTACION", consumptionAdjustmentPct: 0 },
    { id: "lot-5", entryDate: "2025-08-21", pen: "A-5", lotCode: 20255, animalCount: 72, initialWeight: 320, initialImsPct: 0.016, estimatedGmd: 1.5, currentDiet: "ADAPTACION", consumptionAdjustmentPct: 0 },
  ];

  const generatedLots = Array.from({ length: 15 }, (_, index) => {
    const lotNumber = index + 6;
    return {
      id: `lot-${lotNumber}`,
      entryDate: "2025-08-21",
      pen: `A-${lotNumber}`,
      lotCode: 20250 + lotNumber,
      animalCount: 0,
      initialWeight: 380,
      initialImsPct: 0.016,
      estimatedGmd: 1.5,
      currentDiet: "ADAPTACION",
      consumptionAdjustmentPct: 0,
    };
  });

  return [...seedLots, ...generatedLots];
}

function buildConsumptionNotes(totalLots) {
  return Object.fromEntries(
    Array.from({ length: totalLots }, (_, index) => [
      `lot-${index + 1}`,
      { msPlannedManual: 0, msRealizedManual: 0, moPlannedManual: 0, moRealizedManual: 0 },
    ]),
  );
}

export const sampleData = {
  config: {
    clientName: "Arizona",
    startDate: "2025-08-21",
    workDate: "2026-06-19",
  },
  diets: {
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
        { id: "ad-1", name: "Rollo de Pasto", dryMatterPct: 0.88, inclusionMsPct: 0, costBsTon: 0 },
        { id: "ad-2", name: "Sorgo Molido", dryMatterPct: 0.89149, inclusionMsPct: 0.32, costBsTon: 1450 },
        { id: "ad-3", name: "Maiz", dryMatterPct: 0.8835, inclusionMsPct: 0.24, costBsTon: 1700 },
        { id: "ad-4", name: "A. Arroz", dryMatterPct: 0.91, inclusionMsPct: 0.12, costBsTon: 1250 },
        { id: "ad-5", name: "A. Trigo", dryMatterPct: 0.886, inclusionMsPct: 0.1, costBsTon: 1300 },
        { id: "ad-6", name: "T. Girasol", dryMatterPct: 0.9, inclusionMsPct: 0.06, costBsTon: 1850 },
        { id: "ad-7", name: "Soya Cruda", dryMatterPct: 0.9, inclusionMsPct: 0.04, costBsTon: 2600 },
        { id: "ad-8", name: "Agua", dryMatterPct: 0.0001, inclusionMsPct: 0, costBsTon: 0 },
        { id: "ad-9", name: "Nucleo", dryMatterPct: 0.97, inclusionMsPct: 0.12, costBsTon: 4200 },
      ],
    },
    TRANSICION: {
      id: "TRANSICION",
      sheetCode: "TRANS",
      title: "DIETA TRANSICION",
      consumption: 0,
      estimatedGmd: 1.5,
      treatments: [
        { number: 1, time: "07:00", sharePct: 0.2 },
        { number: 2, time: "10:00", sharePct: 0.2 },
        { number: 3, time: "10:00", sharePct: 0.2 },
        { number: 4, time: "14:00", sharePct: 0.2 },
        { number: 5, time: "18:00", sharePct: 0.2 },
      ],
      ingredients: [
        { id: "tr-1", name: "Rollo de Pasto", dryMatterPct: 0.88, inclusionMsPct: 0.06, costBsTon: 0 },
        { id: "tr-2", name: "Sorgo Molido", dryMatterPct: 0.89149, inclusionMsPct: 0.3, costBsTon: 1450 },
        { id: "tr-3", name: "Maiz", dryMatterPct: 0.8835, inclusionMsPct: 0.26, costBsTon: 1700 },
        { id: "tr-4", name: "A. Arroz", dryMatterPct: 0.91, inclusionMsPct: 0.1, costBsTon: 1250 },
        { id: "tr-5", name: "A. Trigo", dryMatterPct: 0.886, inclusionMsPct: 0.08, costBsTon: 1300 },
        { id: "tr-6", name: "T. Girasol", dryMatterPct: 0.9, inclusionMsPct: 0.06, costBsTon: 1850 },
        { id: "tr-7", name: "Soya Cruda", dryMatterPct: 0.9, inclusionMsPct: 0.04, costBsTon: 2600 },
        { id: "tr-8", name: "Agua", dryMatterPct: 0.0001, inclusionMsPct: 0, costBsTon: 0 },
        { id: "tr-9", name: "Nucleo", dryMatterPct: 0.97, inclusionMsPct: 0.1, costBsTon: 4200 },
      ],
    },
    TERMINACION: {
      id: "TERMINACION",
      sheetCode: "TERM",
      title: "DIETA TERMINACION",
      consumption: 0,
      estimatedGmd: 1.5,
      treatments: [
        { number: 1, time: "07:00", sharePct: 0.2 },
        { number: 2, time: "10:00", sharePct: 0.2 },
        { number: 3, time: "10:00", sharePct: 0.2 },
        { number: 4, time: "14:00", sharePct: 0.2 },
        { number: 5, time: "18:00", sharePct: 0.2 },
      ],
      ingredients: [
        { id: "te-1", name: "Rollo de Pasto", dryMatterPct: 0.88, inclusionMsPct: 0.03, costBsTon: 0 },
        { id: "te-2", name: "Sorgo Molido", dryMatterPct: 0.89149, inclusionMsPct: 0.28, costBsTon: 1450 },
        { id: "te-3", name: "Maiz", dryMatterPct: 0.8835, inclusionMsPct: 0.32, costBsTon: 1700 },
        { id: "te-4", name: "A. Arroz", dryMatterPct: 0.91, inclusionMsPct: 0.08, costBsTon: 1250 },
        { id: "te-5", name: "A. Trigo", dryMatterPct: 0.886, inclusionMsPct: 0.07, costBsTon: 1300 },
        { id: "te-6", name: "T. Girasol", dryMatterPct: 0.9, inclusionMsPct: 0.06, costBsTon: 1850 },
        { id: "te-7", name: "H. de Soya", dryMatterPct: 0.9, inclusionMsPct: 0.06, costBsTon: 2550 },
        { id: "te-8", name: "Agua", dryMatterPct: 0.0001, inclusionMsPct: 0, costBsTon: 0 },
        { id: "te-9", name: "Nucleo", dryMatterPct: 0.97, inclusionMsPct: 0.1, costBsTon: 4200 },
      ],
    },
  },
  lots: buildLots(),
  consumptionNotes: buildConsumptionNotes(20),
};
