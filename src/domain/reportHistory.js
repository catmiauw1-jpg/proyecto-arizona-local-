import { toNumber } from "./formatters.js";

const AVERAGE_FIELDS = Object.freeze([
  "animalCount",
  "estimatedWeight",
  "cmoLot",
  "cmoAnimal",
  "cmsLot",
  "cmsAnimal",
  "imsPct",
  "nutritionalCostAnimal",
  "nutritionalCostLot",
]);

const TOTAL_FIELDS = Object.freeze([
  "cmoLot",
  "cmoAnimal",
  "cmsLot",
  "cmsAnimal",
  "nutritionalCostAnimal",
  "nutritionalCostLot",
]);

function reportRowsFromSnapshot(snapshot) {
  const computedRows = snapshot?.computed_state?.reportRows;
  if (Array.isArray(computedRows)) return computedRows;

  const summaryRows = snapshot?.summary?.reportRows;
  return Array.isArray(summaryRows) ? summaryRows : [];
}

function rowKey(row) {
  return String(row?.lotId || row?.pen || "").trim();
}

function latestSnapshotsByDate(snapshots) {
  return snapshots.reduce((latest, snapshot) => {
    const workDate = String(snapshot?.summary?.workDate ?? "").trim();
    if (!workDate) return latest;

    const previous = latest.get(workDate);
    const previousSavedAt = Date.parse(previous?.saved_at ?? "") || 0;
    const nextSavedAt = Date.parse(snapshot?.saved_at ?? "") || 0;
    const replacesEqualTimestamp =
      nextSavedAt === previousSavedAt &&
      String(snapshot?.id ?? "") > String(previous?.id ?? "");
    if (
      !previous ||
      nextSavedAt > previousSavedAt ||
      replacesEqualTimestamp
    ) {
      return new Map(latest).set(workDate, snapshot);
    }
    return latest;
  }, new Map());
}

function rowsByKey(rows) {
  return new Map(
    rows
      .map((row) => [rowKey(row), row])
      .filter(([key]) => Boolean(key)),
  );
}

function average(samples, field) {
  if (!samples.length) return 0;
  return samples.reduce((total, row) => total + toNumber(row?.[field]), 0) / samples.length;
}

function total(samples, field) {
  return samples.reduce((sum, row) => sum + toNumber(row?.[field]), 0);
}

export function calculateReportPeriod(currentRows, snapshots, currentWorkDate) {
  const safeCurrentRows = Array.isArray(currentRows) ? currentRows : [];
  const latestByDate = latestSnapshotsByDate(Array.isArray(snapshots) ? snapshots : []);
  const requestedCurrentDate = String(currentWorkDate ?? "").trim();
  const currentDate =
    requestedCurrentDate || (safeCurrentRows.length ? "__current__" : "");
  const rowsForDate = new Map(
    [...latestByDate.entries()].map(([workDate, snapshot]) => [
      workDate,
      rowsByKey(reportRowsFromSnapshot(snapshot)),
    ]),
  );

  if (currentDate) {
    rowsForDate.set(currentDate, rowsByKey(safeCurrentRows));
  }

  const calculationDates = [...rowsForDate.keys()].sort();
  const workDates = calculationDates.filter(
    (workDate) => workDate !== "__current__",
  );
  const currentByKey = rowsByKey(safeCurrentRows);
  const allKeys = new Set(currentByKey.keys());
  rowsForDate.forEach((rows) => rows.forEach((_, key) => allKeys.add(key)));

  const rows = [...allKeys].map((key) => {
    const samples = calculationDates
      .map((workDate) => rowsForDate.get(workDate)?.get(key))
      .filter((row) => rowKey(row));
    const latestHistorical = [...samples].reverse().find((row) => rowKey(row));
    const current = currentByKey.get(key) ?? latestHistorical ?? { pen: key };
    const averageValues = Object.fromEntries(
      AVERAGE_FIELDS.map((field) => [field, average(samples, field)]),
    );
    const totalValues = Object.fromEntries(
      TOTAL_FIELDS.map((field) => [field, total(samples, field)]),
    );

    return {
      ...current,
      periodDays: samples.length,
      average: averageValues,
      total: {
        ...totalValues,
        estimatedLiveWeight:
          averageValues.estimatedWeight * averageValues.animalCount,
      },
    };
  });

  return {
    workDates,
    dayCount: calculationDates.length,
    rows,
    currentTotalCost: safeCurrentRows.reduce(
      (sum, row) => sum + toNumber(row.nutritionalCostLot),
      0,
    ),
    periodTotalCost: rows.reduce(
      (sum, row) => sum + toNumber(row.total.nutritionalCostLot),
      0,
    ),
  };
}
