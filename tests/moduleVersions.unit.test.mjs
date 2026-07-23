import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const SOURCE_ROOT = path.resolve("src");
const PHASE_E_MODULE_PATTERN = /(?:model|layout|permissions)\.js\?v=([^"']+)/g;

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

test("modified shared modules use the Phase E cache version consistently", async () => {
  const staleImports = [];
  for (const file of await javascriptFiles(SOURCE_ROOT)) {
    const source = await readFile(file, "utf8");
    for (const match of source.matchAll(PHASE_E_MODULE_PATTERN)) {
      if (match[1] !== "20260723-phase-e") {
        staleImports.push(`${path.relative(SOURCE_ROOT, file)} -> ${match[0]}`);
      }
    }
  }

  assert.deepEqual(staleImports, []);
});
