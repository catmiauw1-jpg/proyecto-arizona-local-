async function postJson(pathname, payload) {
  const response = await fetch(pathname, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => null);

  if (!response.ok || !result) {
    return {
      data: null,
      error: {
        message:
          result?.error?.message ??
          "No se pudo acceder al almacenamiento local.",
      },
    };
  }

  return result;
}

const LEGACY_DATABASE_KEY = "__arizona_phase_d_local__";
let legacyMigrationPromise;

function importLegacyBrowserData() {
  if (!legacyMigrationPromise) {
    legacyMigrationPromise = Promise.resolve().then(async () => {
      const stored = globalThis.localStorage?.getItem(LEGACY_DATABASE_KEY);
      if (!stored) return;

      let legacyDatabase;
      try {
        legacyDatabase = JSON.parse(stored);
      } catch {
        return;
      }

      const result = await postJson("/api/local/rpc", {
        name: "import_legacy_local_storage",
        params: {
          p_legacy_database: legacyDatabase,
        },
      });
      if (result.error) throw new Error(result.error.message);
    });
  }

  return legacyMigrationPromise;
}

function tableQuery(table) {
  const filters = [];
  const orders = [];

  async function execute(single = false) {
    return postJson("/api/local/query", {
      table,
      filters,
      orders,
      single,
    });
  }

  const builder = {
    select() {
      return builder;
    },
    eq(field, value) {
      filters.push({ field, value });
      return builder;
    },
    order(field, options = {}) {
      orders.push({
        field,
        ascending: options.ascending !== false,
      });
      return builder;
    },
    maybeSingle() {
      return execute(true);
    },
    then(resolve, reject) {
      execute(false).then(resolve, reject);
    },
  };

  return builder;
}

export function createClient() {
  return {
    auth: {
      async getUser() {
        return {
          data: {
            user: {
              id: "auth-user-local",
              email: "local@arizona.test",
            },
          },
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
      if (name === "ensure_active_work_day") {
        await importLegacyBrowserData();
      }
      return postJson("/api/local/rpc", { name, params });
    },
  };
}
