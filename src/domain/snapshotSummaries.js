function compactReportRows(reportRows) {
  return reportRows.map((row) => ({
    pen: row.pen,
    currentDiet: row.currentDiet,
    dietName: row.dietName,
    lotCode: row.lotCode,
    animalCount: Number(row.animalCount || 0),
    estimatedWeight: Number(row.estimatedWeight || 0),
    cmoLot: Number(row.cmoLot || 0),
    cmoAnimal: Number(row.cmoAnimal || 0),
    cmsLot: Number(row.cmsLot || 0),
    cmsAnimal: Number(row.cmsAnimal || 0),
    imsPct: Number(row.imsPct || 0),
    nutritionalCostAnimal: Number(row.nutritionalCostAnimal || 0),
    nutritionalCostLot: Number(row.nutritionalCostLot || 0),
    financialAverage: Number(row.financialAverage || 0),
    financialTotal: Number(row.financialTotal || 0),
  }));
}

export function buildDaySummary(state, computed) {
  const totalAnimals = computed.lots.reduce((total, lot) => total + Number(lot.animalCount || 0), 0);
  const totalFeedMs = computed.lots.reduce((total, lot) => total + Number(lot.totalFeedMs || 0), 0);
  const totalFeedMo = computed.lots.reduce((total, lot) => total + Number(lot.totalFeedMo || 0), 0);
  const totalFinancial = computed.reportRows.reduce(
    (total, row) => total + Number(row.financialTotal || 0),
    0,
  );
  const activeLots = computed.lots.filter(
    (lot) => lot.lotCode || Number(lot.animalCount || 0) > 0 || lot.currentDiet,
  ).length;

  return {
    clientName: state.config.clientName,
    workDate: state.config.workDate,
    activeLots,
    totalAnimals,
    totalFeedMs,
    totalFeedMo,
    totalFinancial,
    diets: Object.fromEntries(
      Object.entries(computed.diets).map(([dietId, diet]) => [
        dietId,
        {
          status: diet.totals.status,
          treatmentStatus: diet.totals.treatmentStatus,
          dietDryMatterPct: diet.totals.dietDryMatterPct,
          costBsKg: diet.totals.costBsKg,
        },
      ]),
    ),
  };
}

export function buildRegistroHistorySummary(state, computed) {
  const reportRows = compactReportRows(computed.reportRows);
  const activeRows = reportRows.filter(
    (row) => row.lotCode || row.animalCount > 0 || row.currentDiet,
  );

  return {
    clientName: state.config.clientName,
    workDate: state.config.workDate,
    activePens: activeRows.length,
    totalAnimals: reportRows.reduce((total, row) => total + row.animalCount, 0),
    totalCmsLot: reportRows.reduce((total, row) => total + row.cmsLot, 0),
    totalCmoLot: reportRows.reduce((total, row) => total + row.cmoLot, 0),
    totalNutritionalCost: reportRows.reduce((total, row) => total + row.nutritionalCostLot, 0),
    totalFinancial: reportRows.reduce((total, row) => total + row.financialTotal, 0),
    reportRows,
  };
}
