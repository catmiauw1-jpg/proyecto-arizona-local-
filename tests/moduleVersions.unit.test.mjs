import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const SOURCE_ROOT = path.resolve("src");
const MODEL_MODULE_PATTERN = /model\.js\?v=([^"']+)/g;
const PERMISSIONS_MODULE_PATTERN = /permissions\.js\?v=([^"']+)/g;
const EDITABLE_LOADS_VERSION = "20260723-editable-loads-v2";
const EXCEL_PARITY_VERSION = "20260723-excel-parity-v1";
const ACTIVE_LOTS_VERSION = "20260727-active-lots-v1";
const HISTORY_DELETE_VERSION = "20260727-history-delete-v1";
const SINGLE_DATE_VERSION = "20260729-single-date-v2";
const FEEDING_UI_VERSION = "20260729-active-ingredients-v1";
const DATE_REOPEN_VERSION = "20260729-date-reopen-v1";

async function javascriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) return javascriptFiles(target);
      return entry.isFile() && entry.name.endsWith(".js") ? [target] : [];
    }),
  );
  return nested.flat();
}

test("shared model and permissions modules use their current cache versions", async () => {
  const staleImports = [];
  for (const file of await javascriptFiles(SOURCE_ROOT)) {
    const source = await readFile(file, "utf8");
    for (const match of source.matchAll(MODEL_MODULE_PATTERN)) {
      if (match[1] !== "20260723-phase-e") {
        staleImports.push(`${path.relative(SOURCE_ROOT, file)} -> ${match[0]}`);
      }
    }
    for (const match of source.matchAll(PERMISSIONS_MODULE_PATTERN)) {
      if (match[1] !== HISTORY_DELETE_VERSION) {
        staleImports.push(`${path.relative(SOURCE_ROOT, file)} -> ${match[0]}`);
      }
    }
  }

  assert.deepEqual(staleImports, []);
});

test("Excel parity changes are cache-busted through the browser entry chain", async () => {
  const expectations = [
    ["src/main.js", "components/layout.js"],
    ["src/main.js", "screens/dietScreen.js"],
    ["src/main.js", "screens/consumptionScreen.js"],
    ["src/screens/feedingScreen.js", "components/fields.js"],
  ];

  for (const [sourcePath, importedPath] of expectations) {
    const source = await readFile(path.resolve(sourcePath), "utf8");
    assert.match(
      source,
      new RegExp(`${importedPath.replaceAll("/", "\\/")}\\?v=${EXCEL_PARITY_VERSION}`),
      `${sourcePath} must import ${importedPath} with the Excel parity cache version`,
    );
  }
});

test("active lot selection is cache-busted through the browser entry chain", async () => {
  const expectations = [
    ["src/main.js", "state/store.js"],
  ];

  for (const [sourcePath, importedPath] of expectations) {
    const source = await readFile(path.resolve(sourcePath), "utf8");
    assert.match(
      source,
      new RegExp(`${importedPath.replaceAll("/", "\\/")}\\?v=${ACTIVE_LOTS_VERSION}`),
      `${sourcePath} must import ${importedPath} with the active-lots cache version`,
    );
  }
});

test("history deletion is cache-busted through the browser entry chain", async () => {
  const expectations = [
    ["src/main.js", "screens/historyScreen.js"],
    ["src/main.js", "domain/permissions.js"],
    ["src/screens/historyScreen.js", "domain/permissions.js"],
  ];

  for (const [sourcePath, importedPath] of expectations) {
    const source = await readFile(path.resolve(sourcePath), "utf8");
    assert.match(
      source,
      new RegExp(`${importedPath.replaceAll("/", "\\/")}\\?v=${HISTORY_DELETE_VERSION}`),
      `${sourcePath} must import ${importedPath} with the history-delete cache version`,
    );
  }
});

test("single active date is cache-busted through the browser entry chain", async () => {
  const expectations = [
    ["index.html", "src/styles.css"],
    ["src/main.js", "domain/calculations.js"],
    ["src/main.js", "screens/incomeScreen.js"],
    ["src/main.js", "state/runtimeState.js"],
    ["src/screens/feedingScreen.js", "domain/calculations.js"],
    ["src/screens/incomeScreen.js", "domain/calculations.js"],
    ["src/screens/incomeScreen.js", "components/table.js"],
    ["src/screens/incomeScreen.js", "components/fields.js"],
    ["src/state/store.js", "domain/calculations.js"],
    ["src/components/table.js", "fields.js"],
  ];

  for (const [sourcePath, importedPath] of expectations) {
    const source = await readFile(path.resolve(sourcePath), "utf8");
    assert.match(
      source,
      new RegExp(`${importedPath.replaceAll("/", "\\/")}\\?v=${SINGLE_DATE_VERSION}`),
      `${sourcePath} must import ${importedPath} with the single-date cache version`,
    );
  }
});

test("feeding UI changes are cache-busted through the browser entry chain", async () => {
  const expectations = [
    ["src/main.js", "screens/feedingScreen.js"],
  ];

  for (const [sourcePath, importedPath] of expectations) {
    const source = await readFile(path.resolve(sourcePath), "utf8");
    assert.match(
      source,
      new RegExp(
        `${importedPath.replaceAll("/", "\\/")}\\?v=${FEEDING_UI_VERSION}`,
      ),
      `${sourcePath} must import ${importedPath} with the feeding UI cache version`,
    );
  }
});

test("date reopening is cache-busted through the browser entry chain", async () => {
  const expectations = [
    ["index.html", "src/main.js"],
    ["src/main.js", "services/workDayService.js"],
  ];

  for (const [sourcePath, importedPath] of expectations) {
    const source = await readFile(path.resolve(sourcePath), "utf8");
    assert.match(
      source,
      new RegExp(
        `${importedPath.replaceAll("/", "\\/")}\\?v=${DATE_REOPEN_VERSION}`,
      ),
      `${sourcePath} must import ${importedPath} with the date-reopen cache version`,
    );
  }
});

test("editable ingredient loads use one cache version through the browser entry chain", async () => {
  const expectations = [
    ["src/screens/feedingScreen.js", "components/layout.js"],
    ["src/state/store.js", "data/baseData.js"],
  ];

  for (const [sourcePath, importedPath] of expectations) {
    const source = await readFile(path.resolve(sourcePath), "utf8");
    assert.match(
      source,
      new RegExp(`${importedPath.replaceAll("/", "\\/")}\\?v=${EDITABLE_LOADS_VERSION}`),
      `${sourcePath} must import ${importedPath} with the editable-loads cache version`,
    );
  }
});
