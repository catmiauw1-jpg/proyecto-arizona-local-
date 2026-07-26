import assert from "node:assert/strict";
import test from "node:test";

import { appLayout } from "../src/components/layout.js";
import { LICENSE_STATUSES } from "../src/domain/license.js";
import { ROLES } from "../src/domain/permissions.js";
import { licenseScreen } from "../src/screens/licenseScreen.js";

const licenseEvaluation = {
  clientName: "Confinamiento Arizona",
  status: LICENSE_STATUSES.EXPIRING,
  activationDate: "2026-07-01",
  expirationDate: "2026-07-31",
  remainingDays: 3,
  licenseId: "LIC-LOCAL-001",
  lastValidationDate: "2026-07-28",
  message: "La licencia está próxima a vencer.",
  operationalAccess: true,
};

test("license screen shows all required fields and escapes stored content", () => {
  const html = licenseScreen({
    ...licenseEvaluation,
    clientName: '<button data-action="saveWorkDay">Cliente</button>',
  });

  for (const label of [
    "Cliente",
    "Estado",
    "Fecha de activación",
    "Fecha de vencimiento",
    "Días restantes",
    "Identificador de licencia",
    "Última validación",
  ]) {
    assert.match(html, new RegExp(label));
  }
  assert.match(html, /Próxima a vencer/);
  assert.match(html, /LIC-LOCAL-001/);
  assert.doesNotMatch(html, /<button data-action="saveWorkDay">Cliente<\/button>/);
});

test("local layout exposes license scenarios and a visible warning", () => {
  const html = appLayout({
    activeSheet: "LICENCIA",
    content: licenseScreen(licenseEvaluation),
    sessionContext: {
      user: { email: "local@example.test" },
      client: { name: "Confinamiento Arizona" },
    },
    roleContext: {
      role: ROLES.ADMIN,
      localToolEnabled: true,
      licenseScenario: "expiring",
    },
    licenseContext: licenseEvaluation,
  });

  assert.match(html, /data-action="setLocalLicenseScenario"/);
  assert.match(html, /Licencia próxima a vencer/);
  assert.match(html, /La licencia está próxima a vencer/);
  assert.match(html, /No forma parte de la interfaz final/);
});

test("invalid license keeps data visible but removes every operational action", () => {
  const html = appLayout({
    activeSheet: "Ingreso",
    content: '<input value="DATO EXISTENTE" disabled aria-disabled="true" />',
    sessionContext: {
      user: { email: "local@example.test" },
      client: { name: "Confinamiento Arizona" },
    },
    workDayContext: {
      workDay: { work_date: "2026-07-20" },
      permissions: {
        canSaveWorkDay: false,
        canSaveHistory: false,
      },
    },
    licenseContext: {
      ...licenseEvaluation,
      status: LICENSE_STATUSES.EXPIRED,
      remainingDays: -1,
      operationalAccess: false,
      message: "Licencia vencida. Contacte al administrador.",
    },
  });

  assert.match(html, /DATO EXISTENTE/);
  assert.match(html, /Licencia vencida/);
  assert.doesNotMatch(html, /data-action="saveWorkDay"/);
  assert.doesNotMatch(html, /data-action="saveRegistroHistory"/);
  assert.doesNotMatch(html, /data-action="closeWorkDay"/);
  assert.doesNotMatch(html, /session-card|authSignOut|Cerrar sesion/);
});
