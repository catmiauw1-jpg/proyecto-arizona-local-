import assert from "node:assert/strict";
import test from "node:test";

import { appLayout } from "../src/components/layout.js";
import { valueInput } from "../src/components/fields.js";
import { createEmptyPeriodState } from "../src/data/baseData.js";
import { calculateState } from "../src/domain/calculations.js";
import { ROLES } from "../src/domain/permissions.js";
import { consumptionScreen } from "../src/screens/consumptionScreen.js";
import { dietScreen } from "../src/screens/dietScreen.js";
import { feedingScreen } from "../src/screens/feedingScreen.js";
import { incomeScreen } from "../src/screens/incomeScreen.js";
import { reportScreen } from "../src/screens/reportScreen.js";

function tagForAction(html, action) {
  const escapedAction = action.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.match(new RegExp(`<(?:input|select|button)[^>]*data-action="${escapedAction}"[^>]*>`))?.[0] ?? "";
}

function stateWithActiveLot() {
  const emptyState = createEmptyPeriodState();
  return {
    ...emptyState,
    lots: emptyState.lots.map((lot, index) =>
      index === 0
        ? {
            ...lot,
            lotCode: "LOTE-ROL",
            animalCount: 10,
            initialWeight: 300,
            currentDiet: "ADAPTACION",
          }
        : lot,
    ),
  };
}

test("valueInput keeps locked values visible in a disabled control", () => {
  const html = valueInput({
    value: "Dato protegido",
    type: "text",
    onInput: "update:test",
    disabled: true,
  });

  assert.match(html, /value="Dato protegido"/);
  assert.match(html, /\bdisabled\b/);
  assert.match(html, /aria-disabled="true"/);
});

test("valueInput presents stored decimal shares as whole percentages", () => {
  const html = valueInput({
    value: 0.2,
    type: "percentInteger",
    onInput: "updateTreatment:ADAPTACION:1:sharePct:percentInteger",
  });

  assert.match(html, /value="20"/);
  assert.match(html, /step="1"/);
});

test("valueInput presents editable percentages in human units", () => {
  const html = valueInput({
    value: 0.016,
    type: "percentInput",
    onInput: "updateLot:lot-1:initialImsPct:percentInput",
  });

  assert.match(html, /value="1.6"/);
  assert.match(html, /step="0.01"/);
});

test("local layout exposes only the test tool and omits the global day panel", () => {
  const html = appLayout({
    activeSheet: "Ingreso",
    content: "<p>Contenido</p>",
    sessionContext: {
      user: { email: "local@example.test" },
      client: { name: "Arizona" },
    },
    workDayContext: {
      workDay: { work_date: "2026-07-20" },
      period: { name: "Prueba" },
      saveStatus: "ready",
      historyStatus: "ready",
      permissions: {
        canSaveWorkDay: true,
        canSaveHistory: true,
      },
    },
    roleContext: {
      role: ROLES.OPERATOR,
      localToolEnabled: true,
    },
  });

  assert.match(html, /Herramienta local de prueba/);
  assert.match(html, />\s*INGRESO\s*</);
  assert.match(html, /data-action="setLocalRole"/);
  assert.match(html, /Rol activo[\s\S]*Operador/);
  assert.doesNotMatch(html, /Día activo/);
  assert.doesNotMatch(html, /Último guardado/);
  assert.doesNotMatch(html, /data-action="saveWorkDay"/);
  assert.doesNotMatch(html, /data-action="closeWorkDay"/);
  assert.doesNotMatch(html, /data-action="saveRegistroHistory"/);
  assert.doesNotMatch(html, />\s*ADAPT\s*</);
  assert.doesNotMatch(html, />\s*TRANS\s*</);
  assert.doesNotMatch(html, />\s*TERM\s*</);
  assert.doesNotMatch(html, /session-card|authSignOut|Cerrar sesion/);
});

test("non-local layout omits the temporary role selector", () => {
  const html = appLayout({
    activeSheet: "Ingreso",
    content: "",
    roleContext: {
      role: ROLES.ADMIN,
      localToolEnabled: false,
    },
  });

  assert.doesNotMatch(html, /Herramienta local de prueba/);
  assert.doesNotMatch(html, /data-action="setLocalRole"/);
});

test("registro day actions fail closed when explicit permissions are absent", () => {
  const state = stateWithActiveLot();
  const html = reportScreen(calculateState(state), {
    workDate: state.config.workDate,
  });

  assert.doesNotMatch(html, /data-action="saveWorkDay"/);
  assert.doesNotMatch(html, /data-action="closeWorkDay"/);
});

test("operator can edit only current diet and adjustment in income", () => {
  const state = stateWithActiveLot();
  const computed = calculateState(state);
  const html = incomeScreen(state, computed, {
    role: ROLES.OPERATOR,
    initialDataLocked: true,
  });

  assert.match(html, /Datos iniciales bloqueados/);
  assert.match(tagForAction(html, "updateConfig:clientName:text"), /\bdisabled\b/);
  assert.match(tagForAction(html, "updateLot:lot-1:lotCode:text"), /\bdisabled\b/);
  assert.doesNotMatch(
    tagForAction(html, "updateLot:lot-1:currentDiet:select"),
    /\bdisabled\b/,
  );
  assert.doesNotMatch(
    tagForAction(html, "updateLot:lot-1:consumptionAdjustmentPct:percentInput"),
    /\bdisabled\b/,
  );
  assert.doesNotMatch(html, /Consumo por animal/);
  assert.match(html, /Resumen por dieta/);
  assert.doesNotMatch(html, /data-action="unlockInitialData"/);
});

test("administrator can lock and unlock initial data but must unlock before editing", () => {
  const state = stateWithActiveLot();
  const computed = calculateState(state);
  const unlockedHtml = incomeScreen(state, computed, {
    role: ROLES.ADMIN,
    initialDataLocked: false,
  });
  const lockedHtml = incomeScreen(state, computed, {
    role: ROLES.ADMIN,
    initialDataLocked: true,
  });

  assert.match(unlockedHtml, /data-action="lockInitialData"/);
  assert.doesNotMatch(tagForAction(unlockedHtml, "updateLot:lot-1:lotCode:text"), /\bdisabled\b/);
  assert.match(lockedHtml, /data-action="unlockInitialData"/);
  assert.match(tagForAction(lockedHtml, "updateLot:lot-1:lotCode:text"), /\bdisabled\b/);
});

test("diet lock and role disable ingredient editing with admin-only actions", () => {
  const state = stateWithActiveLot();
  const computed = calculateState(state);
  const sheet = { id: "ADAPT", label: "ADAPT", kind: "diet", dietId: "ADAPTACION" };
  const ingredientAction = "updateIngredient:ADAPTACION:ad-1:costBsTon:currency";
  const adminUnlocked = dietScreen(sheet, state, computed, {
    role: ROLES.ADMIN,
    dietLocked: false,
  });
  const adminLocked = dietScreen(sheet, state, computed, {
    role: ROLES.ADMIN,
    dietLocked: true,
  });
  const operatorUnlocked = dietScreen(sheet, state, computed, {
    role: ROLES.OPERATOR,
    dietLocked: false,
  });

  assert.match(adminUnlocked, /data-action="lockDiet:ADAPTACION"/);
  assert.doesNotMatch(tagForAction(adminUnlocked, ingredientAction), /\bdisabled\b/);
  assert.match(adminLocked, /Dieta bloqueada/);
  assert.match(adminLocked, /data-action="unlockDiet:ADAPTACION"/);
  assert.match(tagForAction(adminLocked, ingredientAction), /\bdisabled\b/);
  assert.doesNotMatch(operatorUnlocked, /data-action="(?:lock|unlock)Diet/);
  assert.match(tagForAction(operatorUnlocked, ingredientAction), /\bdisabled\b/);
});

test("operator edits only yellow operational cells in feeding and consumption", () => {
  const baseState = stateWithActiveLot();
  const state = {
    ...baseState,
    treatmentIngredientActuals: {
      ADAPTACION: {
        1: {
          "ad-1": 123.45,
        },
      },
    },
  };
  const computed = calculateState(state);
  const feedingSheet = {
    id: "ADAPTACION",
    label: "ADAPTACION",
    kind: "feeding",
    dietId: "ADAPTACION",
  };
  const feedingHtml = feedingScreen(feedingSheet, state, computed, {
    role: ROLES.OPERATOR,
    dietLocked: true,
  });
  const consumptionHtml = consumptionScreen(computed, {
    role: ROLES.OPERATOR,
  });

  assert.match(
    tagForAction(feedingHtml, "updateTreatment:ADAPTACION:1:time:text"),
    /\bdisabled\b/,
  );
  assert.match(
    tagForAction(feedingHtml, "updateTreatment:ADAPTACION:1:sharePct:percentInteger"),
    /\bdisabled\b/,
  );
  assert.doesNotMatch(
    tagForAction(feedingHtml, "updateFeedingActual:ADAPTACION:lot-1:1:number"),
    /\bdisabled\b/,
  );
  const ingredientLoadInput = tagForAction(
    feedingHtml,
    "updateTreatmentIngredientActual:ADAPTACION:1:ad-1:number",
  );
  assert.match(ingredientLoadInput, /\bdisabled\b/);
  assert.match(ingredientLoadInput, /value="123,45"/);
  assert.match(ingredientLoadInput, /data-calculated-value=/);
  assert.match(feedingHtml, /Total[\s\S]*123,45/);
  assert.match(
    tagForAction(feedingHtml, "updateFeedingActual:ADAPTACION:lot-20:5:number"),
    /data-action=/,
  );
  assert.equal((feedingHtml.match(/data-treatment-piquete="1"/g) ?? []).length, 20);
  assert.equal((feedingHtml.match(/data-treatment-piquete="5"/g) ?? []).length, 20);
  assert.doesNotMatch(
    tagForAction(consumptionHtml, "updateConsumption:lot-1:msRealizedManual:number"),
    /\bdisabled\b/,
  );
  assert.match(consumptionHtml, /data-action="applyConsumptionFromCalculated"/);
});

test("administrator can edit kg loads and yellow feeding actuals", () => {
  const state = stateWithActiveLot();
  const computed = calculateState(state);
  const feedingHtml = feedingScreen(
    {
      id: "ADAPTACION",
      label: "ADAPTACION",
      kind: "feeding",
      dietId: "ADAPTACION",
    },
    state,
    computed,
    {
      role: ROLES.ADMIN,
      dietLocked: false,
    },
  );

  assert.doesNotMatch(
    tagForAction(feedingHtml, "updateTreatmentIngredientActual:ADAPTACION:1:ad-1:number"),
    /\bdisabled\b/,
  );
  assert.match(
    tagForAction(
      feedingHtml,
      "updateTreatment:ADAPTACION:1:sharePct:percentInteger",
    ),
    /value="20"/,
  );
  assert.doesNotMatch(
    tagForAction(feedingHtml, "updateFeedingActual:ADAPTACION:lot-1:1:number"),
    /\bdisabled\b/,
  );
});

test("feeding keeps automatic kilograms visible beside a manual load", () => {
  const emptyState = createEmptyPeriodState();
  const state = {
    ...emptyState,
    diets: {
      ...emptyState.diets,
      ADAPTACION: {
        ...emptyState.diets.ADAPTACION,
        ingredients: emptyState.diets.ADAPTACION.ingredients.map(
          (ingredient, index) =>
            index === 0
              ? {
                  ...ingredient,
                  dryMatterPct: 0.88,
                  inclusionMsPct: 1,
                }
              : ingredient,
        ),
      },
    },
    lots: emptyState.lots.map((lot, index) =>
      index === 0
        ? {
            ...lot,
            entryDate: emptyState.config.workDate,
            animalCount: 150,
            initialWeight: 300,
            currentDiet: "ADAPTACION",
          }
        : lot,
    ),
    treatmentIngredientActuals: {
      ADAPTACION: {
        1: { "ad-1": 10 },
      },
    },
  };
  const computed = calculateState(state);
  const html = feedingScreen(
    {
      id: "ADAPTACION",
      label: "ADAPTACION",
      kind: "feeding",
      dietId: "ADAPTACION",
    },
    state,
    computed,
    {
      role: ROLES.ADMIN,
      dietLocked: false,
      selectedTreatmentNumber: 1,
    },
  );

  assert.match(html, /Prev\. kg/);
  assert.match(html, /Kg a cargar/);
  assert.match(
    html,
    /data-calculated-load="163\.63636363636363"[\s\S]*163,64/,
  );
  assert.match(
    tagForAction(
      html,
      "updateTreatmentIngredientActual:ADAPTACION:1:ad-1:number",
    ),
    /value="10,00"/,
  );
  assert.match(html, /data-treatment-piquete="1"[\s\S]*163,64/);
});

test("ADAPTACION uses treatment tabs with A-1 to A-20 rows", () => {
  const state = stateWithActiveLot();
  const computed = calculateState(state);
  const html = feedingScreen(
    {
      id: "ADAPTACION",
      label: "ADAPTACION",
      kind: "feeding",
      dietId: "ADAPTACION",
    },
    state,
    computed,
    {
      role: ROLES.OPERATOR,
      dietLocked: true,
      selectedTreatmentNumber: 3,
    },
  );

  assert.equal(
    (html.match(/data-action="selectFeedingTreatment:ADAPTACION:/g) ?? []).length,
    5,
  );
  assert.match(
    html,
    /data-treatment-panel="3" class="adaptation-treatment-panel is-active"/,
  );
  assert.match(
    html,
    /data-treatment-panel="1" class="adaptation-treatment-panel"[\s\S]*?\bhidden\b/,
  );
  assert.equal((html.match(/data-treatment-piquete="3"/g) ?? []).length, 20);
  assert.match(
    html,
    /Piquete[\s\S]*Prev\.[\s\S]*realizado[\s\S]*Costo\/trato/,
  );
  assert.doesNotMatch(html, /class="excel-treatment-board"/);
});

test("TRANSICION and TERMINACION use the same modern treatment flow", () => {
  const state = stateWithActiveLot();
  const computed = calculateState(state);

  for (const dietId of ["TRANSICION", "TERMINACION"]) {
    const html = feedingScreen(
      {
        id: dietId,
        label: dietId,
        kind: "feeding",
        dietId,
      },
      state,
      computed,
      {
        role: ROLES.OPERATOR,
        dietLocked: true,
        selectedTreatmentNumber: 2,
      },
    );

    assert.equal(
      (
        html.match(
          new RegExp(`data-action="selectFeedingTreatment:${dietId}:`, "g"),
        ) ?? []
      ).length,
      5,
    );
    assert.match(
      html,
      /data-treatment-panel="2" class="adaptation-treatment-panel is-active"/,
    );
    assert.equal((html.match(/data-treatment-piquete="2"/g) ?? []).length, 20);
    assert.equal((html.match(/data-treatment-piquete="2"/g) ?? []).length, 20);
    assert.match(
      tagForAction(
        html,
        `updateTreatment:${dietId}:2:sharePct:percentInteger`,
      ),
      /value="20"/,
    );
    assert.doesNotMatch(html, /class="excel-treatment-board"/);
  }
});

test("feeding modules omit the duplicated summary and diet base sections", () => {
  const state = stateWithActiveLot();
  const computed = calculateState(state);

  for (const dietId of ["ADAPTACION", "TRANSICION", "TERMINACION"]) {
    const html = feedingScreen(
      { id: dietId, label: dietId, kind: "feeding", dietId },
      state,
      computed,
      {
        role: ROLES.OPERATOR,
        dietLocked: true,
        selectedTreatmentNumber: 1,
      },
    );

    assert.doesNotMatch(html, /Resumen por piquete/);
    assert.doesNotMatch(html, /Base de dieta utilizada/);
  }
});

test("administrator can correct registro rows while operator sees read-only values", () => {
  const state = stateWithActiveLot();
  const computed = calculateState(state);
  const adminHtml = reportScreen(computed, {
    editable: true,
    workDate: state.config.workDate,
    canSaveWorkDay: true,
    canCloseWorkDay: true,
  });
  const operatorHtml = reportScreen(computed, {
    editable: false,
    workDate: state.config.workDate,
  });

  assert.doesNotMatch(
    tagForAction(adminHtml, "updateReportOverride:lot-1:cmoLot:number"),
    /\bdisabled\b/,
  );
  assert.match(adminHtml, /data-action="clearReportOverrides"/);
  assert.match(adminHtml, /data-action="saveWorkDay"/);
  assert.match(adminHtml, /Guardar avance/);
  assert.match(adminHtml, /data-action="closeWorkDay"/);
  assert.match(adminHtml, /Cerrar y guardar día/);
  assert.doesNotMatch(operatorHtml, /data-action="updateReportOverride:/);
  assert.doesNotMatch(operatorHtml, /data-action="clearReportOverrides"/);
});

test("operational screens escape stored markup instead of creating actions", () => {
  const injected = '<button data-action="saveWorkDay">INYECTADO</button>';
  const baseState = stateWithActiveLot();
  const state = {
    ...baseState,
    lots: baseState.lots.map((lot, index) =>
      index === 0 ? { ...lot, pen: injected, lotCode: injected } : lot,
    ),
    diets: {
      ...baseState.diets,
      ADAPTACION: {
        ...baseState.diets.ADAPTACION,
        title: injected,
        ingredients: baseState.diets.ADAPTACION.ingredients.map((ingredient, index) =>
          index === 0 ? { ...ingredient, name: injected } : ingredient,
        ),
      },
    },
  };
  const computed = calculateState(state);
  const feedingSheet = {
    id: "ADAPTACION",
    label: "ADAPTACION",
    kind: "feeding",
    dietId: "ADAPTACION",
  };
  const dietSheet = { id: "ADAPT", label: "ADAPT", kind: "diet", dietId: "ADAPTACION" };
  const feedingHtml = feedingScreen(feedingSheet, state, computed, {
    role: ROLES.OPERATOR,
    dietLocked: true,
  });
  const consumptionHtml = consumptionScreen(computed, { role: ROLES.OPERATOR });
  const dietHtml = dietScreen(dietSheet, state, computed, {
    role: ROLES.ADMIN,
    dietLocked: false,
  });
  const layoutHtml = appLayout({
    activeSheet: "Ingreso",
    content: "",
    sessionContext: {
      user: { email: injected },
      client: { name: injected },
    },
    workDayContext: {
      workDay: { work_date: "2026-07-20" },
      period: { name: injected },
      message: injected,
    },
  });

  for (const html of [feedingHtml, consumptionHtml, dietHtml]) {
    assert.doesNotMatch(html, /<button data-action="saveWorkDay">INYECTADO<\/button>/);
    assert.match(html, /&lt;button data-action=&quot;saveWorkDay&quot;&gt;INYECTADO&lt;\/button&gt;/);
  }
  assert.doesNotMatch(
    layoutHtml,
    /<button data-action="saveWorkDay">INYECTADO<\/button>/,
  );
  assert.match(
    layoutHtml,
    /&lt;button data-action=&quot;saveWorkDay&quot;&gt;INYECTADO&lt;\/button&gt;/,
  );
});
