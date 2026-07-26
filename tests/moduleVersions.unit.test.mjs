import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const SOURCE_ROOT = path.resolve("src");
const MODEL_MODULE_PATTERN = /model\.js\?v=([^"']+)/g;
const PERMISSIONS_MODULE_PATTERN = /permissions\.js\?v=([^"']+)/g;
const EDITABLE_LOADS_VERSION = "20260723-editable-loads-v2";
const EXCEL_PARITY_VERSION = "20260723-excel-parity-v1";
const ADAPTATION_TABS_VERSION = "20260723-adaptation-tabs-v3";

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
      if (match[1] !== EXCEL_PARITY_VERSION) {
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
    ["src/main.js", "screens/incomeScreen.js"],
    ["src/main.js", "screens/consumptionScreen.js"],
    ["src/main.js", "state/store.js"],
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

test("ADAPTACION tabs are cache-busted through the browser entry chain", async () => {
  const expectations = [
    ["index.html", "src/main.js"],
    ["index.html", "src/styles.css"],
    ["src/main.js", "screens/feedingScreen.js"],
  ];

  for (const [sourcePath, importedPath] of expectations) {
    const source = await readFile(path.resolve(sourcePath), "utf8");
    assert.match(
      source,
      new RegExp(`${importedPath.replaceAll("/", "\\/")}\\?v=${ADAPTATION_TABS_VERSION}`),
      `${sourcePath} must import ${importedPath} with the ADAPTACION tabs cache version`,
    );
  }
});

test("editable ingredient loads use one cache version through the browser entry chain", async () => {
  const expectations = [
    ["src/screens/feedingScreen.js", "components/layout.js"],
    ["src/screens/feedingScreen.js", "domain/calculations.js"],
    ["src/state/store.js", "data/baseData.js"],
    ["src/state/store.js", "domain/calculations.js"],
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
