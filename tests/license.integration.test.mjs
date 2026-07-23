import assert from "node:assert/strict";
import test from "node:test";

import {
  LICENSE_STATUSES,
  LOCAL_LICENSE_SCENARIOS,
  buildLocalTestLicense,
} from "../src/domain/license.js";
import {
  ROLES,
  canEditDiet,
  canEditFeedingActuals,
  canSaveHistory,
  canSaveWorkDay,
  resolveOperationalRole,
} from "../src/domain/permissions.js";
import {
  LICENSE_STORAGE_KEY,
  loadStoredLicense,
  saveStoredLicense,
} from "../src/state/licenseStore.js";
import {
  changeLocalLicenseScenario,
  getLicenseEvaluation,
  getLocalLicenseScenario,
  initializeLocalLicense,
  resetLicenseRuntime,
} from "../src/services/localLicenseService.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    snapshot() {
      return Object.fromEntries(values);
    },
  };
}

test("license validation precedes role and lock permissions", () => {
  const validAdmin = resolveOperationalRole(ROLES.ADMIN, LICENSE_STATUSES.ACTIVE);
  const expiringOperator = resolveOperationalRole(ROLES.OPERATOR, LICENSE_STATUSES.EXPIRING);

  assert.equal(canEditDiet(validAdmin, false), true);
  assert.equal(canSaveHistory(validAdmin), true);
  assert.equal(canEditFeedingActuals(expiringOperator), true);
  assert.equal(canSaveWorkDay(expiringOperator), true);

  for (const status of [
    LICENSE_STATUSES.EXPIRED,
    LICENSE_STATUSES.BLOCKED,
    LICENSE_STATUSES.UNCONFIGURED,
  ]) {
    const blockedAdmin = resolveOperationalRole(ROLES.ADMIN, status);
    assert.equal(blockedAdmin, null);
    assert.equal(canEditDiet(blockedAdmin, false), false);
    assert.equal(canEditFeedingActuals(blockedAdmin), false);
    assert.equal(canSaveWorkDay(blockedAdmin), false);
    assert.equal(canSaveHistory(blockedAdmin), false);
  }
});

test("license storage is separate and preserves an explicit unconfigured state", () => {
  const storage = memoryStorage();
  const operationalBefore = {
    lots: [{ id: "lot-1", lotCode: "NO-MODIFICAR" }],
    histories: [{ id: "history-1" }],
  };
  const activeLicense = buildLocalTestLicense(LOCAL_LICENSE_SCENARIOS.ACTIVE, {
    currentDate: "2026-07-23",
    clientName: "Confinamiento Arizona",
  });

  assert.deepEqual(loadStoredLicense(storage), { exists: false, license: null });
  saveStoredLicense(activeLicense, storage);
  assert.deepEqual(loadStoredLicense(storage), { exists: true, license: activeLicense });
  assert.equal(Object.keys(storage.snapshot()).includes(LICENSE_STORAGE_KEY), true);
  assert.deepEqual(operationalBefore, {
    lots: [{ id: "lot-1", lotCode: "NO-MODIFICAR" }],
    histories: [{ id: "history-1" }],
  });

  saveStoredLicense(null, storage);
  assert.deepEqual(loadStoredLicense(storage), { exists: true, license: null });
});

test("corrupt local license data fails closed without throwing", () => {
  const storage = memoryStorage();
  storage.setItem(LICENSE_STORAGE_KEY, "{not-json");

  assert.deepEqual(loadStoredLicense(storage), { exists: true, license: null });
});

test("local license runtime initializes, persists and changes only through the local test tool", () => {
  const storage = memoryStorage();
  resetLicenseRuntime();

  initializeLocalLicense({
    clientName: "Confinamiento Arizona",
    currentDate: "2026-07-23",
    localToolEnabled: true,
    storage,
  });
  assert.equal(getLicenseEvaluation("2026-07-23").status, LICENSE_STATUSES.ACTIVE);
  assert.equal(getLocalLicenseScenario("2026-07-23"), LOCAL_LICENSE_SCENARIOS.ACTIVE);

  assert.equal(
    changeLocalLicenseScenario(LOCAL_LICENSE_SCENARIOS.EXPIRED, {
      clientName: "Confinamiento Arizona",
      currentDate: "2026-07-23",
      localToolEnabled: false,
      storage,
    }).changed,
    false,
  );
  assert.equal(getLicenseEvaluation("2026-07-23").status, LICENSE_STATUSES.ACTIVE);

  const changed = changeLocalLicenseScenario(LOCAL_LICENSE_SCENARIOS.EXPIRED, {
    clientName: "Confinamiento Arizona",
    currentDate: "2026-07-23",
    localToolEnabled: true,
    storage,
  });
  assert.equal(changed.changed, true);
  assert.equal(changed.evaluation.status, LICENSE_STATUSES.EXPIRED);

  resetLicenseRuntime();
  initializeLocalLicense({
    clientName: "Otro cliente",
    currentDate: "2026-07-23",
    localToolEnabled: true,
    storage,
  });
  assert.equal(getLicenseEvaluation("2026-07-23").status, LICENSE_STATUSES.EXPIRED);
});

test("runtime preserves last validation and blocks a backwards clock", () => {
  const storage = memoryStorage();
  const license = buildLocalTestLicense(LOCAL_LICENSE_SCENARIOS.ACTIVE, {
    currentDate: "2026-07-23",
    clientName: "Confinamiento Arizona",
  });
  saveStoredLicense({ ...license, lastValidationDate: "2026-07-25" }, storage);
  resetLicenseRuntime();

  initializeLocalLicense({
    clientName: "Confinamiento Arizona",
    currentDate: "2026-07-24",
    localToolEnabled: true,
    storage,
  });

  assert.equal(getLicenseEvaluation("2026-07-24").status, LICENSE_STATUSES.BLOCKED);
  assert.equal(loadStoredLicense(storage).license.lastValidationDate, "2026-07-25");
});
