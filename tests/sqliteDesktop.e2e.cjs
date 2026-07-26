const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { chromium } = require("playwright-core");

const {
  startLocalAppServer,
} = require("../desktop/localServer.cjs");

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

test(
  "real SQLite desktop flow closes one day, reloads and exposes its history",
  { timeout: 60_000 },
  async (context) => {
    const executablePath = findBrowserExecutable();
    assert.ok(executablePath, "Se requiere Edge o Chrome para la prueba local.");

    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), "arizona-desktop-e2e-"),
    );
    const runtime = await startLocalAppServer({
      projectRoot: path.resolve(__dirname, ".."),
      port: 0,
      databasePath: path.join(directory, "arizona.e2e.db"),
      initialWorkDate: "2026-07-26",
    });
    const browser = await chromium.launch({
      executablePath,
      headless: true,
    });
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    const consoleErrors = [];
    const pageErrors = [];

    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));

    context.after(async () => {
      await browser.close();
      await runtime.close();
      fs.rmSync(directory, { recursive: true, force: true });
    });

    await page.goto(runtime.url, { waitUntil: "networkidle" });
    await page.getByText("Ingreso de lotes y calculo inicial").waitFor();
    assert.equal(
      await page.getByText("Herramienta local de prueba", { exact: true }).count(),
      1,
    );
    assert.equal(await page.locator('[data-action="setLocalRole"]').count(), 1);
    assert.equal(
      await page.locator('[data-action="setLocalLicenseScenario"]').count(),
      1,
    );
    assert.equal(
      await page.locator('[data-action="updateLot:lot-1:lotCode:text"]').isDisabled(),
      true,
    );
    assert.equal(await page.getByRole("link", { name: "ADAPT", exact: true }).count(), 0);
    await page
      .locator('[data-action="setLocalRole"]')
      .selectOption("admin_arizona");

    await updateField(page, "updateLot:lot-1:entryDate:date", "2026-07-20");
    await updateField(page, "updateLot:lot-1:lotCode:text", "LOTE-SQLITE");
    await updateField(page, "updateLot:lot-1:animalCount:number", "150");
    await updateField(page, "updateLot:lot-1:initialWeight:number", "300");
    await updateField(
      page,
      "updateLot:lot-1:consumptionAdjustmentPct:percentInput",
      "5",
    );
    await page
      .locator('[data-action="updateLot:lot-1:currentDiet:select"]')
      .selectOption("ADAPTACION");

    await page.getByRole("link", { name: "ADAPTACION", exact: true }).click();
    await updateField(
      page,
      "updateFeedingActual:ADAPTACION:lot-1:1:number",
      "165",
    );

    await page.getByRole("link", { name: "REGISTRO", exact: true }).click();
    await page
      .getByRole("heading", {
        name: "Informe financiero nutricional",
        exact: true,
      })
      .waitFor();
    page.once("dialog", async (dialog) => {
      assert.match(dialog.message(), /2026-07-26/);
      await dialog.accept();
    });
    await page.locator('[data-action="closeWorkDay"]').click();
    await page.getByText(/Día 2026-07-26 cerrado correctamente/).waitFor();

    assert.equal(
      await page
        .getByText("Fecha de trabajo", { exact: true })
        .locator("..")
        .locator(".locked-field")
        .textContent(),
      "2026-07-27",
    );
    assert.equal(
      await page
        .locator('[data-action="updateLot:lot-1:lotCode:text"]')
        .inputValue(),
      "LOTE-SQLITE",
    );
    assert.equal(
      await page
        .locator(
          '[data-action="updateLot:lot-1:consumptionAdjustmentPct:percentInput"]',
        )
        .inputValue(),
      "5",
    );

    await page.getByRole("link", { name: "ADAPTACION", exact: true }).click();
    assert.notEqual(
      await page
        .locator(
          '[data-action="updateFeedingActual:ADAPTACION:lot-1:1:number"]',
        )
        .inputValue(),
      "165",
    );

    await page.getByRole("link", { name: "HISTORIAL", exact: true }).click();
    await page.getByRole("button", { name: "Ver registro", exact: true }).click();
    await page.getByText("Vista histórica", { exact: false }).waitFor();
    assert.match(await page.locator("main.workspace").innerText(), /LOTE-SQLITE/);

    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("link", { name: "INGRESO", exact: true }).click();
    assert.equal(
      await page
        .getByText("Fecha de trabajo", { exact: true })
        .locator("..")
        .locator(".locked-field")
        .textContent(),
      "2026-07-27",
    );
    assert.equal(
      await page
        .locator('[data-action="updateLot:lot-1:lotCode:text"]')
        .inputValue(),
      "LOTE-SQLITE",
    );
    assert.deepEqual(consoleErrors, []);
    assert.deepEqual(pageErrors, []);
  },
);
