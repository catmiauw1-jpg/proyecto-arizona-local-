import assert from "node:assert/strict";
import test from "node:test";

import { calculateReportPeriod } from "../src/domain/reportHistory.js";

function reportRow(overrides = {}) {
  return {
    pen: "A-1",
    currentDiet: "ADAPTACION",
    dietName: "Dieta adaptacion",
    lotCode: "LOTE-A",
    animalCount: 10,
    estimatedWeight: 300,
    cmoLot: 10,
    cmoAnimal: 1,
    cmsLot: 8,
    cmsAnimal: 0.8,
    imsPct: 0.02,
    nutritionalCostAnimal: 2,
    nutritionalCostLot: 20,
    ...overrides,
  };
}

function historySnapshot(workDate, savedAt, row) {
  return {
    saved_at: savedAt,
    summary: { workDate },
    computed_state: { reportRows: [row] },
  };
}

test("report period replaces duplicate saved dates with the latest current day", () => {
  const snapshots = [
    historySnapshot(
      "2026-07-21",
      "2026-07-21T10:00:00.000Z",
      reportRow({ cmoLot: 10, cmsLot: 8, nutritionalCostAnimal: 2, nutritionalCostLot: 20 }),
    ),
    historySnapshot(
      "2026-07-21",
      "2026-07-21T18:00:00.000Z",
      reportRow({ cmoLot: 20, cmsLot: 16, nutritionalCostAnimal: 3, nutritionalCostLot: 30 }),
    ),
    historySnapshot(
      "2026-07-22",
      "2026-07-22T18:00:00.000Z",
      reportRow({ cmoLot: 30, cmsLot: 24, nutritionalCostAnimal: 4, nutritionalCostLot: 40 }),
    ),
  ];
  const currentRows = [
    reportRow({
      cmoLot: 40,
      cmoAnimal: 4,
      cmsLot: 32,
      cmsAnimal: 3.2,
      nutritionalCostAnimal: 5,
      nutritionalCostLot: 50,
    }),
  ];

  const period = calculateReportPeriod(currentRows, snapshots, "2026-07-22");
  const row = period.rows[0];

  assert.deepEqual(period.workDates, ["2026-07-21", "2026-07-22"]);
  assert.equal(period.dayCount, 2);
  assert.equal(row.average.cmoLot, 30);
  assert.equal(row.average.cmsLot, 24);
  assert.equal(row.average.nutritionalCostAnimal, 4);
  assert.equal(row.total.cmoLot, 60);
  assert.equal(row.total.cmsLot, 48);
  assert.equal(row.total.nutritionalCostAnimal, 8);
  assert.equal(row.total.nutritionalCostLot, 80);
});

test("report period uses the current day when no history exists", () => {
  const current = reportRow({
    animalCount: 25,
    estimatedWeight: 350,
    cmoLot: 50,
    cmoAnimal: 2,
    cmsLot: 40,
    cmsAnimal: 1.6,
    imsPct: 0.03,
    nutritionalCostAnimal: 6,
    nutritionalCostLot: 150,
  });

  const period = calculateReportPeriod([current], [], "2026-07-23");
  const row = period.rows[0];

  assert.equal(period.dayCount, 1);
  assert.equal(row.average.animalCount, 25);
  assert.equal(row.average.estimatedWeight, 350);
  assert.equal(row.average.imsPct, 0.03);
  assert.equal(row.total.cmoLot, 50);
  assert.equal(row.total.nutritionalCostAnimal, 6);
  assert.equal(row.total.nutritionalCostLot, 150);
});

test("report averages count only days where the lot exists", () => {
  const period = calculateReportPeriod(
    [
      reportRow({
        lotId: "lot-new",
        pen: "A-2",
        cmoLot: 40,
        nutritionalCostLot: 40,
      }),
    ],
    [
      historySnapshot(
        "2026-07-21",
        "2026-07-21T18:00:00.000Z",
        reportRow({ lotId: "lot-old", pen: "A-1", cmoLot: 20 }),
      ),
    ],
    "2026-07-22",
  );

  const newLot = period.rows.find((row) => row.lotId === "lot-new");
  const oldLot = period.rows.find((row) => row.lotId === "lot-old");
  assert.equal(period.dayCount, 2);
  assert.equal(newLot.periodDays, 1);
  assert.equal(newLot.average.cmoLot, 40);
  assert.equal(oldLot.periodDays, 1);
  assert.equal(oldLot.average.cmoLot, 20);
});

test("report period supports compact historical summaries and ignores undated rows", () => {
  const period = calculateReportPeriod(
    [],
    [
      {
        saved_at: "2026-07-21T10:00:00.000Z",
        summary: {
          workDate: "2026-07-21",
          reportRows: [
            reportRow({
              pen: "A-2",
              cmoLot: 25,
              cmsLot: 20,
              nutritionalCostAnimal: 4,
              nutritionalCostLot: 40,
            }),
          ],
        },
      },
      {
        saved_at: "2026-07-22T10:00:00.000Z",
        summary: { reportRows: [reportRow({ pen: "A-3" })] },
      },
    ],
    "",
  );

  assert.deepEqual(period.workDates, ["2026-07-21"]);
  assert.equal(period.dayCount, 1);
  assert.equal(period.rows[0].pen, "A-2");
  assert.equal(period.rows[0].average.cmoLot, 25);
  assert.equal(period.rows[0].total.nutritionalCostLot, 40);
});

test("report period fails safely for malformed collections", () => {
  assert.deepEqual(calculateReportPeriod(null, null, ""), {
    workDates: [],
    dayCount: 0,
    rows: [],
    currentTotalCost: 0,
    periodTotalCost: 0,
  });
});

test("report period resolves equal timestamps deterministically by snapshot id", () => {
  const savedAt = "2026-07-21T18:00:00.000Z";
  const period = calculateReportPeriod(
    [],
    [
      {
        ...historySnapshot(
          "2026-07-21",
          savedAt,
          reportRow({ cmoLot: 20 }),
        ),
        id: "history-002",
      },
      {
        ...historySnapshot(
          "2026-07-21",
          savedAt,
          reportRow({ cmoLot: 10 }),
        ),
        id: "history-001",
      },
    ],
    "",
  );

  assert.equal(period.rows[0].average.cmoLot, 20);
});
