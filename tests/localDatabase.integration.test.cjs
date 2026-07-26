const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  createLocalDatabase,
} = require("../desktop/localDatabase.cjs");

function sampleState(workDate, overrides = {}) {
  return {
    config: {
      clientName: "Confinamiento Arizona",
      startDate: "2026-07-20",
      workDate,
    },
    diets: { ADAPTACION: { id: "ADAPTACION" } },
    lots: [{ id: "lot-1", lotCode: "LOTE-1", consumptionAdjustmentPct: 0.05 }],
    consumptionNotes: {},
    feedingActuals: {},
    treatmentIngredientActuals: {},
    reportOverrides: {},
    ...overrides,
  };
}

function openTestDatabase(context, options = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "arizona-sqlite-"));
  const filename = path.join(directory, "arizona.test.db");
  const database = createLocalDatabase({
    filename,
    initialWorkDate: "2026-07-26",
    now: () => "2026-07-26T22:30:00.000Z",
    ...options,
  });

  context.after(() => {
    database.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  return { database, filename };
}

test("manual save rolls back when updating the active pointer fails", (context) => {
  const { database } = openTestDatabase(context, {
    faultInjector(stage) {
      if (stage === "after_manual_snapshot_insert") {
        throw new Error("Fallo simulado de puntero.");
      }
    },
  });
  const active = database.ensureActiveWorkDay();

  assert.throws(
    () =>
      database.saveWorkDaySnapshot({
        workDayId: active.work_day.id,
        inputState: sampleState("2026-07-26"),
        computedState: { reportRows: [] },
        summary: { workDate: "2026-07-26" },
      }),
    /Fallo simulado/,
  );

  assert.equal(
    database.listWorkDaySnapshots({
      snapshotType: "manual_save",
      periodId: active.period.id,
    }).length,
    0,
  );
  assert.equal(database.ensureActiveWorkDay().snapshot, null);
});

test("SQLite persists the active work day and manual saves across reopen", (context) => {
  const { database, filename } = openTestDatabase(context);
  const active = database.ensureActiveWorkDay();
  const inputState = sampleState("2026-07-26");

  assert.equal(active.work_day.work_date, "2026-07-26");
  assert.equal(active.snapshot, null);

  const saved = database.saveWorkDaySnapshot({
    workDayId: active.work_day.id,
    inputState,
    computedState: { reportRows: [{ pen: "A-1", cmoLot: 120 }] },
    summary: { workDate: "2026-07-26", totalAnimals: 150 },
  });

  assert.ok(saved.snapshot_id);
  database.close();

  const reopened = createLocalDatabase({
    filename,
    initialWorkDate: "2030-01-01",
    now: () => "2026-07-26T23:00:00.000Z",
  });

  const recovered = reopened.ensureActiveWorkDay();
  assert.equal(recovered.work_day.id, active.work_day.id);
  assert.equal(recovered.snapshot.id, saved.snapshot_id);
  assert.deepEqual(recovered.snapshot.input_state, inputState);
  reopened.close();
});

test("closing a day is append-only, atomic and opens the next calendar day", (context) => {
  const { database } = openTestDatabase(context);
  const active = database.ensureActiveWorkDay();
  const currentInput = sampleState("2026-07-26", {
    feedingActuals: { ADAPTACION: { "lot-1": { 1: 165 } } },
  });
  const nextInput = sampleState("2026-07-27");

  const result = database.closeWorkDay({
    workDayId: active.work_day.id,
    inputState: currentInput,
    computedState: { reportRows: [{ pen: "A-1", cmoLot: 825 }] },
    summary: {
      workDate: "2026-07-26",
      totalAnimals: 150,
      reportRows: [{ pen: "A-1", cmoLot: 825 }],
    },
    nextInputState: nextInput,
    nextComputedState: { reportRows: [{ pen: "A-1", cmoLot: 0 }] },
    nextSummary: { workDate: "2026-07-27", totalAnimals: 150 },
  });

  assert.equal(result.closed_work_day.status, "closed");
  assert.equal(result.next_work_day.status, "active");
  assert.equal(result.next_work_day.work_date, "2026-07-27");
  assert.equal(result.history_snapshot.snapshot_type, "registro_history");
  assert.deepEqual(result.history_snapshot.input_state, currentInput);
  assert.equal(result.next_snapshot.snapshot_type, "day_opening");
  assert.deepEqual(result.next_snapshot.input_state, nextInput);

  const histories = database.listWorkDaySnapshots({
    snapshotType: "registro_history",
    periodId: active.period.id,
  });
  assert.equal(histories.length, 1);
  assert.equal(histories[0].summary.workDate, "2026-07-26");

  const recovered = database.ensureActiveWorkDay();
  assert.equal(recovered.work_day.id, result.next_work_day.id);
  assert.deepEqual(recovered.snapshot.input_state, nextInput);

  const repeated = database.closeWorkDay({
    workDayId: active.work_day.id,
    inputState: currentInput,
    computedState: {},
    summary: { workDate: "2026-07-26" },
    nextInputState: nextInput,
    nextComputedState: {},
    nextSummary: { workDate: "2026-07-27" },
  });
  assert.equal(repeated.already_closed, true);
  assert.equal(
    database.listWorkDaySnapshots({
      snapshotType: "registro_history",
      periodId: active.period.id,
    }).length,
    1,
  );
});

test("closing rejects a next-day payload with an incorrect date", (context) => {
  const { database } = openTestDatabase(context);
  const active = database.ensureActiveWorkDay();

  assert.throws(
    () =>
      database.closeWorkDay({
        workDayId: active.work_day.id,
        inputState: sampleState("2026-07-26"),
        computedState: {},
        summary: { workDate: "2026-07-26" },
        nextInputState: sampleState("2026-07-29"),
        nextComputedState: {},
        nextSummary: { workDate: "2026-07-29" },
      }),
    /día siguiente/i,
  );

  const stillActive = database.ensureActiveWorkDay();
  assert.equal(stillActive.work_day.id, active.work_day.id);
  assert.equal(
    database.listWorkDaySnapshots({
      snapshotType: "registro_history",
      periodId: active.period.id,
    }).length,
    0,
  );
});

test("closed days accept only dated append-only corrections", (context) => {
  const { database } = openTestDatabase(context);
  const active = database.ensureActiveWorkDay();
  const currentInput = sampleState("2026-07-26");
  const closed = database.closeWorkDay({
    workDayId: active.work_day.id,
    inputState: currentInput,
    computedState: { reportRows: [{ pen: "A-1", cmoLot: 700 }] },
    summary: {
      workDate: "2026-07-26",
      reportRows: [{ pen: "A-1", cmoLot: 700 }],
    },
    nextInputState: sampleState("2026-07-27"),
    nextComputedState: { reportRows: [] },
    nextSummary: { workDate: "2026-07-27" },
  });

  assert.throws(
    () =>
      database.saveRegistroHistorySnapshot({
        workDayId: active.work_day.id,
        inputState: sampleState("2099-01-01"),
        computedState: { reportRows: [] },
        summary: {
          workDate: "2099-01-01",
          correctionOf: closed.history_snapshot.id,
        },
      }),
    /fecha/i,
  );
  assert.throws(
    () =>
      database.saveRegistroHistorySnapshot({
        workDayId: active.work_day.id,
        inputState: currentInput,
        computedState: { reportRows: [] },
        summary: { workDate: "2026-07-26" },
      }),
    /corrección/i,
  );

  const correction = database.saveRegistroHistorySnapshot({
    workDayId: active.work_day.id,
    inputState: currentInput,
    computedState: { reportRows: [{ pen: "A-1", cmoLot: 710 }] },
    summary: {
      workDate: "2026-07-26",
      correctionOf: closed.history_snapshot.id,
      reportRows: [{ pen: "A-1", cmoLot: 710 }],
    },
  });
  assert.ok(correction.snapshot_id);
  assert.equal(
    database.listWorkDaySnapshots({
      snapshotType: "registro_history",
      periodId: active.period.id,
    }).length,
    2,
  );
});

test("legacy browser data imports once without duplicating history", (context) => {
  const { database } = openTestDatabase(context);
  const legacy = {
    counter: 2,
    period: {
      id: "period-legacy",
      name: "Periodo anterior",
      start_date: "2026-07-20",
      status: "active",
    },
    workDay: {
      id: "work-day-legacy",
      period_id: "period-legacy",
      work_date: "2026-07-25",
      status: "active",
      last_snapshot_id: "manual-legacy",
      last_saved_at: "2026-07-25T20:00:00.000Z",
    },
    snapshots: [
      {
        id: "history-legacy",
        period_id: "period-legacy",
        work_day_id: "work-day-legacy",
        snapshot_type: "registro_history",
        saved_by: "app-user-local",
        saved_at: "2026-07-25T19:00:00.000Z",
        input_state: sampleState("2026-07-25"),
        computed_state: { reportRows: [{ pen: "A-1", cmoLot: 700 }] },
        summary: {
          workDate: "2026-07-25",
          reportRows: [{ pen: "A-1", cmoLot: 700 }],
        },
      },
      {
        id: "manual-legacy",
        period_id: "period-legacy",
        work_day_id: "work-day-legacy",
        snapshot_type: "manual_save",
        saved_by: "app-user-local",
        saved_at: "2026-07-25T20:00:00.000Z",
        input_state: sampleState("2026-07-25"),
        computed_state: { reportRows: [{ pen: "A-1", cmoLot: 710 }] },
        summary: { workDate: "2026-07-25" },
      },
    ],
  };

  const imported = database.importLegacyDatabase(legacy);
  const repeated = database.importLegacyDatabase(legacy);
  const active = database.ensureActiveWorkDay();

  assert.equal(imported.imported, true);
  assert.equal(repeated.imported, false);
  assert.equal(active.period.id, "period-legacy");
  assert.equal(active.work_day.id, "work-day-legacy");
  assert.equal(active.snapshot.id, "manual-legacy");
  assert.equal(active.snapshot.input_state.lots[0].lotCode, "LOTE-1");
  assert.equal(
    database.listWorkDaySnapshots({
      snapshotType: "registro_history",
      periodId: "period-legacy",
    }).length,
    1,
  );
});
