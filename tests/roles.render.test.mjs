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

test("local layout exposes the role test tool and operator day actions", () => {
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
        canSaveHistory: false,
      },
    },
    roleContext: {
      role: ROLES.OPERATOR,
      localToolEnabled: true,
    },
  });

  assert.match(html, /Herramienta local de prueba/);
  assert.match(html, /data-action="setLocalRole"/);
  assert.match(html, /Rol activo[\s\S]*Operador/);
  assert.match(html, /data-action="saveWorkDay"/);
  assert.doesNotMatch(html, /data-action="saveRegistroHistory"/);
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

test("day actions fail closed when explicit permissions are absent", () => {
  const html = appLayout({
    activeSheet: "Ingreso",
    content: "",
    workDayContext: {
      workDay: { work_date: "2026-07-20" },
      period: { name: "Prueba" },
    },
  });

  assert.doesNotMatch(html, /data-action="saveWorkDay"/);
  assert.doesNotMatch(html, /data-action="saveRegistroHistory"/);
});

test("income lock disables initial fields but leaves operational adjustment editable", () => {
  const state = stateWithActiveLot();
  const computed = calculateState(state);
  const html = incomeScreen(state, computed, {
    role: ROLES.OPERATOR,
    initialDataLocked: true,
  });

  assert.match(html, /Datos iniciales bloqueados/);
  assert.match(tagForAction(html, "updateConfig:clientName:text"), /\bdisabled\b/);
  assert.match(tagForAction(html, "updateLot:lot-1:lotCode:text"), /\bdisabled\b/);
  assert.match(tagForAction(html, "updateLot:lot-1:currentDiet:select"), /\bdisabled\b/);
  assert.doesNotMatch(
    tagForAction(html, "updateLot:lot-1:consumptionAdjustmentPct:percent"),
    /\bdisabled\b/,
  );
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

test("operator keeps feeding actuals and consumption notes editable", () => {
  const state = stateWithActiveLot();
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
    tagForAction(feedingHtml, "updateTreatment:ADAPTACION:1:sharePct:percent"),
    /\bdisabled\b/,
  );
  assert.doesNotMatch(
    tagForAction(feedingHtml, "updateFeedingActual:ADAPTACION:lot-1:1:number"),
    /\bdisabled\b/,
  );
  assert.doesNotMatch(
    tagForAction(consumptionHtml, "updateConsumption:lot-1:msRealizedManual:number"),
    /\bdisabled\b/,
  );
  assert.match(consumptionHtml, /data-action="applyConsumptionFromCalculated"/);
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

  for (const html of [feedingHtml, consumptionHtml, dietHtml, layoutHtml]) {
    assert.doesNotMatch(html, /<button data-action="saveWorkDay">INYECTADO<\/button>/);
    assert.match(html, /&lt;button data-action=&quot;saveWorkDay&quot;&gt;INYECTADO&lt;\/button&gt;/);
  }
});
