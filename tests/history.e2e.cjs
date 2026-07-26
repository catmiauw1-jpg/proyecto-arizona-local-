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
  const prefix =
    type === "registro_history"
      ? "history"
      : type === "day_opening"
        ? "opening"
        : "manual";
  const id = prefix + "-" + String(counter).padStart(3, "0");
  const savedAt =
      type === "registro_history"
      ? "2026-07-20T12:" + String(counter).padStart(2, "0") + ":00.000Z"
      : "2026-07-20T11:" + String(counter).padStart(2, "0") + ":00.000Z";
  const snapshot = {
    id,
    period_id: database.period.id,
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
      ["manual_save", "day_opening"].includes(type)
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
      if (name === "close_work_day") {
        if (params.p_work_day_id !== database.workDay.id) {
          return { data: null, error: { message: "El día ya está cerrado." } };
        }
        const historyResult = nextSnapshot(
          database,
          "registro_history",
          {
            p_input_state: params.p_input_state,
            p_computed_state: params.p_computed_state,
            p_summary: params.p_summary,
          },
        );
        const nextWorkDay = {
          id: "work-day-" + String(historyResult.database.counter + 1),
          period_id: database.period.id,
          work_date: params.p_next_input_state.config.workDate,
          status: "active",
          last_snapshot_id: null,
          last_saved_at: null
        };
        const openingResult = nextSnapshot(
          {
            ...historyResult.database,
            workDay: nextWorkDay,
          },
          "day_opening",
          {
            p_input_state: params.p_next_input_state,
            p_computed_state: params.p_next_computed_state,
            p_summary: params.p_next_summary,
          },
        );
        writeDatabase(openingResult.database);
        return {
          data: {
            already_closed: false,
            saved_at: historyResult.snapshot.saved_at,
            closed_work_day: {
              ...database.workDay,
              status: "closed",
              closed_at: historyResult.snapshot.saved_at
            },
            next_work_day: openingResult.database.workDay,
            history_snapshot: historyResult.snapshot,
            next_snapshot: openingResult.snapshot
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

    if (requestUrl.pathname === "/tests/fixtures/supabaseHistoryValidationMock.js") {
      response.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8" });
      response.end(supabaseMockModule);
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
    const body = fs.readFileSync(filePath);
    if (filePath.endsWith(path.join("src", "services", "supabaseClient.js"))) {
      response.end(
        body
          .toString("utf8")
          .replace(
            "/desktop/localSupabaseClient.js",
            "/tests/fixtures/supabaseHistoryValidationMock.js",
          ),
      );
      return;
    }
    response.end(body);
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

async function openRegistro(page) {
  await page.getByRole("link", { name: "REGISTRO", exact: true }).click();
  await page
    .getByRole("heading", { name: "Informe financiero nutricional", exact: true })
    .waitFor();
}

async function saveActiveDay(page) {
  await openRegistro(page);
  await page.locator('[data-action="saveWorkDay"]').click();
  await page.getByText("Guardado correctamente.").waitFor();
}

async function closeActiveDay(page) {
  await openRegistro(page);
  page.once("dialog", async (dialog) => {
    assert.match(dialog.message(), /cerrará el día/i);
    await dialog.accept();
  });
  await page.locator('[data-action="closeWorkDay"]').click();
  await page.getByText(/cerrado correctamente/).waitFor();
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
  await saveActiveDay(page);
  const firstOperational = await readMockDatabase(page);
  const firstOperationalId = firstOperational.workDay.last_snapshot_id;

  await closeActiveDay(page);
  const afterFirstHistory = await readMockDatabase(page);
  assert.equal(afterFirstHistory.workDay.work_date, "2026-07-21");
  assert.notEqual(afterFirstHistory.workDay.last_snapshot_id, firstOperationalId);
  const firstHistorySnapshot = structuredClone(
    afterFirstHistory.snapshots.find((snapshot) => snapshot.snapshot_type === "registro_history"),
  );
  assert.equal(
    await page
      .getByText("Fecha de trabajo", { exact: true })
      .locator("..")
      .locator(".locked-field")
      .textContent(),
    "2026-07-21",
  );
  assert.equal(
    await page.locator('[data-action="updateLot:lot-1:lotCode:text"]').inputValue(),
    "LOTE-A",
  );

  await updateField(page, "updateLot:lot-1:lotCode:text", injectedLot);
  await updateField(page, "updateLot:lot-1:animalCount:number", "20");
  await saveActiveDay(page);
  const secondOperational = await readMockDatabase(page);
  const secondOperationalId = secondOperational.workDay.last_snapshot_id;
  assert.notEqual(secondOperationalId, firstOperationalId);

  await closeActiveDay(page);
  const database = await readMockDatabase(page);
  const histories = database.snapshots.filter((snapshot) => snapshot.snapshot_type === "registro_history");
  assert.equal(database.snapshots.length, 6);
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
  assert.notEqual(database.workDay.last_snapshot_id, secondOperationalId);
  assert.equal(database.workDay.work_date, "2026-07-22");

  await page.evaluate(() => {
    const storageKey = "__arizona_history_validation__";
    const stored = JSON.parse(localStorage.getItem(storageKey));
    const source = stored.snapshots.find(
      (snapshot) => snapshot.snapshot_type === "registro_history",
    );
    stored.snapshots.push({
      ...structuredClone(source),
      id: "history-foreign-period",
      period_id: "period-foreign",
      summary: {
        ...structuredClone(source.summary),
        workDate: "2026-07-19",
      },
    });
    localStorage.setItem(storageKey, JSON.stringify(stored));
  });

  await page.getByRole("link", { name: "REGISTRO", exact: true }).click();
  await page.getByRole("heading", { name: "FINANCIERO PROMEDIO", exact: true }).waitFor();
  assert.equal(
    await page
      .getByText("Jornadas incluidas", { exact: true })
      .locator("..")
      .locator("strong")
      .textContent(),
    "3",
  );
  assert.equal(
    await page.getByRole("heading", { name: "FINANCIERO TOTAL", exact: true }).count(),
    1,
  );

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

  await page.getByRole("button", { name: "Volver al día actual", exact: true }).click();
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
  await page.getByRole("link", { name: "INGRESO", exact: true }).click();
  assert.equal(
    await page.locator('[data-action="updateLot:lot-1:lotCode:text"]').inputValue(),
    injectedLot,
  );
  assert.equal(await page.locator('[data-action="updateLot:lot-1:animalCount:number"]').inputValue(), "20");
  assert.equal(
    await page.getByText("Fecha de trabajo", { exact: true }).locator("..").locator(".locked-field").textContent(),
    "2026-07-22",
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
  assert.equal(await page.locator('[data-action="updateLot:lot-1:lotCode:text"]').isDisabled(), true);
  assert.equal(await page.locator('[data-action="updateLot:lot-1:currentDiet:select"]').isDisabled(), false);
  assert.equal(await page.locator('[data-action="closeWorkDay"]').count(), 0);

  await roleSelector.selectOption("admin_arizona");
  await updateField(page, "updateLot:lot-1:lotCode:text", "LOTE-ROLES");
  await updateField(page, "updateLot:lot-1:entryDate:date", "2026-07-24");
  await updateField(page, "updateLot:lot-1:animalCount:number", "12");
  await updateField(page, "updateLot:lot-1:initialWeight:number", "300");
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
      .locator('[data-action="updateLot:lot-1:consumptionAdjustmentPct:percentInput"]')
      .first()
      .isDisabled(),
    false,
  );
  assert.equal(await page.locator('[data-action="saveWorkDay"]').count(), 0);
  assert.equal(await page.locator('[data-action="closeWorkDay"]').count(), 0);

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
  await updateField(
    page,
    "updateIngredient:ADAPTACION:ad-1:dryMatterPct:percentInput",
    "88",
  );
  await updateField(
    page,
    "updateIngredient:ADAPTACION:ad-1:inclusionMsPct:percentInput",
    "100",
  );
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
  assert.equal(await page.getByRole("link", { name: "ADAPT", exact: true }).count(), 0);
  assert.equal(await page.locator(`[data-action="${ingredientAction}"]`).count(), 0);
  assert.match(
    await page.locator("main.workspace").innerText(),
    /reservado para el administrador/i,
  );

  await page.getByRole("link", { name: "ADAPTACION", exact: true }).click();
  assert.equal(
    await page.locator('[data-action^="selectFeedingTreatment:ADAPTACION:"]').count(),
    5,
  );
  await page.locator('[data-action="selectFeedingTreatment:ADAPTACION:5"]').click();
  assert.equal(
    await page.locator('[data-treatment-panel="5"]').isVisible(),
    true,
  );
  assert.equal(
    await page.locator('[data-treatment-panel="1"]').isVisible(),
    false,
  );
  await page.locator('[data-action="selectFeedingTreatment:ADAPTACION:1"]').click();
  assert.equal(
    await page.locator('[data-action="updateTreatment:ADAPTACION:1:time:text"]').isDisabled(),
    true,
  );
  assert.equal(
    await page
      .locator(
        '[data-action="updateTreatment:ADAPTACION:1:sharePct:percentInteger"]',
      )
      .isDisabled(),
    true,
  );
  const actualAction = "updateFeedingActual:ADAPTACION:lot-1:1:number";
  assert.equal(await page.locator(`[data-action="${actualAction}"]`).isDisabled(), false);
  assert.ok(
    Number(
      await page
        .locator(
          '[data-treatment-panel="1"] [data-expected-mo]',
        )
        .first()
        .getAttribute("data-expected-mo"),
    ) > 0,
  );
  assert.ok(
    Number(
      await page
        .locator('[data-treatment-panel="1"] [data-calculated-load]')
        .first()
        .getAttribute("data-calculated-load"),
    ) > 0,
  );

  for (const dietId of ["TRANSICION", "TERMINACION"]) {
    await page.getByRole("link", { name: dietId, exact: true }).click();
    await page
      .locator(`[data-action^="selectFeedingTreatment:${dietId}:"]`)
      .first()
      .waitFor();
    assert.equal(
      await page
        .locator(`[data-action^="selectFeedingTreatment:${dietId}:"]`)
        .count(),
      5,
    );
    await page
      .locator(`[data-action="selectFeedingTreatment:${dietId}:5"]`)
      .click();
    assert.equal(
      await page.locator('[data-treatment-panel="5"]').isVisible(),
      true,
    );
    assert.equal(
      await page.locator('[data-treatment-panel="5"] [data-treatment-piquete="5"]').count(),
      20,
    );
  }

  await page.getByRole("link", { name: "ADAPTACION", exact: true }).click();
  await updateField(page, actualAction, "12.5");

  await page.getByRole("link", { name: "ANOTACION DE CONSUMO", exact: true }).click();
  const consumptionAction = "updateConsumption:lot-1:msRealizedManual:number";
  assert.equal(await page.locator(`[data-action="${consumptionAction}"]`).isDisabled(), false);
  await updateField(page, consumptionAction, "10.25");
  await saveActiveDay(page);

  await roleSelector.selectOption("admin_arizona");
  await closeActiveDay(page);
  const afterClose = await readMockDatabase(page);
  const activeOpening = afterClose.snapshots.find(
    (snapshot) => snapshot.id === afterClose.workDay.last_snapshot_id,
  );
  assert.deepEqual(activeOpening.input_state.feedingActuals, {});
  assert.deepEqual(activeOpening.input_state.consumptionNotes, {});
  assert.equal(activeOpening.input_state.lots[0].lotCode, "LOTE-ROLES");
  await roleSelector.selectOption("operator");
  assert.equal(await page.locator('[data-action="closeWorkDay"]').count(), 0);

  await page.getByRole("link", { name: "HISTORIAL", exact: true }).click();
  await page.getByRole("button", { name: "Ver registro", exact: true }).click();
  await page.getByText("Vista histórica", { exact: false }).waitFor();
  assert.equal(await page.locator("main.workspace input:not([data-action='setLocalRole']), main.workspace textarea").count(), 0);
  assert.equal(await page.locator('[data-action="saveWorkDay"]').count(), 0);
  assert.equal(await page.locator('[data-action="closeWorkDay"]').count(), 0);

  const databaseBeforeCorrection = await readMockDatabase(page);
  const originalHistory = databaseBeforeCorrection.snapshots.find(
    (snapshot) => snapshot.snapshot_type === "registro_history",
  );
  const originalCmoLot = originalHistory.computed_state.reportRows[0].cmoLot;

  await roleSelector.selectOption("admin_arizona");
  await page.locator('[data-action="startHistoryCorrection"]').click();
  await updateField(page, "updateHistoricalReport:0:cmoLot:number", "99");
  await page.locator('[data-action="saveHistoryCorrection"]').click();
  await page.getByText(/Corrección guardada como un nuevo registro/).waitFor();

  const databaseAfterCorrection = await readMockDatabase(page);
  const savedHistories = databaseAfterCorrection.snapshots.filter(
    (snapshot) => snapshot.snapshot_type === "registro_history",
  );
  const correctedHistory = savedHistories.find(
    (snapshot) => snapshot.summary?.correctionOf === originalHistory.id,
  );
  assert.equal(savedHistories.length, 2);
  assert.equal(
    savedHistories.find((snapshot) => snapshot.id === originalHistory.id)
      .computed_state.reportRows[0].cmoLot,
    originalCmoLot,
  );
  assert.equal(correctedHistory.computed_state.reportRows[0].cmoLot, 99);
  assert.equal(correctedHistory.computed_state.reportRows[0].cmoAnimal, 8.25);

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("link", { name: "INGRESO", exact: true }).click();
  assert.equal(await page.locator('[data-action="setLocalRole"]').inputValue(), "operator");
  assert.equal(await page.locator('[data-action="updateLot:lot-1:lotCode:text"]').isDisabled(), true);
  assert.equal(await page.getByRole("link", { name: "ADAPT", exact: true }).count(), 0);

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
  await saveActiveDay(page);
  await closeActiveDay(page);
  await page.waitForFunction(() => {
    const database = JSON.parse(localStorage.getItem("__arizona_history_validation__"));
    return database.snapshots.some((snapshot) => snapshot.snapshot_type === "registro_history");
  });
  const databaseBeforeLicenseTests = await readMockDatabase(page);

  await licenseSelector.selectOption("expiring");
  await page.getByText("La licencia está próxima a vencer.", { exact: true }).first().waitFor();
  await openRegistro(page);
  assert.equal(await page.locator('[data-action="saveWorkDay"]').count(), 1);
  await page.getByRole("link", { name: "LICENCIA", exact: true }).click();
  assert.match(await page.locator("main.workspace").innerText(), /Días restantes\s+3/);

  await page.locator('[data-action="setLocalLicenseScenario"]').selectOption("expired");
  await page.getByRole("heading", { name: "Licencia", exact: true }).waitFor();
  assert.match(await page.locator("main.workspace").innerText(), /Licencia vencida\. Contacte al administrador\./);
  assert.equal(await page.locator('[data-action="authSignOut"]').count(), 0);

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Licencia", exact: true }).waitFor();
  assert.match(await page.locator("main.workspace").innerText(), /Vencida/);

  await page.getByRole("link", { name: "INGRESO", exact: true }).click();
  const lotCodeInput = page.locator('[data-action="updateLot:lot-1:lotCode:text"]');
  assert.equal(await lotCodeInput.inputValue(), "LICENCIA-DATO");
  assert.equal(await lotCodeInput.isDisabled(), true);
  assert.equal(await page.locator('[data-action="saveWorkDay"]').count(), 0);
  assert.equal(await page.locator('[data-action="closeWorkDay"]').count(), 0);

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
  await page.getByRole("link", { name: "INGRESO", exact: true }).click();
  assert.equal(await page.locator('[data-action="updateLot:lot-1:lotCode:text"]').inputValue(), "LICENCIA-DATO");
  await openRegistro(page);
  assert.equal(await page.locator('[data-action="saveWorkDay"]').count(), 1);

  await page.locator('[data-action="setLocalLicenseScenario"]').selectOption("expired");
  assert.equal(await page.locator('[data-action="authSignOut"]').count(), 0);
  assert.deepEqual(await readMockDatabase(page), databaseBeforeLicenseTests);

  const visibleText = await page.locator("body").innerText();
  assert.doesNotMatch(visibleText, /\b(?:NaN|Infinity|undefined)\b/);
  assert.deepEqual(unexpectedRequests, []);
  assert.deepEqual(consoleErrors, []);
  assert.deepEqual(pageErrors, []);
});
