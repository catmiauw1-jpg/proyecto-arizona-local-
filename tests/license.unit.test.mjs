import assert from "node:assert/strict";
import test from "node:test";

import {
  LICENSE_STATUSES,
  LOCAL_LICENSE_SCENARIOS,
  buildLocalTestLicense,
  calculateExpirationDate,
  canAccessOperationalModules,
  evaluateLicense,
  getLicenseMessage,
  getLicenseStatus,
  getRemainingDays,
  shouldShowExpirationWarning,
} from "../src/domain/license.js";

test("calculates the expiration date as 30 complete calendar days", () => {
  assert.equal(calculateExpirationDate("2026-08-01"), "2026-08-31");
  assert.equal(calculateExpirationDate("2026-12-15"), "2027-01-14");
  assert.equal(calculateExpirationDate("2028-02-01"), "2028-03-02");
  assert.throws(() => calculateExpirationDate("2026-02-30"), RangeError);
});

test("compares date-only values without browser timezone offsets", () => {
  const expirationDate = "2026-08-31";

  assert.equal(getRemainingDays(expirationDate, "2026-08-30"), 1);
  assert.equal(getRemainingDays(expirationDate, "2026-08-31"), 0);
  assert.equal(getRemainingDays(expirationDate, "2026-09-01"), -1);
  assert.equal(
    getRemainingDays(expirationDate, new Date("2026-08-31T23:59:59.999-04:00")),
    0,
  );
});

test("resolves every license status at its exact date boundary", () => {
  const license = {
    activationDate: "2026-08-01",
    expirationDate: "2026-08-31",
    clientName: "Cliente Arizona",
    licenseId: "LIC-001",
    lastValidationDate: "2026-08-20",
    blocked: false,
  };

  assert.equal(getLicenseStatus(license, "2026-08-23"), LICENSE_STATUSES.ACTIVE);
  assert.equal(getLicenseStatus(license, "2026-08-24"), LICENSE_STATUSES.EXPIRING);
  assert.equal(getLicenseStatus(license, "2026-08-31"), LICENSE_STATUSES.EXPIRING);
  assert.equal(getLicenseStatus(license, "2026-09-01"), LICENSE_STATUSES.EXPIRED);
  assert.equal(getLicenseStatus({ ...license, blocked: true }, "2026-08-20"), LICENSE_STATUSES.BLOCKED);
  assert.equal(getLicenseStatus(null, "2026-08-20"), LICENSE_STATUSES.UNCONFIGURED);
  assert.equal(getLicenseStatus({ activationDate: "invalid" }, "2026-08-20"), LICENSE_STATUSES.UNCONFIGURED);
});

test("fails closed before activation and when the local clock moves backwards", () => {
  const license = {
    activationDate: "2026-08-01",
    expirationDate: "2026-08-31",
    clientName: "Cliente Arizona",
    licenseId: "LIC-002",
    lastValidationDate: "2026-08-20",
    blocked: false,
  };

  assert.equal(getLicenseStatus(license, "2026-07-31"), LICENSE_STATUSES.UNCONFIGURED);
  assert.equal(getLicenseStatus(license, "2026-08-19"), LICENSE_STATUSES.BLOCKED);
  assert.equal(getLicenseStatus(license, "2026-08-20"), LICENSE_STATUSES.ACTIVE);
});

test("allows operations only for active and expiring licenses", () => {
  assert.equal(canAccessOperationalModules(LICENSE_STATUSES.ACTIVE), true);
  assert.equal(canAccessOperationalModules(LICENSE_STATUSES.EXPIRING), true);
  assert.equal(canAccessOperationalModules(LICENSE_STATUSES.EXPIRED), false);
  assert.equal(canAccessOperationalModules(LICENSE_STATUSES.BLOCKED), false);
  assert.equal(canAccessOperationalModules(LICENSE_STATUSES.UNCONFIGURED), false);
});

test("returns the required warning messages", () => {
  assert.equal(shouldShowExpirationWarning(8), false);
  assert.equal(shouldShowExpirationWarning(7), true);
  assert.equal(shouldShowExpirationWarning(0), true);
  assert.equal(shouldShowExpirationWarning(-1), false);
  assert.equal(
    getLicenseMessage(LICENSE_STATUSES.EXPIRING, 7),
    "La licencia vencerá en 7 días.",
  );
  assert.equal(
    getLicenseMessage(LICENSE_STATUSES.EXPIRING, 3),
    "La licencia está próxima a vencer.",
  );
  assert.equal(getLicenseMessage(LICENSE_STATUSES.EXPIRING, 1), "La licencia vence mañana.");
  assert.equal(getLicenseMessage(LICENSE_STATUSES.EXPIRING, 0), "La licencia vence hoy.");
  assert.equal(
    getLicenseMessage(LICENSE_STATUSES.EXPIRED, -1),
    "Licencia vencida. Contacte al administrador.",
  );
  assert.equal(
    getLicenseMessage(LICENSE_STATUSES.BLOCKED, 20),
    "Licencia bloqueada. Contacte al administrador.",
  );
  assert.equal(
    getLicenseMessage(LICENSE_STATUSES.UNCONFIGURED, null),
    "Licencia no configurada. Contacte al administrador.",
  );
});

test("builds isolated local scenarios and evaluates their display data", () => {
  const currentDate = "2026-07-23";
  const expectedStatuses = new Map([
    [LOCAL_LICENSE_SCENARIOS.ACTIVE, LICENSE_STATUSES.ACTIVE],
    [LOCAL_LICENSE_SCENARIOS.EXPIRING, LICENSE_STATUSES.EXPIRING],
    [LOCAL_LICENSE_SCENARIOS.EXPIRED, LICENSE_STATUSES.EXPIRED],
    [LOCAL_LICENSE_SCENARIOS.BLOCKED, LICENSE_STATUSES.BLOCKED],
    [LOCAL_LICENSE_SCENARIOS.UNCONFIGURED, LICENSE_STATUSES.UNCONFIGURED],
  ]);

  for (const [scenario, expectedStatus] of expectedStatuses) {
    const license = buildLocalTestLicense(scenario, {
      currentDate,
      clientName: "Confinamiento Arizona",
    });
    const evaluation = evaluateLicense(license, currentDate);
    assert.equal(evaluation.status, expectedStatus);
    assert.equal(evaluation.clientName, scenario === LOCAL_LICENSE_SCENARIOS.UNCONFIGURED ? "" : "Confinamiento Arizona");
    assert.equal(evaluation.lastValidationDate, scenario === LOCAL_LICENSE_SCENARIOS.UNCONFIGURED ? "" : currentDate);
  }

  const expiring = evaluateLicense(
    buildLocalTestLicense(LOCAL_LICENSE_SCENARIOS.EXPIRING, {
      currentDate,
      clientName: "Confinamiento Arizona",
    }),
    currentDate,
  );
  assert.equal(expiring.remainingDays, 3);
});
