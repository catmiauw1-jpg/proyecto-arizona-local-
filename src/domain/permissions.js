export const ROLES = Object.freeze({
  ADMIN: "admin_arizona",
  OPERATOR: "operator",
});

export const ACCESS_CONTROL_VERSION = 1;
export const DIET_IDS = Object.freeze(["ADAPTACION", "TRANSICION", "TERMINACION"]);
export const INITIAL_DATA_FIELDS = Object.freeze([
  "entryDate",
  "pen",
  "lotCode",
  "animalCount",
  "initialWeight",
  "currentDiet",
]);

const ROLE_ALIASES = new Map([
  ["admin", ROLES.ADMIN],
  ["administrator", ROLES.ADMIN],
  ["administrador", ROLES.ADMIN],
  ["administrador arizona", ROLES.ADMIN],
  [ROLES.ADMIN, ROLES.ADMIN],
  ["operador", ROLES.OPERATOR],
  [ROLES.OPERATOR, ROLES.OPERATOR],
]);
const INITIAL_DATA_FIELD_SET = new Set(INITIAL_DATA_FIELDS);

export function normalizeRole(role) {
  if (typeof role !== "string") return null;
  return ROLE_ALIASES.get(role.trim().toLowerCase()) ?? null;
}

export function roleLabel(role) {
  const normalizedRole = normalizeRole(role);
  if (normalizedRole === ROLES.ADMIN) return "Administrador Arizona";
  if (normalizedRole === ROLES.OPERATOR) return "Operador";
  return "Sin permisos";
}

export function isLocalDevelopmentHost(hostname) {
  return ["localhost", "127.0.0.1", "::1"].includes(String(hostname ?? "").toLowerCase());
}

function isAdministrator(role) {
  return normalizeRole(role) === ROLES.ADMIN;
}

function isAuthorizedRole(role) {
  return normalizeRole(role) !== null;
}

export function createDefaultAccessControl() {
  return {
    version: ACCESS_CONTROL_VERSION,
    initialDataLocked: false,
    dietLocks: Object.fromEntries(DIET_IDS.map((dietId) => [dietId, false])),
  };
}

export function canEditIncomeConfig(role) {
  return isAdministrator(role);
}

export function canEditDiet(role, dietLocked) {
  return isAdministrator(role) && dietLocked !== true;
}

export function canLockDiet(role, dietLocked) {
  return isAdministrator(role) && dietLocked !== true;
}

export function canUnlockDiet(role, dietLocked) {
  return isAdministrator(role) && dietLocked === true;
}

export function canEditTreatmentConfig(role, dietLocked) {
  return canEditDiet(role, dietLocked);
}

export function canEditInitialData(role, initialDataLocked) {
  return isAuthorizedRole(role) && initialDataLocked !== true;
}

export function canLockInitialData(role, initialDataLocked) {
  return isAdministrator(role) && initialDataLocked !== true;
}

export function canUnlockInitialData(role, initialDataLocked) {
  return isAdministrator(role) && initialDataLocked === true;
}

export function canEditLotField(role, initialDataLocked, field) {
  if (INITIAL_DATA_FIELD_SET.has(field)) {
    return canEditInitialData(role, initialDataLocked);
  }
  if (field === "consumptionAdjustmentPct") {
    return isAuthorizedRole(role);
  }
  return false;
}

export function canEditFeedingActuals(role) {
  return isAuthorizedRole(role);
}

export function canEditConsumptionNotes(role) {
  return isAuthorizedRole(role);
}

export function canSaveWorkDay(role) {
  return isAuthorizedRole(role);
}

export function canSaveHistory(role) {
  return isAdministrator(role);
}

export function canViewHistory(role) {
  return isAuthorizedRole(role);
}

export function canEditHistory() {
  return false;
}
