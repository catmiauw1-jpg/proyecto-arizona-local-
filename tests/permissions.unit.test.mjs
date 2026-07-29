import assert from "node:assert/strict";
import test from "node:test";

import {
  INITIAL_DATA_FIELDS,
  ROLES,
  canEditConsumptionNotes,
  canEditDiet,
  canEditFeedingActuals,
  canEditHistory,
  canEditIncomeConfig,
  canEditInitialData,
  canEditLotField,
  canEditReport,
  canDeleteHistory,
  canEditTreatmentConfig,
  canEditTreatmentIngredientLoads,
  canLockDiet,
  canLockInitialData,
  canSaveHistory,
  canSaveWorkDay,
  canUnlockDiet,
  canUnlockInitialData,
  canViewHistory,
  canViewDietConfiguration,
  isLocalDevelopmentHost,
  normalizeRole,
  roleLabel,
} from "../src/domain/permissions.js";

test("normalizes supported roles and denies unknown values", () => {
  assert.equal(normalizeRole("admin_arizona"), ROLES.ADMIN);
  assert.equal(normalizeRole("admin"), ROLES.ADMIN);
  assert.equal(normalizeRole("administrator"), ROLES.ADMIN);
  assert.equal(normalizeRole("operator"), ROLES.OPERATOR);
  assert.equal(normalizeRole("OPERADOR"), ROLES.OPERATOR);
  assert.equal(normalizeRole("owner"), null);
  assert.equal(normalizeRole(null), null);
  assert.equal(roleLabel(ROLES.ADMIN), "Administrador Arizona");
  assert.equal(roleLabel(ROLES.OPERATOR), "Operador");
  assert.equal(roleLabel("owner"), "Sin permisos");
});

test("enables the temporary selector only for local hosts", () => {
  assert.equal(isLocalDevelopmentHost("localhost"), true);
  assert.equal(isLocalDevelopmentHost("127.0.0.1"), true);
  assert.equal(isLocalDevelopmentHost("::1"), true);
  assert.equal(isLocalDevelopmentHost("app.example.com"), false);
  assert.equal(isLocalDevelopmentHost(""), false);
});

test("administrator controls unlocked diets and their locks", () => {
  assert.equal(canEditDiet(ROLES.ADMIN, false), true);
  assert.equal(canEditDiet(ROLES.ADMIN, true), false);
  assert.equal(canEditTreatmentConfig(ROLES.ADMIN, false), true);
  assert.equal(canEditTreatmentConfig(ROLES.ADMIN, true), false);
  assert.equal(canLockDiet(ROLES.ADMIN, false), true);
  assert.equal(canLockDiet(ROLES.ADMIN, true), false);
  assert.equal(canUnlockDiet(ROLES.ADMIN, true), true);
  assert.equal(canUnlockDiet(ROLES.ADMIN, false), false);
});

test("operator cannot edit diet configuration even while unlocked", () => {
  for (const locked of [false, true]) {
    assert.equal(canEditDiet(ROLES.OPERATOR, locked), false);
    assert.equal(canEditTreatmentConfig(ROLES.OPERATOR, locked), false);
    assert.equal(canEditTreatmentIngredientLoads(ROLES.OPERATOR), false);
    assert.equal(canLockDiet(ROLES.OPERATOR, locked), false);
    assert.equal(canUnlockDiet(ROLES.OPERATOR, locked), false);
  }
});

test("administrator edits initial fields while operator is limited to diet and adjustment", () => {
  assert.deepEqual(
    [...INITIAL_DATA_FIELDS].sort(),
    ["animalCount", "currentDiet", "entryDate", "initialWeight", "lotCode", "pen"].sort(),
  );

  assert.equal(canEditInitialData(ROLES.ADMIN, false), true);
  assert.equal(canEditInitialData(ROLES.ADMIN, true), false);
  for (const field of INITIAL_DATA_FIELDS) {
    assert.equal(canEditLotField(ROLES.ADMIN, false, field), true);
    assert.equal(canEditLotField(ROLES.ADMIN, true, field), false);
  }
  assert.equal(canEditLotField(ROLES.ADMIN, true, "consumptionAdjustmentPct"), true);

  assert.equal(canEditInitialData(ROLES.OPERATOR, false), false);
  for (const field of INITIAL_DATA_FIELDS) {
    assert.equal(
      canEditLotField(ROLES.OPERATOR, false, field),
      field === "currentDiet",
    );
    assert.equal(
      canEditLotField(ROLES.OPERATOR, true, field),
      field === "currentDiet",
    );
  }
  assert.equal(canEditLotField(ROLES.OPERATOR, true, "consumptionAdjustmentPct"), true);

  assert.equal(canEditInitialData("unknown", false), false);
  assert.equal(canEditLotField("unknown", false, "pen"), false);
  assert.equal(canEditLotField(ROLES.ADMIN, false, "unsupported"), false);
});

test("only administrator edits administrative configuration and lock state", () => {
  assert.equal(canEditIncomeConfig(ROLES.ADMIN), true);
  assert.equal(canEditIncomeConfig(ROLES.OPERATOR), false);
  assert.equal(canEditTreatmentIngredientLoads(ROLES.ADMIN), true);
  assert.equal(canEditTreatmentIngredientLoads(ROLES.OPERATOR), false);
  assert.equal(canLockInitialData(ROLES.ADMIN, false), true);
  assert.equal(canLockInitialData(ROLES.ADMIN, true), false);
  assert.equal(canUnlockInitialData(ROLES.ADMIN, true), true);
  assert.equal(canUnlockInitialData(ROLES.ADMIN, false), false);
  assert.equal(canLockInitialData(ROLES.OPERATOR, false), false);
  assert.equal(canUnlockInitialData(ROLES.OPERATOR, true), false);
});

test("both roles can record operations, save and consult history", () => {
  for (const role of [ROLES.ADMIN, ROLES.OPERATOR]) {
    assert.equal(canEditFeedingActuals(role), true);
    assert.equal(canEditConsumptionNotes(role), true);
    assert.equal(canSaveWorkDay(role), true);
    assert.equal(canSaveHistory(role), true);
    assert.equal(canViewHistory(role), true);
  }

  assert.equal(canEditReport(ROLES.ADMIN), true);
  assert.equal(canEditReport(ROLES.OPERATOR), false);
  assert.equal(canEditHistory(ROLES.ADMIN), true);
  assert.equal(canEditHistory(ROLES.OPERATOR), false);
  assert.equal(canDeleteHistory(ROLES.ADMIN), true);
  assert.equal(canDeleteHistory(ROLES.OPERATOR), false);
  assert.equal(canViewDietConfiguration(ROLES.ADMIN), true);
  assert.equal(canViewDietConfiguration(ROLES.OPERATOR), false);
});

test("unknown roles fail closed for every write and history permission", () => {
  const unknownRole = "unknown";
  assert.equal(canEditIncomeConfig(unknownRole), false);
  assert.equal(canEditDiet(unknownRole, false), false);
  assert.equal(canEditInitialData(unknownRole, false), false);
  assert.equal(canEditFeedingActuals(unknownRole), false);
  assert.equal(canEditTreatmentIngredientLoads(unknownRole), false);
  assert.equal(canEditConsumptionNotes(unknownRole), false);
  assert.equal(canSaveWorkDay(unknownRole), false);
  assert.equal(canSaveHistory(unknownRole), false);
  assert.equal(canViewHistory(unknownRole), false);
  assert.equal(canEditHistory(unknownRole), false);
  assert.equal(canDeleteHistory(unknownRole), false);
  assert.equal(canEditReport(unknownRole), false);
  assert.equal(canViewDietConfiguration(unknownRole), false);
});
