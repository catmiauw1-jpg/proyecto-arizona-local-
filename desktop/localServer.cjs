const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { randomBytes, timingSafeEqual } = require("node:crypto");

const {
  createLocalDatabase,
} = require("./localDatabase.cjs");

const LOCAL_CONFIG = Object.freeze({
  configured: true,
  supabaseUrl: "http://127.0.0.1/arizona-local",
  supabasePublishableKey: "arizona-local-only-key",
});

function contentType(filePath) {
  const types = new Map([
    [".css", "text/css; charset=utf-8"],
    [".gif", "image/gif"],
    [".html", "text/html; charset=utf-8"],
    [".ico", "image/x-icon"],
    [".jpeg", "image/jpeg"],
    [".jpg", "image/jpeg"],
    [".js", "text/javascript; charset=utf-8"],
    [".json", "application/json; charset=utf-8"],
    [".png", "image/png"],
    [".svg", "image/svg+xml"],
    [".webp", "image/webp"],
  ]);
  return types.get(path.extname(filePath).toLowerCase()) ?? "application/octet-stream";
}

function send(response, statusCode, headers, body = "") {
  response.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...headers,
  });
  if (response.req.method === "HEAD") {
    response.end();
    return;
  }
  response.end(body);
}

function isAllowedRelativePath(relativePath) {
  const normalizedPath = relativePath.split(path.sep).join("/");
  return (
    normalizedPath === "index.html" ||
    normalizedPath === "desktop/localSupabaseClient.js" ||
    normalizedPath.startsWith("src/")
  );
}

function resolveStaticPath(projectRoot, pathname) {
  let relativePath;
  try {
    relativePath = pathname === "/" ? "index.html" : decodeURIComponent(pathname.slice(1));
  } catch {
    return null;
  }

  const filePath = path.resolve(projectRoot, relativePath);
  const relativeToRoot = path.relative(projectRoot, filePath);
  const escapesRoot =
    relativeToRoot === ".." ||
    relativeToRoot.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeToRoot);

  if (escapesRoot || !isAllowedRelativePath(relativeToRoot)) return null;
  return filePath;
}

function serveStatic(projectRoot, requestUrl, response, headers = {}) {
  const filePath = resolveStaticPath(projectRoot, requestUrl.pathname);
  if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    send(response, 404, { "Content-Type": "text/plain; charset=utf-8", ...headers }, "Not found");
    return;
  }

  const body = fs.readFileSync(filePath);
  send(response, 200, { "Content-Type": contentType(filePath), ...headers }, body);
}

function cookieValue(request, name) {
  const cookies = String(request.headers.cookie ?? "").split(";");
  for (const cookie of cookies) {
    const separator = cookie.indexOf("=");
    if (separator < 0) continue;
    if (cookie.slice(0, separator).trim() === name) {
      return cookie.slice(separator + 1).trim();
    }
  }
  return "";
}

function secureEqual(left, right) {
  const leftBuffer = Buffer.from(String(left ?? ""));
  const rightBuffer = Buffer.from(String(right ?? ""));
  return (
    leftBuffer.length === rightBuffer.length &&
    leftBuffer.length > 0 &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function trustedApiRequest(request, securityContext) {
  return (
    request.headers.host === securityContext.expectedHost &&
    request.headers.origin === securityContext.expectedOrigin &&
    secureEqual(
      cookieValue(request, "arizona_local_token"),
      securityContext.apiToken,
    )
  );
}

function readJsonBody(request, maximumBytes = 8 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    if (
      !String(request.headers["content-type"] ?? "")
        .toLowerCase()
        .startsWith("application/json")
    ) {
      reject(Object.assign(new Error("Se requiere contenido JSON."), { statusCode: 415 }));
      return;
    }

    const chunks = [];
    let totalBytes = 0;
    request.on("data", (chunk) => {
      totalBytes += chunk.length;
      if (totalBytes > maximumBytes) {
        reject(Object.assign(new Error("La solicitud local es demasiado grande."), { statusCode: 413 }));
        request.resume();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      if (totalBytes > maximumBytes) return;
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(Object.assign(new Error("El contenido JSON no es válido."), { statusCode: 400 }));
      }
    });
    request.on("error", reject);
  });
}

function filterRows(rows, filters = []) {
  const allowedFields = new Set([
    "id",
    "auth_user_id",
    "client_id",
    "active",
    "name",
    "period_id",
    "work_day_id",
    "snapshot_type",
    "saved_at",
  ]);

  return filters.reduce((result, filter) => {
    if (!allowedFields.has(filter?.field)) {
      throw new Error("Filtro local no permitido.");
    }
    return result.filter((row) => row[filter.field] === filter.value);
  }, rows);
}

function orderRows(rows, orders = []) {
  const allowedFields = new Set(["saved_at", "id"]);
  return orders.reduceRight((result, order) => {
    if (!allowedFields.has(order?.field)) {
      throw new Error("Orden local no permitido.");
    }
    const direction = order.ascending === false ? -1 : 1;
    return [...result].sort((left, right) => {
      if (left[order.field] === right[order.field]) return 0;
      return left[order.field] > right[order.field] ? direction : -direction;
    });
  }, rows);
}

function executeRpc(database, name, params = {}) {
  if (name === "import_legacy_local_storage") {
    return database.importLegacyDatabase(params.p_legacy_database);
  }
  if (name === "ensure_active_work_day") {
    return database.ensureActiveWorkDay();
  }
  if (name === "save_work_day_snapshot") {
    return database.saveWorkDaySnapshot({
      workDayId: params.p_work_day_id,
      inputState: params.p_input_state,
      computedState: params.p_computed_state,
      summary: params.p_summary,
    });
  }
  if (name === "save_registro_history_snapshot") {
    return database.saveRegistroHistorySnapshot({
      workDayId: params.p_work_day_id,
      inputState: params.p_input_state,
      computedState: params.p_computed_state,
      summary: params.p_summary,
    });
  }
  if (name === "delete_registro_history_snapshot") {
    return database.deleteRegistroHistorySnapshot({
      snapshotId: params.p_snapshot_id,
      periodId: params.p_period_id,
      actorRole: params.p_actor_role,
    });
  }
  if (name === "close_work_day") {
    return database.closeWorkDay({
      workDayId: params.p_work_day_id,
      inputState: params.p_input_state,
      computedState: params.p_computed_state,
      summary: params.p_summary,
      nextInputState: params.p_next_input_state,
      nextComputedState: params.p_next_computed_state,
      nextSummary: params.p_next_summary,
    });
  }
  throw new Error(`RPC local no soportado: ${name}`);
}

function executeQuery(database, body) {
  const filters = Array.isArray(body?.filters) ? body.filters : [];
  const orders = Array.isArray(body?.orders) ? body.orders : [];
  let rows;

  if (body?.table === "app_users") {
    rows = [
      {
        id: "app-user-local",
        auth_user_id: "auth-user-local",
        client_id: "client-local",
        role: "operator",
        active: true,
      },
    ];
  } else if (body?.table === "clients") {
    rows = [
      {
        id: "client-local",
        name: "Confinamiento Arizona",
        active: true,
      },
    ];
  } else if (body?.table === "work_day_snapshots") {
    rows = database.listWorkDaySnapshots();
  } else {
    throw new Error("Tabla local no permitida.");
  }

  const filtered = filterRows(rows, filters);
  const ordered = orderRows(filtered, orders);
  return body?.single === true ? ordered[0] ?? null : ordered;
}

function sendJson(response, statusCode, payload) {
  send(
    response,
    statusCode,
    { "Content-Type": "application/json; charset=utf-8" },
    JSON.stringify(payload),
  );
}

function createRequestHandler(projectRoot, database, securityContext) {
  return async (request, response) => {
    const requestUrl = new URL(request.url, "http://127.0.0.1");
    const isLocalApi = requestUrl.pathname.startsWith("/api/local/");

    if (isLocalApi && request.method === "POST") {
      if (!trustedApiRequest(request, securityContext)) {
        sendJson(response, 403, {
          data: null,
          error: { message: "Origen local no permitido." },
        });
        return;
      }

      try {
        const body = await readJsonBody(request);
        const data =
          requestUrl.pathname === "/api/local/rpc"
            ? executeRpc(database, body?.name, body?.params)
            : requestUrl.pathname === "/api/local/query"
              ? executeQuery(database, body)
              : null;

        if (data === null) {
          sendJson(response, 404, {
            data: null,
            error: { message: "Operación local no encontrada." },
          });
          return;
        }
        sendJson(response, 200, { data, error: null });
      } catch (error) {
        sendJson(response, error.statusCode ?? 200, {
          data: null,
          error: { message: error.message || "Error de almacenamiento local." },
        });
      }
      return;
    }

    if (!["GET", "HEAD"].includes(request.method)) {
      send(
        response,
        405,
        {
          Allow: "GET, HEAD",
          "Content-Type": "text/plain; charset=utf-8",
        },
        "Method not allowed",
      );
      return;
    }

    if (requestUrl.pathname === "/api/config") {
      send(
        response,
        200,
        { "Content-Type": "application/json; charset=utf-8" },
        JSON.stringify(LOCAL_CONFIG),
      );
      return;
    }

    const responseHeaders =
      requestUrl.pathname === "/"
        ? {
            "Set-Cookie":
              `arizona_local_token=${securityContext.apiToken}; ` +
              "HttpOnly; SameSite=Strict; Path=/api/local",
          }
        : {};
    serveStatic(projectRoot, requestUrl, response, responseHeaders);
  };
}

function startLocalAppServer({
  projectRoot,
  host = "127.0.0.1",
  port = 4173,
  databasePath = ":memory:",
  initialWorkDate,
} = {}) {
  if (!projectRoot) {
    return Promise.reject(new Error("projectRoot es obligatorio."));
  }

  const resolvedRoot = path.resolve(projectRoot);
  const database = createLocalDatabase({
    filename: databasePath,
    initialWorkDate,
  });
  const securityContext = {
    apiToken: randomBytes(32).toString("hex"),
    expectedHost: null,
    expectedOrigin: null,
  };
  const server = http.createServer((request, response) => {
    createRequestHandler(
      resolvedRoot,
      database,
      securityContext,
    )(request, response).catch(
      (error) => {
        sendJson(response, 500, {
          data: null,
          error: { message: error.message || "Error interno local." },
        });
      },
    );
  });

  return new Promise((resolve, reject) => {
    const rejectStart = (error) => {
      database.close();
      reject(error);
    };
    server.once("error", rejectStart);
    server.listen(port, host, () => {
      server.off("error", rejectStart);
      const address = server.address();
      const activePort = typeof address === "object" && address ? address.port : port;
      const url = `http://${host}:${activePort}/`;
      securityContext.expectedHost = `${host}:${activePort}`;
      securityContext.expectedOrigin = `http://${host}:${activePort}`;

      resolve({
        host,
        port: activePort,
        server,
        url,
        close: () =>
          new Promise((closeResolve, closeReject) => {
            if (!server.listening) {
              database.close();
              closeResolve();
              return;
            }
            server.close((error) => {
              database.close();
              if (error) closeReject(error);
              else closeResolve();
            });
          }),
      });
    });
  });
}

module.exports = {
  LOCAL_CONFIG,
  createRequestHandler,
  executeQuery,
  executeRpc,
  startLocalAppServer,
};
