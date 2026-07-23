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
        if (localStorage.getItem("__arizona_force_save_failure__") === "1") {
          return { data: null, error: { message: "Fallo simulado al guardar." } };
        }
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
  await page.locator('[data-action="setLocalRole"]').selectOption("admin_arizona");

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
  assert.equal(
    await page
      .locator(
        "main.workspace input, main.workspace select:not([data-action='setLocalRole']):not([data-action='setLocalLicenseScenario']), main.workspace textarea",
      )
      .count(),
    0,
  );
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

test("validates local roles, persistent locks and protected handlers", { timeout: 60_000 }, async (t) => {
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

  const roleSelector = page.locator('[data-action="setLocalRole"]');
  assert.equal(await roleSelector.inputValue(), "operator");
  assert.equal(await page.getByText("Herramienta local de prueba", { exact: true }).count(), 1);
  assert.equal(await page.locator('[data-action="updateConfig:clientName:text"]').isDisabled(), true);
  assert.equal(await page.locator('[data-action="updateLot:lot-1:lotCode:text"]').isDisabled(), false);
  assert.equal(await page.locator('[data-action="saveRegistroHistory"]').count(), 0);

  await roleSelector.selectOption("admin_arizona");
  await updateField(page, "updateLot:lot-1:lotCode:text", "LOTE-ROLES");
  await updateField(page, "updateLot:lot-1:animalCount:number", "12");
  await page.locator('[data-action="updateLot:lot-1:currentDiet:select"]').selectOption("ADAPTACION");
  await page.evaluate(() => localStorage.setItem("__arizona_force_save_failure__", "1"));
  await page.locator('[data-action="lockInitialData"]').click();
  await page.getByText("Fallo simulado al guardar.").waitFor();
  assert.equal(await page.locator('[data-action="updateLot:lot-1:lotCode:text"]').isDisabled(), false);
  await page.evaluate(() => localStorage.removeItem("__arizona_force_save_failure__"));
  await page.locator('[data-action="lockInitialData"]').click();
  await page.getByText("Datos iniciales bloqueados y guardados.").waitFor();
  assert.equal(await page.locator('[data-action="updateLot:lot-1:lotCode:text"]').isDisabled(), true);

  let database = await readMockDatabase(page);
  let currentSnapshot = database.snapshots.find(
    (snapshot) => snapshot.id === database.workDay.last_snapshot_id,
  );
  assert.equal(currentSnapshot.input_state.accessControl.initialDataLocked, true);

  await roleSelector.selectOption("operator");
  assert.equal(await page.locator('[data-action="updateLot:lot-1:lotCode:text"]').isDisabled(), true);
  assert.equal(
    await page
      .locator('[data-action="updateLot:lot-1:consumptionAdjustmentPct:percent"]')
      .first()
      .isDisabled(),
    false,
  );
  assert.equal(await page.locator('[data-action="saveWorkDay"]').count(), 1);
  assert.equal(await page.locator('[data-action="saveRegistroHistory"]').count(), 0);

  await page.evaluate(() => {
    const input = document.querySelector('[data-action="updateLot:lot-1:lotCode:text"]');
    input.disabled = false;
    input.value = "ALTERADO";
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.getByText("Acción no permitida para el rol activo.").waitFor();
  assert.equal(await page.locator('[data-action="updateLot:lot-1:lotCode:text"]').inputValue(), "LOTE-ROLES");

  await roleSelector.selectOption("admin_arizona");
  page.once("dialog", async (dialog) => {
    assert.match(dialog.message(), /desbloquear los datos iniciales/i);
    await dialog.accept();
  });
  await page.locator('[data-action="unlockInitialData"]').click();
  await page.getByText("Datos iniciales desbloqueados y guardados.").waitFor();
  assert.equal(await page.locator('[data-action="updateLot:lot-1:lotCode:text"]').isDisabled(), false);
  await page.locator('[data-action="lockInitialData"]').click();
  await page.getByText("Datos iniciales bloqueados y guardados.").waitFor();

  await page.getByRole("link", { name: "ADAPT", exact: true }).click();
  const ingredientAction = "updateIngredient:ADAPTACION:ad-1:costBsTon:currency";
  assert.equal(await page.locator(`[data-action="${ingredientAction}"]`).isDisabled(), false);
  await updateField(page, ingredientAction, "250");
  await page.locator('[data-action="lockDiet:ADAPTACION"]').click();
  await page.getByText("Dieta bloqueada y guardada.").waitFor();
  assert.equal(await page.locator(`[data-action="${ingredientAction}"]`).isDisabled(), true);

  database = await readMockDatabase(page);
  currentSnapshot = database.snapshots.find(
    (snapshot) => snapshot.id === database.workDay.last_snapshot_id,
  );
  assert.equal(currentSnapshot.input_state.accessControl.dietLocks.ADAPTACION, true);

  page.once("dialog", async (dialog) => {
    assert.match(dialog.message(), /desbloquear la dieta/i);
    await dialog.accept();
  });
  await page.locator('[data-action="unlockDiet:ADAPTACION"]').click();
  await page.getByText("Dieta desbloqueada y guardada.").waitFor();
  assert.equal(await page.locator(`[data-action="${ingredientAction}"]`).isDisabled(), false);
  await page.locator('[data-action="lockDiet:ADAPTACION"]').click();
  await page.getByText("Dieta bloqueada y guardada.").waitFor();

  await roleSelector.selectOption("operator");
  assert.equal(await page.locator(`[data-action="${ingredientAction}"]`).isDisabled(), true);
  await page.evaluate((action) => {
    const input = document.querySelector(`[data-action="${action}"]`);
    input.disabled = false;
    input.value = "999";
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, ingredientAction);
  await page.getByText("Acción no permitida para el rol activo.").waitFor();
  assert.equal(await page.locator(`[data-action="${ingredientAction}"]`).inputValue(), "250");

  await page.getByRole("link", { name: "ADAPTACION", exact: true }).click();
  assert.equal(
    await page.locator('[data-action="updateTreatment:ADAPTACION:1:time:text"]').isDisabled(),
    true,
  );
  assert.equal(
    await page.locator('[data-action="updateTreatment:ADAPTACION:1:sharePct:percent"]').isDisabled(),
    true,
  );
  const actualAction = "updateFeedingActual:ADAPTACION:lot-1:1:number";
  assert.equal(await page.locator(`[data-action="${actualAction}"]`).isDisabled(), false);
  await updateField(page, actualAction, "12.5");

  await page.getByRole("link", { name: "ANOTACION DE CONSUMO", exact: true }).click();
  const consumptionAction = "updateConsumption:lot-1:msRealizedManual:number";
  assert.equal(await page.locator(`[data-action="${consumptionAction}"]`).isDisabled(), false);
  await updateField(page, consumptionAction, "10.25");
  await page.locator('[data-action="saveWorkDay"]').click();
  await page.getByText("Guardado correctamente.").waitFor();

  await roleSelector.selectOption("admin_arizona");
  await page.locator('[data-action="saveRegistroHistory"]').click();
  await page.getByText(/Registro histórico guardado correctamente/).waitFor();
  await roleSelector.selectOption("operator");
  assert.equal(await page.locator('[data-action="saveRegistroHistory"]').count(), 0);

  await page.getByRole("link", { name: "HISTORIAL", exact: true }).click();
  await page.getByRole("button", { name: "Ver registro", exact: true }).click();
  await page.getByText("Vista histórica", { exact: false }).waitFor();
  assert.equal(await page.locator("main.workspace input:not([data-action='setLocalRole']), main.workspace textarea").count(), 0);
  assert.equal(await page.locator('[data-action="saveWorkDay"]').count(), 0);

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("link", { name: "Ingreso", exact: true }).click();
  assert.equal(await page.locator('[data-action="setLocalRole"]').inputValue(), "operator");
  assert.equal(await page.locator('[data-action="updateLot:lot-1:lotCode:text"]').isDisabled(), true);
  await page.getByRole("link", { name: "ADAPT", exact: true }).click();
  assert.equal(await page.locator(`[data-action="${ingredientAction}"]`).isDisabled(), true);

  const visibleText = await page.locator("body").innerText();
  assert.doesNotMatch(visibleText, /\b(?:NaN|Infinity|undefined)\b/);
  assert.deepEqual(unexpectedRequests, []);
  assert.deepEqual(consoleErrors, []);
  assert.deepEqual(pageErrors, []);
});

test("validates every local license state without mutating operational data", { timeout: 60_000 }, async (t) => {
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
  const roleSelector = page.locator('[data-action="setLocalRole"]');
  const licenseSelector = page.locator('[data-action="setLocalLicenseScenario"]');
  await roleSelector.selectOption("admin_arizona");
  assert.equal(await licenseSelector.inputValue(), "active");

  await updateField(page, "updateLot:lot-1:lotCode:text", "LICENCIA-DATO");
  await updateField(page, "updateLot:lot-1:animalCount:number", "15");
  await page.locator('[data-action="updateLot:lot-1:currentDiet:select"]').selectOption("ADAPTACION");
  await page.locator('[data-action="saveWorkDay"]').click();
  await page.getByText("Guardado correctamente.").waitFor();
  await page.locator('[data-action="saveRegistroHistory"]').click();
  await page.waitForFunction(() => {
    const database = JSON.parse(localStorage.getItem("__arizona_history_validation__"));
    return database.snapshots.some((snapshot) => snapshot.snapshot_type === "registro_history");
  });
  const databaseBeforeLicenseTests = await readMockDatabase(page);

  await licenseSelector.selectOption("expiring");
  await page.getByText("La licencia está próxima a vencer.", { exact: true }).first().waitFor();
  assert.equal(await page.locator('[data-action="saveWorkDay"]').count(), 1);
  await page.getByRole("link", { name: "LICENCIA", exact: true }).click();
  assert.match(await page.locator("main.workspace").innerText(), /Días restantes\s+3/);

  await page.locator('[data-action="setLocalLicenseScenario"]').selectOption("expired");
  await page.getByRole("heading", { name: "Licencia", exact: true }).waitFor();
  assert.match(await page.locator("main.workspace").innerText(), /Licencia vencida\. Contacte al administrador\./);
  assert.equal(await page.locator('[data-action="authSignOut"]').count(), 1);

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Licencia", exact: true }).waitFor();
  assert.match(await page.locator("main.workspace").innerText(), /Vencida/);

  await page.getByRole("link", { name: "Ingreso", exact: true }).click();
  const lotCodeInput = page.locator('[data-action="updateLot:lot-1:lotCode:text"]');
  assert.equal(await lotCodeInput.inputValue(), "LICENCIA-DATO");
  assert.equal(await lotCodeInput.isDisabled(), true);
  assert.equal(await page.locator('[data-action="saveWorkDay"]').count(), 0);
  assert.equal(await page.locator('[data-action="saveRegistroHistory"]').count(), 0);

  await page.evaluate(() => {
    const input = document.querySelector('[data-action="updateLot:lot-1:lotCode:text"]');
    input.disabled = false;
    input.value = "NO-DEBE-GUARDARSE";
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.getByText("Licencia vencida. Contacte al administrador.", { exact: true }).first().waitFor();
  assert.equal(await lotCodeInput.inputValue(), "LICENCIA-DATO");
  assert.deepEqual(await readMockDatabase(page), databaseBeforeLicenseTests);

  await page.locator('[data-action="setLocalLicenseScenario"]').selectOption("blocked");
  await page.getByRole("heading", { name: "Licencia", exact: true }).waitFor();
  assert.match(await page.locator("main.workspace").innerText(), /Licencia bloqueada\. Contacte al administrador\./);

  await page.locator('[data-action="setLocalLicenseScenario"]').selectOption("unconfigured");
  assert.match(await page.locator("main.workspace").innerText(), /Licencia no configurada\. Contacte al administrador\./);
  assert.deepEqual(await readMockDatabase(page), databaseBeforeLicenseTests);

  await page.locator('[data-action="setLocalLicenseScenario"]').selectOption("active");
  await page.getByRole("link", { name: "Ingreso", exact: true }).click();
  assert.equal(await page.locator('[data-action="updateLot:lot-1:lotCode:text"]').inputValue(), "LICENCIA-DATO");
  assert.equal(await page.locator('[data-action="saveWorkDay"]').count(), 1);

  await page.locator('[data-action="setLocalLicenseScenario"]').selectOption("expired");
  await page.locator('[data-action="authSignOut"]').click();
  await page.getByRole("heading", { name: "Iniciar sesion", exact: true }).waitFor();
  assert.deepEqual(await readMockDatabase(page), databaseBeforeLicenseTests);

  const visibleText = await page.locator("body").innerText();
  assert.doesNotMatch(visibleText, /\b(?:NaN|Infinity|undefined)\b/);
  assert.deepEqual(unexpectedRequests, []);
  assert.deepEqual(consoleErrors, []);
  assert.deepEqual(pageErrors, []);
});
