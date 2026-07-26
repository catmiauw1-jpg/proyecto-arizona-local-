import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { historyScreen } from "../src/screens/historyScreen.js";
import { reportScreen } from "../src/screens/reportScreen.js";
import { ROLES } from "../src/domain/permissions.js";

const maliciousLot = '<button data-action="saveWorkDay">INJECTED</button>';
const maliciousAnimalCount = '<img src=x onerror="alert(1)">';

function reportRow(overrides = {}) {
  return {
    pen: "A-1",
    currentDiet: "ADAPTACION",
    dietName: "Dieta adaptacion",
    lotCode: "LOTE-A",
    animalCount: 10,
    estimatedWeight: 300,
    cmoLot: 100,
    cmoAnimal: 10,
    cmsLot: 80,
    cmsAnimal: 8,
    imsPct: 0.02,
    nutritionalCostAnimal: 3,
    nutritionalCostLot: 30,
    financialAverage: 5,
    financialTotal: 50,
    ...overrides,
  };
}

test("historical report escapes stored markup instead of creating actions", () => {
  const html = reportScreen({
    reportRows: [
      reportRow({
        lotCode: maliciousLot,
        animalCount: maliciousAnimalCount,
      }),
    ],
  });

  assert.doesNotMatch(html, /<button data-action="saveWorkDay">INJECTED<\/button>/);
  assert.match(html, /&lt;button data-action=&quot;saveWorkDay&quot;&gt;INJECTED&lt;\/button&gt;/);
  assert.doesNotMatch(html, /<img src=x onerror=/);
});

test("registro presents the current day, historical averages and accumulated totals", () => {
  const html = reportScreen(
    { reportRows: [reportRow({ nutritionalCostAnimal: 7, nutritionalCostLot: 70 })] },
    {
      workDate: "2026-07-23",
      snapshots: [
        {
          saved_at: "2026-07-22T18:00:00.000Z",
          summary: { workDate: "2026-07-22" },
          computed_state: {
            reportRows: [
              reportRow({ nutritionalCostAnimal: 3, nutritionalCostLot: 30 }),
            ],
          },
        },
      ],
    },
  );

  assert.match(html, /Registro del día 2026-07-23/);
  assert.match(html, /FINANCIERO PROMEDIO/);
  assert.match(html, /FINANCIERO TOTAL/);
  assert.match(html, /Jornadas incluidas/);
  assert.match(html, />2</);
});

test("selected history renders a read-only report", () => {
  const html = historyScreen({
    status: "ready",
    snapshots: [],
    filters: { date: "", pen: "", lot: "", diet: "" },
    message: "",
    selectedSnapshot: {
      id: "history-1",
      saved_at: "2026-07-20T12:00:00.000Z",
      summary: { workDate: "2026-07-20" },
      computed_state: { reportRows: [reportRow()] },
    },
  }, { role: ROLES.OPERATOR });

  assert.match(html, /Solo consulta/);
  assert.doesNotMatch(html, /<(input|select|textarea)\b/i);
});

test("administrator can edit a historical draft and save an append-only correction", () => {
  const snapshot = {
    id: "history-1",
    saved_at: "2026-07-20T12:00:00.000Z",
    summary: { workDate: "2026-07-20" },
    computed_state: { reportRows: [reportRow()] },
  };
  const html = historyScreen({
    status: "ready",
    saveStatus: "ready",
    snapshots: [snapshot],
    filters: { date: "", pen: "", lot: "", diet: "" },
    message: "",
    selectedSnapshot: snapshot,
    isEditing: true,
    draftComputedState: structuredClone(snapshot.computed_state),
  }, { role: ROLES.ADMIN });

  assert.match(html, /Corrección administrativa/);
  assert.match(html, /data-action="updateHistoricalReport:0:cmoLot:number"/);
  assert.match(html, /data-action="saveHistoryCorrection"/);
});

test("history query orders snapshots from newest to oldest by saved_at", () => {
  const serviceSource = fs.readFileSync(
    new URL("../src/services/workDayService.js", import.meta.url),
    "utf8",
  );

  assert.match(
    serviceSource,
    /\.order\("saved_at",\s*\{\s*ascending:\s*false\s*\}\)/,
  );
  assert.match(
    serviceSource,
    /\.eq\("period_id",\s*periodId\)/,
  );
  assert.match(serviceSource, /input_state/);
});

test("history RPC remains append-only and does not update the operational pointer", () => {
  const migration = fs.readFileSync(
    new URL("../supabase/migrations/20260716120000_phase_c_registro_history.sql", import.meta.url),
    "utf8",
  );
  const functionBody = migration.match(
    /create or replace function public\.save_registro_history_snapshot[\s\S]*?\$\$;/i,
  )?.[0];

  assert.ok(functionBody);
  assert.match(functionBody, /insert into public\.work_day_snapshots/i);
  assert.doesNotMatch(functionBody, /update\s+public\.work_days/i);
  assert.doesNotMatch(functionBody, /delete\s+from\s+public\.work_day_snapshots/i);
});
