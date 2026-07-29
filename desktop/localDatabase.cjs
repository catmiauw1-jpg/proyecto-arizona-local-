const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SNAPSHOT_COLUMNS = `
  id,
  period_id,
  work_day_id,
  snapshot_type,
  saved_by,
  saved_at,
  input_state,
  computed_state,
  summary
`;

function localIsoDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function assertIsoDate(value, label = "fecha") {
  if (!ISO_DATE_PATTERN.test(String(value ?? ""))) {
    throw new Error(`${label} debe usar el formato YYYY-MM-DD.`);
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`${label} no es válida.`);
  }
}

function nextIsoDate(value) {
  assertIsoDate(value, "La fecha del día activo");
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + 1));
  return date.toISOString().slice(0, 10);
}

function assertRecord(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} debe ser un objeto.`);
  }
}

function serialize(value, label) {
  assertRecord(value, label);
  return JSON.stringify(value);
}

function parseJson(value) {
  if (typeof value !== "string" || !value) return {};
  return JSON.parse(value);
}

function mapPeriod(row) {
  return row
    ? {
        id: row.id,
        name: row.name,
        start_date: row.start_date,
        status: row.status,
      }
    : null;
}

function mapWorkDay(row) {
  return row
    ? {
        id: row.id,
        period_id: row.period_id,
        work_date: row.work_date,
        status: row.status,
        last_snapshot_id: row.last_snapshot_id,
        last_saved_at: row.last_saved_at,
        closed_at: row.closed_at,
      }
    : null;
}

function mapSnapshot(row) {
  return row
    ? {
        id: row.id,
        period_id: row.period_id,
        work_day_id: row.work_day_id,
        snapshot_type: row.snapshot_type,
        saved_by: row.saved_by,
        saved_at: row.saved_at,
        input_state: parseJson(row.input_state),
        computed_state: parseJson(row.computed_state),
        summary: parseJson(row.summary),
      }
    : null;
}

function initializeSchema(database) {
  database.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    PRAGMA synchronous = FULL;

    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS periods (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      start_date TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('active', 'closed')),
      created_at TEXT NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS work_days (
      id TEXT PRIMARY KEY,
      period_id TEXT NOT NULL REFERENCES periods(id),
      work_date TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('active', 'closed')),
      last_snapshot_id TEXT,
      last_saved_at TEXT,
      closed_at TEXT,
      created_at TEXT NOT NULL,
      UNIQUE (period_id, work_date)
    ) STRICT;

    CREATE UNIQUE INDEX IF NOT EXISTS one_active_period
      ON periods(status)
      WHERE status = 'active';

    CREATE UNIQUE INDEX IF NOT EXISTS one_active_work_day_per_period
      ON work_days(period_id)
      WHERE status = 'active';

    CREATE TABLE IF NOT EXISTS work_day_snapshots (
      id TEXT PRIMARY KEY,
      period_id TEXT NOT NULL REFERENCES periods(id),
      work_day_id TEXT NOT NULL REFERENCES work_days(id),
      snapshot_type TEXT NOT NULL CHECK (
        snapshot_type IN ('manual_save', 'registro_history', 'day_opening')
      ),
      saved_by TEXT NOT NULL,
      saved_at TEXT NOT NULL,
      input_state TEXT NOT NULL,
      computed_state TEXT NOT NULL,
      summary TEXT NOT NULL
    ) STRICT;

    CREATE INDEX IF NOT EXISTS snapshots_by_period_type_date
      ON work_day_snapshots(period_id, snapshot_type, saved_at DESC);

    INSERT INTO app_meta(key, value)
    VALUES ('schema_version', '1')
    ON CONFLICT(key) DO UPDATE SET value = excluded.value;
  `);
}

function createLocalDatabase({
  filename = ":memory:",
  initialWorkDate = localIsoDate(),
  now = () => new Date().toISOString(),
  faultInjector = () => {},
} = {}) {
  assertIsoDate(initialWorkDate, "La fecha inicial");
  if (filename !== ":memory:") {
    fs.mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
  }

  const database = new DatabaseSync(filename);
  let isClosed = false;
  if (filename !== ":memory:") database.exec("PRAGMA journal_mode = WAL;");
  initializeSchema(database);

  const statements = {
    metaByKey: database.prepare(
      "SELECT value FROM app_meta WHERE key = ? LIMIT 1",
    ),
    setMeta: database.prepare(
      `INSERT INTO app_meta(key, value)
       VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    ),
    periodCount: database.prepare("SELECT COUNT(*) AS total FROM periods"),
    activePeriod: database.prepare(
      "SELECT * FROM periods WHERE status = 'active' ORDER BY created_at LIMIT 1",
    ),
    activeWorkDay: database.prepare(
      "SELECT * FROM work_days WHERE period_id = ? AND status = 'active' LIMIT 1",
    ),
    periodById: database.prepare("SELECT * FROM periods WHERE id = ? LIMIT 1"),
    workDayById: database.prepare("SELECT * FROM work_days WHERE id = ? LIMIT 1"),
    snapshotById: database.prepare(
      `SELECT ${SNAPSHOT_COLUMNS} FROM work_day_snapshots WHERE id = ? LIMIT 1`,
    ),
    latestHistoryForDay: database.prepare(
      `SELECT ${SNAPSHOT_COLUMNS}
       FROM work_day_snapshots
       WHERE work_day_id = ? AND snapshot_type = 'registro_history'
       ORDER BY saved_at DESC, rowid DESC
       LIMIT 1`,
    ),
    latestSnapshotForDayExcluding: database.prepare(
      `SELECT ${SNAPSHOT_COLUMNS}
       FROM work_day_snapshots
       WHERE work_day_id = ? AND id <> ?
       ORDER BY saved_at DESC, rowid DESC
       LIMIT 1`,
    ),
    insertPeriod: database.prepare(
      `INSERT INTO periods(id, name, start_date, status, created_at)
       VALUES (?, ?, ?, 'active', ?)`,
    ),
    insertPeriodWithStatus: database.prepare(
      `INSERT INTO periods(id, name, start_date, status, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    ),
    insertWorkDay: database.prepare(
      `INSERT INTO work_days(
         id, period_id, work_date, status, last_snapshot_id,
         last_saved_at, closed_at, created_at
       )
       VALUES (?, ?, ?, 'active', NULL, NULL, NULL, ?)`,
    ),
    insertSnapshot: database.prepare(
      `INSERT INTO work_day_snapshots(
         id, period_id, work_day_id, snapshot_type, saved_by,
         saved_at, input_state, computed_state, summary
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ),
    updateLastSnapshot: database.prepare(
      `UPDATE work_days
       SET last_snapshot_id = ?, last_saved_at = ?
       WHERE id = ?`,
    ),
    deleteHistorySnapshot: database.prepare(
      `DELETE FROM work_day_snapshots
       WHERE id = ? AND period_id = ? AND snapshot_type = 'registro_history'`,
    ),
    closeWorkDay: database.prepare(
      `UPDATE work_days
       SET status = 'closed', last_snapshot_id = ?, last_saved_at = ?, closed_at = ?
       WHERE id = ? AND status = 'active'`,
    ),
  };

  function importLegacyDatabase(legacy) {
    if (statements.metaByKey.get("legacy_browser_import")?.value === "done") {
      return { imported: false, reason: "already_imported" };
    }
    if (statements.periodCount.get().total > 0) {
      statements.setMeta.run("legacy_browser_import", "done");
      return { imported: false, reason: "database_already_initialized" };
    }

    assertRecord(legacy, "Los datos anteriores");
    assertRecord(legacy.period, "El periodo anterior");
    assertRecord(legacy.workDay, "El día anterior");
    if (!Array.isArray(legacy.snapshots)) {
      throw new Error("El historial anterior no tiene un formato válido.");
    }
    assertIsoDate(legacy.period.start_date, "La fecha inicial anterior");
    assertIsoDate(legacy.workDay.work_date, "La fecha de trabajo anterior");
    if (
      legacy.workDay.period_id !== legacy.period.id ||
      !["active", "closed"].includes(legacy.workDay.status)
    ) {
      throw new Error("El día anterior no corresponde al periodo.");
    }

    database.exec("BEGIN IMMEDIATE;");
    try {
      statements.insertPeriodWithStatus.run(
        String(legacy.period.id),
        String(legacy.period.name || "Periodo local"),
        legacy.period.start_date,
        String(legacy.period.status || "active"),
        now(),
      );
      database
        .prepare(
          `INSERT INTO work_days(
             id, period_id, work_date, status, last_snapshot_id,
             last_saved_at, closed_at, created_at
           )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          String(legacy.workDay.id),
          String(legacy.workDay.period_id),
          legacy.workDay.work_date,
          legacy.workDay.status,
          legacy.workDay.last_snapshot_id
            ? String(legacy.workDay.last_snapshot_id)
            : null,
          legacy.workDay.last_saved_at
            ? String(legacy.workDay.last_saved_at)
            : null,
          legacy.workDay.closed_at ? String(legacy.workDay.closed_at) : null,
          now(),
        );

      for (const snapshot of legacy.snapshots) {
        assertRecord(snapshot, "El registro histórico anterior");
        if (
          snapshot.period_id !== legacy.period.id ||
          snapshot.work_day_id !== legacy.workDay.id ||
          !["manual_save", "registro_history", "day_opening"].includes(
            snapshot.snapshot_type,
          )
        ) {
          throw new Error("Un registro histórico anterior no es válido.");
        }
        statements.insertSnapshot.run(
          String(snapshot.id),
          String(snapshot.period_id),
          String(snapshot.work_day_id),
          snapshot.snapshot_type,
          String(snapshot.saved_by || "app-user-local"),
          String(snapshot.saved_at || now()),
          serialize(snapshot.input_state, "input_state anterior"),
          serialize(snapshot.computed_state, "computed_state anterior"),
          serialize(snapshot.summary, "summary anterior"),
        );
      }

      statements.setMeta.run("legacy_browser_import", "done");
      database.exec("COMMIT;");
      return { imported: true, snapshots: legacy.snapshots.length };
    } catch (error) {
      database.exec("ROLLBACK;");
      throw error;
    }
  }

  function insertSnapshot({
    periodId,
    workDayId,
    snapshotType,
    inputState,
    computedState,
    summary,
    savedAt = now(),
  }) {
    const id = randomUUID();
    statements.insertSnapshot.run(
      id,
      periodId,
      workDayId,
      snapshotType,
      "app-user-local",
      savedAt,
      serialize(inputState, "inputState"),
      serialize(computedState, "computedState"),
      serialize(summary, "summary"),
    );
    return mapSnapshot(statements.snapshotById.get(id));
  }

  function ensureActiveWorkDay() {
    let period = statements.activePeriod.get();
    if (!period) {
      const createdAt = now();
      const periodId = randomUUID();
      statements.insertPeriod.run(
        periodId,
        "Periodo local",
        initialWorkDate,
        createdAt,
      );
      period = statements.periodById.get(periodId);
    }

    let workDay = statements.activeWorkDay.get(period.id);
    if (!workDay) {
      const workDayId = randomUUID();
      statements.insertWorkDay.run(
        workDayId,
        period.id,
        initialWorkDate,
        now(),
      );
      workDay = statements.workDayById.get(workDayId);
    }

    const snapshot = workDay.last_snapshot_id
      ? statements.snapshotById.get(workDay.last_snapshot_id)
      : null;

    return {
      period: mapPeriod(period),
      work_day: mapWorkDay(workDay),
      snapshot: mapSnapshot(snapshot),
    };
  }

  function requireActiveWorkDay(workDayId) {
    const row = statements.workDayById.get(workDayId);
    if (!row) throw new Error("El día de trabajo no existe.");
    if (row.status !== "active") {
      throw new Error("El día de trabajo ya está cerrado.");
    }
    return row;
  }

  function saveWorkDaySnapshot({
    workDayId,
    inputState,
    computedState,
    summary,
  }) {
    const workDay = requireActiveWorkDay(workDayId);
    if (
      summary?.workDate !== workDay.work_date ||
      inputState?.config?.workDate !== workDay.work_date
    ) {
      throw new Error("El guardado no corresponde a la fecha del día activo.");
    }

    database.exec("BEGIN IMMEDIATE;");
    try {
      const savedAt = now();
      const snapshot = insertSnapshot({
        periodId: workDay.period_id,
        workDayId,
        snapshotType: "manual_save",
        inputState,
        computedState,
        summary,
        savedAt,
      });
      faultInjector("after_manual_snapshot_insert");
      statements.updateLastSnapshot.run(snapshot.id, savedAt, workDayId);
      database.exec("COMMIT;");

      return {
        snapshot_id: snapshot.id,
        saved_at: savedAt,
        work_day_id: workDayId,
        period_id: workDay.period_id,
      };
    } catch (error) {
      database.exec("ROLLBACK;");
      throw error;
    }
  }

  function saveRegistroHistorySnapshot({
    workDayId,
    inputState,
    computedState,
    summary,
  }) {
    const workDay = statements.workDayById.get(workDayId);
    if (!workDay) throw new Error("El día de trabajo no existe.");
    if (
      summary?.workDate !== workDay.work_date ||
      inputState?.config?.workDate !== workDay.work_date
    ) {
      throw new Error("La fecha del registro histórico no coincide con el día.");
    }
    if (workDay.status === "closed") {
      const correctionOf = summary?.correctionOf;
      const original = correctionOf
        ? statements.snapshotById.get(correctionOf)
        : null;
      if (
        !original ||
        original.work_day_id !== workDayId ||
        original.snapshot_type !== "registro_history"
      ) {
        throw new Error(
          "Un día cerrado sólo admite una corrección del historial original.",
        );
      }
    }
    const snapshot = insertSnapshot({
      periodId: workDay.period_id,
      workDayId,
      snapshotType: "registro_history",
      inputState,
      computedState,
      summary,
    });

    return {
      snapshot_id: snapshot.id,
      saved_at: snapshot.saved_at,
      work_day_id: workDayId,
      period_id: workDay.period_id,
      snapshot_type: snapshot.snapshot_type,
      work_date: snapshot.summary.workDate,
    };
  }

  function deleteRegistroHistorySnapshot({ snapshotId, periodId, actorRole } = {}) {
    if (actorRole !== "admin_arizona") {
      throw new Error("Solo el administrador puede eliminar registros historicos.");
    }
    if (typeof snapshotId !== "string" || snapshotId.trim() === "") {
      throw new Error("El registro historico no es valido.");
    }
    if (typeof periodId !== "string" || periodId.trim() === "") {
      throw new Error("El periodo no es valido.");
    }

    const snapshot = statements.snapshotById.get(snapshotId);
    if (!snapshot) throw new Error("El registro historico no existe.");
    if (snapshot.period_id !== periodId) {
      throw new Error("El registro historico no pertenece al periodo activo.");
    }
    if (snapshot.snapshot_type !== "registro_history") {
      throw new Error("Solo se pueden eliminar registros historicos.");
    }

    const workDay = statements.workDayById.get(snapshot.work_day_id);
    const updatesLastSnapshot = workDay?.last_snapshot_id === snapshotId;
    const replacement = updatesLastSnapshot
      ? statements.latestSnapshotForDayExcluding.get(snapshot.work_day_id, snapshotId)
      : null;

    database.exec("BEGIN IMMEDIATE;");
    try {
      const result = statements.deleteHistorySnapshot.run(snapshotId, periodId);
      if (Number(result.changes) !== 1) {
        throw new Error("No se pudo eliminar el registro historico.");
      }
      if (updatesLastSnapshot) {
        statements.updateLastSnapshot.run(
          replacement?.id ?? null,
          replacement?.saved_at ?? null,
          snapshot.work_day_id,
        );
      }
      database.exec("COMMIT;");

      return {
        deleted: true,
        snapshot_id: snapshotId,
        period_id: periodId,
        work_day_id: snapshot.work_day_id,
        replacement_snapshot_id: replacement?.id ?? null,
      };
    } catch (error) {
      database.exec("ROLLBACK;");
      throw error;
    }
  }

  function listWorkDaySnapshots({ snapshotType, periodId } = {}) {
    const conditions = [];
    const values = [];
    if (snapshotType) {
      conditions.push("snapshot_type = ?");
      values.push(snapshotType);
    }
    if (periodId) {
      conditions.push("period_id = ?");
      values.push(periodId);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const rows = database
      .prepare(
        `SELECT ${SNAPSHOT_COLUMNS}
         FROM work_day_snapshots
         ${where}
         ORDER BY saved_at DESC, rowid DESC`,
      )
      .all(...values);
    return rows.map(mapSnapshot);
  }

  function closedDayResult(workDay) {
    const nextWorkDay = statements.activeWorkDay.get(workDay.period_id);
    const nextSnapshot = nextWorkDay?.last_snapshot_id
      ? statements.snapshotById.get(nextWorkDay.last_snapshot_id)
      : null;
    return {
      already_closed: true,
      closed_work_day: mapWorkDay(workDay),
      next_work_day: mapWorkDay(nextWorkDay),
      history_snapshot: mapSnapshot(
        statements.latestHistoryForDay.get(workDay.id),
      ),
      next_snapshot: mapSnapshot(nextSnapshot),
    };
  }

  function closeWorkDay({
    workDayId,
    inputState,
    computedState,
    summary,
    nextInputState,
    nextComputedState,
    nextSummary,
  }) {
    const workDay = statements.workDayById.get(workDayId);
    if (!workDay) throw new Error("El día de trabajo no existe.");
    if (workDay.status === "closed") return closedDayResult(workDay);

    const expectedNextDate = nextIsoDate(workDay.work_date);
    if (
      nextInputState?.config?.workDate !== expectedNextDate ||
      nextSummary?.workDate !== expectedNextDate
    ) {
      throw new Error("Los datos del día siguiente tienen una fecha incorrecta.");
    }
    if (
      summary?.workDate !== workDay.work_date ||
      inputState?.config?.workDate !== workDay.work_date
    ) {
      throw new Error("El resumen no corresponde al día activo.");
    }

    database.exec("BEGIN IMMEDIATE;");
    try {
      const savedAt = now();
      const historySnapshot = insertSnapshot({
        periodId: workDay.period_id,
        workDayId,
        snapshotType: "registro_history",
        inputState,
        computedState,
        summary,
        savedAt,
      });
      statements.closeWorkDay.run(
        historySnapshot.id,
        savedAt,
        savedAt,
        workDayId,
      );

      const nextWorkDayId = randomUUID();
      statements.insertWorkDay.run(
        nextWorkDayId,
        workDay.period_id,
        expectedNextDate,
        savedAt,
      );
      const nextSnapshot = insertSnapshot({
        periodId: workDay.period_id,
        workDayId: nextWorkDayId,
        snapshotType: "day_opening",
        inputState: nextInputState,
        computedState: nextComputedState,
        summary: nextSummary,
        savedAt,
      });
      statements.updateLastSnapshot.run(
        nextSnapshot.id,
        savedAt,
        nextWorkDayId,
      );
      database.exec("COMMIT;");

      return {
        already_closed: false,
        saved_at: savedAt,
        closed_work_day: mapWorkDay(
          statements.workDayById.get(workDayId),
        ),
        next_work_day: mapWorkDay(
          statements.workDayById.get(nextWorkDayId),
        ),
        history_snapshot: historySnapshot,
        next_snapshot: nextSnapshot,
      };
    } catch (error) {
      database.exec("ROLLBACK;");
      throw error;
    }
  }

  return {
    importLegacyDatabase,
    ensureActiveWorkDay,
    saveWorkDaySnapshot,
    saveRegistroHistorySnapshot,
    deleteRegistroHistorySnapshot,
    listWorkDaySnapshots,
    closeWorkDay,
    close() {
      if (isClosed) return;
      isClosed = true;
      database.close();
    },
  };
}

module.exports = {
  createLocalDatabase,
};
