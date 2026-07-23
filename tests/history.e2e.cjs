const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const test = require("node:test");
const { chromium } = require("playwright-core");

const projectRoot = path.resolve(__dirname, "..");
const activeWorkDate = "2026-07-20";
const injectedLot = 'LOTE-B <button data-action="saveWorkDay">INJECTED</button>';

const supabaseMockModule = String.raw`
const DATABASE_KEY = "__arizona_history_validation__";

function initialDatabase() {
  return {
    counter: 0,
    period: {
      id: "period-1",
      name: "Periodo local de prueba",
      start_date: "${activeWorkDate}",
      status: "active"
    },
    workDay: {
      id: "work-day-1",
      period_id: "period-1",
      work_date: "${activeWorkDate}",
      status: "active",
      last_snapshot_id: null,
      last_saved_at: null
    },
    snapshots: []
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

function nextSnapshot(database, type, params) {
  const counter = database.counter + 1;
  const prefix = type === "registro_history" ? "history" : "manual";
  const id = prefix + "-" + String(counter).padStart(3, "0");
  const savedAt =
    type === "registro_history"
      ? "2026-07-20T12:" + String(counter).padStart(2, "0") + ":00.000Z"
      : "2026-07-20T11:" + String(counter).padStart(2, "0") + ":00.000Z";
  const snapshot = {
    id,
    work_day_id: database.workDay.id,
    snapshot_type: type,
    saved_by: "app-user-1",
    saved_at: savedAt,
    input_state: structuredClone(params.p_input_state),
    computed_state: structuredClone(params.p_computed_state),
    summary: structuredClone(params.p_summary)
  };
  const nextDatabase = {
    ...database,
    counter,
    snapshots: [...database.snapshots, snapshot],
    workDay:
      type === "manual_save"
        ? {
            ...database.workDay,
            last_snapshot_id: id,
            last_saved_at: savedAt
          }
        : database.workDay
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
            id: "app-user-1",
            auth_user_id: "auth-user-1",
            client_id: "client-1",
            role: "operator",
            active: true
          },
          error: null
        };
      }
      if (table === "clients") {
        return { data: { id: "client-1", name: "Confinamiento Arizona", active: true }, error: null };
      }
      return { data: null, error: null };
    },
    then(resolve, reject) {
      Promise.resolve().then(() => {
        if (table !== "work_day_snapshots") return { data: [], error: null };
        let rows = readDatabase().snapshots.filter((row) =>
          filters.every((filter) => row[filter.field] === filter.value)
        );
        rows = [...rows].sort(compareRows(orders));
        return { data: rows, error: null };
      }).then(resolve, reject);
    }
  };
  return builder;
}

export function createClient() {
  return {
    auth: {
      async getUser() {
        return { data: { user: { id: "auth-user-1", email: "local@example.test" } }, error: null };
      },
      async signInWithPassword() {
        return { data: {}, error: null };
      },
      async signOut() {
        return { error: null };
      }
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
            snapshot
          },
          error: null
        };
      }
      if (name === "save_work_day_snapshot") {
        const result = nextSnapshot(database, "manual_save", params);
        return {
          data: {
            snapshot_id: result.snapshot.id,
            saved_at: result.snapshot.saved_at,
            work_day_id: result.database.workDay.id,
            period_id: result.database.period.id
          },
          error: null
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
            work_date: result.snapshot.summary.workDate
          },
          error: null
        };
      }
      return { data: null, error: { message: "RPC no soportado: " + name } };
    }
  };
}
`;

function contentType(filePath) {
  const types = new Map([
    [".css", "text/css; charset=utf-8"],
    [".html", "text/html; charset=utf-8"],
    [".js", "text/javascript; charset=utf-8"],
    [".png", "image/png"],
  ]);
  return types.get(path.extname(filePath).toLowerCase()) ?? "application/octet-stream";
}

function createLocalServer() {
  return http.createServer((request, response) => {
    const requestUrl = new URL(request.url, "http://127.0.0.1");
    if (requestUrl.pathname === "/api/config") {
      response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      response.end(
        JSON.stringify({
          configured: true,
          supabaseUrl: "http://127.0.0.1/mock-supabase",
          supabasePublishableKey: "local-test-key",
        }),
      );
      return;
    }

    const relativePath = requestUrl.pathname === "/" ? "index.html" : requestUrl.pathname.slice(1);
    const filePath = path.resolve(projectRoot, relativePath);
    if (!filePath.startsWith(`${projectRoot}${path.sep}`) || !fs.existsSync(filePath)) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, { "Content-Type": contentType(filePath) });
    response.end(fs.readFileSync(filePath));
  });
}

function findBrowserExecutable() {
  const candidates = [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

async function updateField(page, action, value) {
  const field = page.locator(`[data-action="${action}"]`);
  await field.fill(value);
  await field.press("Tab");
}

async function readMockDatabase(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem("__arizona_history_validation__")));
}

test("validates append-only history, read-only consultation and reload locally", { timeout: 60_000 }, async (t) => {
  const executablePath = findBrowserExecutable();
  assert.ok(executablePath, "Se requiere Microsoft Edge o Google Chrome para la prueba local.");

  const server = createLocalServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const origin = `http://127.0.0.1:${address.port}`;
  const browser = await chromium.launch({ executablePath, headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const unexpectedRequests = [];
  const consoleErrors = [];
  const pageErrors = [];

  t.after(async () => {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  });

  await context.route("**/*", async (route) => {
    const url = route.request().url();
    if (url === "https://esm.sh/@supabase/supabase-js@2.53.0") {
      await route.fulfill({
        status: 200,
        contentType: "text/javascript; charset=utf-8",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: supabaseMockModule,
      });
      return;
    }
    if (url.startsWith(origin)) {
      await route.continue();
      return;
    }
    unexpectedRequests.push(url);
    await route.abort();
  });
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(origin, { waitUntil: "domcontentloaded" });
  await page.getByText("Ingreso de lotes y calculo inicial").waitFor();

  const workDateField = page
    .getByText("Fecha de trabajo", { exact: true })
    .locator("..")
    .locator(".locked-field");
  assert.equal(await workDateField.textContent(), activeWorkDate);

  await updateField(page, "updateLot:lot-1:lotCode:text", "LOTE-A");
  await updateField(page, "updateLot:lot-1:animalCount:number", "10");
  await page.locator('[data-action="updateLot:lot-1:currentDiet:select"]').selectOption("ADAPTACION");
  await page.locator('[data-action="saveWorkDay"]').click();
  await page.getByText("Guardado correctamente.").waitFor();
  const firstOperational = await readMockDatabase(page);
  const firstOperationalId = firstOperational.workDay.last_snapshot_id;

  await page.locator('[data-action="saveRegistroHistory"]').click();
  await page.getByText(/Registro histórico guardado correctamente/).waitFor();
  const afterFirstHistory = await readMockDatabase(page);
  assert.equal(afterFirstHistory.workDay.last_snapshot_id, firstOperationalId);
  const firstHistorySnapshot = structuredClone(
    afterFirstHistory.snapshots.find((snapshot) => snapshot.snapshot_type === "registro_history"),
  );

  await updateField(page, "updateLot:lot-1:lotCode:text", injectedLot);
  await updateField(page, "updateLot:lot-1:animalCount:number", "20");
  await page.locator('[data-action="saveWorkDay"]').click();
  await page.getByText("Guardado correctamente.").waitFor();
  const secondOperational = await readMockDatabase(page);
  const secondOperationalId = secondOperational.workDay.last_snapshot_id;
  assert.notEqual(secondOperationalId, firstOperationalId);

  await page.locator('[data-action="saveRegistroHistory"]').click();
  await page.getByText(/Registro histórico guardado correctamente/).waitFor();
  const database = await readMockDatabase(page);
  const histories = database.snapshots.filter((snapshot) => snapshot.snapshot_type === "registro_history");
  assert.equal(database.snapshots.length, 4);
  assert.equal(histories.length, 2);
  assert.notEqual(histories[0].id, histories[1].id);
  assert.deepEqual(histories[0], firstHistorySnapshot);
  assert.equal(histories[0].input_state.lots[0].lotCode, "LOTE-A");
  assert.equal(histories[0].input_state.lots[0].animalCount, 10);
  assert.equal(histories[0].computed_state.reportRows[0].lotCode, "LOTE-A");
  assert.equal(histories[0].computed_state.reportRows[0].animalCount, 10);
  assert.equal(histories[1].input_state.lots[0].lotCode, injectedLot);
  assert.equal(histories[1].input_state.lots[0].animalCount, 20);
  assert.equal(histories[1].computed_state.reportRows[0].lotCode, injectedLot);
  assert.equal(histories[1].computed_state.reportRows[0].animalCount, 20);
  assert.equal(database.workDay.last_snapshot_id, secondOperationalId);

  await page.getByRole("link", { name: "HISTORIAL", exact: true }).click();
  const viewButtons = page.getByRole("button", { name: "Ver registro", exact: true });
  await viewButtons.first().waitFor();
  assert.equal(await viewButtons.count(), 2);

  await viewButtons.first().click();
  await page.getByText("Vista histórica", { exact: false }).waitFor();
  assert.match(await page.locator("main.workspace").innerText(), /LOTE-B/);
  assert.equal(await page.getByRole("button", { name: "INJECTED", exact: true }).count(), 0);
  assert.equal(await page.locator("main.workspace input, main.workspace select, main.workspace textarea").count(), 0);
  assert.equal(await page.locator('[data-action="saveWorkDay"]').count(), 0);

  await page.getByRole("button", { name: "Volver al dia actual", exact: true }).click();
  assert.equal(
    await page.locator('[data-action="updateLot:lot-1:lotCode:text"]').inputValue(),
    injectedLot,
  );
  assert.equal(await page.locator('[data-action="updateLot:lot-1:animalCount:number"]').inputValue(), "20");

  await page.getByRole("link", { name: "HISTORIAL", exact: true }).click();
  await page.getByRole("button", { name: "Ver registro", exact: true }).nth(1).click();
  await page.getByText("Vista histórica", { exact: false }).waitFor();
  assert.match(await page.locator("main.workspace").innerText(), /LOTE-A/);
  assert.doesNotMatch(await page.locator("main.workspace").innerText(), /LOTE-B/);

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Ver registro", exact: true }).first().waitFor();
  assert.equal(await page.getByText("Vista histórica", { exact: false }).count(), 0);
  assert.equal(await page.getByRole("button", { name: "Ver registro", exact: true }).count(), 2);
  await page.getByRole("link", { name: "Ingreso", exact: true }).click();
  assert.equal(
    await page.locator('[data-action="updateLot:lot-1:lotCode:text"]').inputValue(),
    injectedLot,
  );
  assert.equal(await page.locator('[data-action="updateLot:lot-1:animalCount:number"]').inputValue(), "20");
  assert.equal(
    await page.getByText("Fecha de trabajo", { exact: true }).locator("..").locator(".locked-field").textContent(),
    activeWorkDate,
  );

  const visibleText = await page.locator("body").innerText();
  assert.doesNotMatch(visibleText, /\b(?:NaN|Infinity|undefined)\b/);
  assert.deepEqual(unexpectedRequests, []);
  assert.deepEqual(consoleErrors, []);
  assert.deepEqual(pageErrors, []);
});
