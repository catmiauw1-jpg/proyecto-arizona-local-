import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");

function ruleBody(selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return styles.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
}

test("Excel treatment board keeps five ordered blocks with internal tables", () => {
  const boardRule = ruleBody(".excel-treatment-board");
  const scrollRule = ruleBody(".excel-treatment-scroll");
  const columnRule = ruleBody(".excel-treatment-column");
  const loadsRule = ruleBody(".treatment-loads");
  const tableRule = ruleBody(".treatment-loads table");
  const piqueteTableRule = ruleBody(".treatment-piquete-table");

  assert.match(boardRule, /grid-template-columns:\s*repeat\(4,\s*minmax\(260px,\s*1fr\)\)\s*minmax\(700px,\s*2\.5fr\)/);
  assert.match(scrollRule, /overflow-x:\s*auto/);
  assert.match(columnRule, /min-width:\s*260px/);
  assert.match(loadsRule, /min-width:\s*0/);
  assert.match(tableRule, /min-width:\s*0/);
  assert.match(tableRule, /table-layout:\s*fixed/);
  assert.match(piqueteTableRule, /min-width:\s*0/);
  assert.match(piqueteTableRule, /table-layout:\s*fixed/);
});

test("ADAPTACION has modern treatment tabs, workspace and summary table", () => {
  const tabsRule = ruleBody(".adaptation-treatment-tabs");
  const workspaceRule = ruleBody(".adaptation-treatment-workspace");
  const summaryRule = ruleBody(".adaptation-summary-table");

  assert.match(tabsRule, /display:\s*flex/);
  assert.match(tabsRule, /overflow-x:\s*auto/);
  assert.match(workspaceRule, /grid-template-columns:\s*minmax\(320px,\s*380px\)\s*minmax\(0,\s*1fr\)/);
  assert.match(summaryRule, /min-width:\s*620px/);
});

test("modern treatment controls and tables use a readable scale", () => {
  const tabRule = ruleBody(".adaptation-treatment-tab");
  const tabTitleRule = ruleBody(".adaptation-treatment-tab span");
  const workspaceRule = ruleBody(".adaptation-treatment-workspace");
  const headingRule = ruleBody(".adaptation-panel-heading strong");
  const piqueteTableRule = ruleBody(
    ".adaptation-treatment-panel .treatment-piquete-table",
  );
  const piqueteCellRule = ruleBody(
    ".adaptation-treatment-panel .treatment-piquete-table td",
  );
  const realizedInputRule = ruleBody(
    ".adaptation-treatment-panel .excel-realized-cell input",
  );

  assert.match(tabRule, /min-height:\s*66px/);
  assert.match(tabTitleRule, /font-size:\s*15px/);
  assert.match(
    workspaceRule,
    /grid-template-columns:\s*minmax\(320px,\s*380px\)\s*minmax\(0,\s*1fr\)/,
  );
  assert.match(headingRule, /font-size:\s*19px/);
  assert.match(piqueteTableRule, /font-size:\s*12px/);
  assert.match(piqueteCellRule, /height:\s*34px/);
  assert.match(realizedInputRule, /font-size:\s*12px/);
});

test("realizado cells use the same soft yellow as their header", () => {
  const cellRule = ruleBody(".excel-realized-cell");
  const inputRule = ruleBody(".excel-realized-cell input");
  const headerRule = ruleBody(
    '.adaptation-treatment-panel .treatment-piquete-table .input-head',
  );

  assert.match(headerRule, /background:\s*#fff0a3/);
  assert.match(cellRule, /background:\s*#fff0a3/);
  assert.match(inputRule, /background:\s*#fff0a3/);
});
