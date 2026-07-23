const DATABASE_KEY = "__arizona_phase_d_local__";
const ACTIVE_WORK_DATE = "2026-07-20";

function initialDatabase() {
  return {
    counter: 0,
    period: {
      id: "period-local",
      name: "Periodo local Fase D",
      start_date: ACTIVE_WORK_DATE,
      status: "active",
    },
    workDay: {
      id: "work-day-local",
      period_id: "period-local",
      work_date: ACTIVE_WORK_DATE,
      status: "active",
      last_snapshot_id: null,
      last_saved_at: null,
    },
    snapshots: [],
  };
}

function readDatabase() {
  const stored = localStorage.getItem(DATABASE_KEY);
  if (stored) return JSON.parse(stored);
  const database = initialDatabase();
  localStorage.setItem(DATABASE_KEY, JSON.stringify(database));
  return database;
}

function writeDatabase(database) {
  localStorage.setItem(DATABASE_KEY, JSON.stringify(database));
}

function nextSnapshot(database, snapshotType, params) {
  const counter = database.counter + 1;
  const prefix = snapshotType === "registro_history" ? "history" : "manual";
  const id = `${prefix}-${String(counter).padStart(3, "0")}`;
  const savedAt = new Date(Date.UTC(2026, 6, 20, 12, 0, counter)).toISOString();
  const snapshot = {
    id,
    work_day_id: database.workDay.id,
    snapshot_type: snapshotType,
    saved_by: "app-user-local",
    saved_at: savedAt,
    input_state: structuredClone(params.p_input_state),
    computed_state: structuredClone(params.p_computed_state),
    summary: structuredClone(params.p_summary),
  };
  const nextDatabase = {
    ...database,
    counter,
    snapshots: [...database.snapshots, snapshot],
    workDay:
      snapshotType === "manual_save"
        ? {
            ...database.workDay,
            last_snapshot_id: id,
            last_saved_at: savedAt,
          }
        : database.workDay,
  };
  writeDatabase(nextDatabase);
  return { database: nextDatabase, snapshot };
}

function compareRows(orders) {
  return (left, right) => {
    for (const order of orders) {
      if (left[order.field] === right[order.field]) continue;
      const direction = order.ascending ? 1 : -1;
      return left[order.field] > right[order.field] ? direction : -direction;
    }
    return 0;
  };
}

function tableQuery(table) {
  const filters = [];
  const orders = [];
  const builder = {
    select() {
      return builder;
    },
    eq(field, value) {
      filters.push({ field, value });
      return builder;
    },
    order(field, options = {}) {
      orders.push({ field, ascending: options.ascending !== false });
      return builder;
    },
    async maybeSingle() {
      if (table === "app_users") {
        return {
          data: {
            id: "app-user-local",
            auth_user_id: "auth-user-local",
            client_id: "client-local",
            role: "operator",
            active: true,
          },
          error: null,
        };
      }
      if (table === "clients") {
        return {
          data: { id: "client-local", name: "Confinamiento Arizona", active: true },
          error: null,
        };
      }
      return { data: null, error: null };
    },
    then(resolve, reject) {
      Promise.resolve()
        .then(() => {
          if (table !== "work_day_snapshots") return { data: [], error: null };
          let rows = readDatabase().snapshots.filter((row) =>
            filters.every((filter) => row[filter.field] === filter.value),
          );
          rows = [...rows].sort(compareRows(orders));
          return { data: rows, error: null };
        })
        .then(resolve, reject);
    },
  };
  return builder;
}

export function createClient() {
  return {
    auth: {
      async getUser() {
        return {
          data: { user: { id: "auth-user-local", email: "local@arizona.test" } },
          error: null,
        };
      },
      async signInWithPassword() {
        return { data: {}, error: null };
      },
      async signOut() {
        return { error: null };
      },
    },
    from(table) {
      return tableQuery(table);
    },
    async rpc(name, params = {}) {
      const database = readDatabase();
      if (name === "ensure_active_work_day") {
        const snapshot =
          database.snapshots.find((item) => item.id === database.workDay.last_snapshot_id) ?? null;
        return {
          data: {
            period: database.period,
            work_day: database.workDay,
            snapshot,
          },
          error: null,
        };
      }
      if (name === "save_work_day_snapshot") {
        const result = nextSnapshot(database, "manual_save", params);
        return {
          data: {
            snapshot_id: result.snapshot.id,
            saved_at: result.snapshot.saved_at,
            work_day_id: result.database.workDay.id,
            period_id: result.database.period.id,
          },
          error: null,
        };
      }
      if (name === "save_registro_history_snapshot") {
        const result = nextSnapshot(database, "registro_history", params);
        return {
          data: {
            snapshot_id: result.snapshot.id,
            saved_at: result.snapshot.saved_at,
            work_day_id: result.database.workDay.id,
            period_id: result.database.period.id,
            snapshot_type: "registro_history",
            work_date: result.snapshot.summary.workDate,
          },
          error: null,
        };
      }
      return { data: null, error: { message: `RPC no soportado: ${name}` } };
    },
  };
}
