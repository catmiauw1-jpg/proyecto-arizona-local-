export const LICENSE_STATUSES = Object.freeze({
  ACTIVE: "Activa",
  EXPIRING: "Próxima a vencer",
  EXPIRED: "Vencida",
  BLOCKED: "Bloqueada",
  UNCONFIGURED: "No configurada",
});

export const LOCAL_LICENSE_SCENARIOS = Object.freeze({
  ACTIVE: "active",
  EXPIRING: "expiring",
  EXPIRED: "expired",
  BLOCKED: "blocked",
  UNCONFIGURED: "unconfigured",
});

export const LICENSE_DURATION_DAYS = 30;
export const LICENSE_TIME_ZONE = "America/La_Paz";

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

function datePartsInTimeZone(date, timeZone = LICENSE_TIME_ZONE) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new RangeError("Fecha de licencia inválida.");
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function parseDateOnly(value) {
  const dateValue = value instanceof Date ? datePartsInTimeZone(value) : String(value ?? "");
  const match = DATE_ONLY_PATTERN.exec(dateValue);
  if (!match) throw new RangeError("Fecha de licencia inválida.");

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new RangeError("Fecha de licencia inválida.");
  }

  return { dateValue, timestamp };
}

function addCalendarDays(dateValue, days) {
  const { timestamp } = parseDateOnly(dateValue);
  return new Date(timestamp + days * MILLISECONDS_PER_DAY).toISOString().slice(0, 10);
}

function isConfiguredLicense(license) {
  if (!license || typeof license !== "object") return false;
  if (!String(license.clientName ?? "").trim() || !String(license.licenseId ?? "").trim()) return false;

  try {
    const expectedExpiration = calculateExpirationDate(license.activationDate);
    parseDateOnly(license.lastValidationDate);
    return expectedExpiration === license.expirationDate;
  } catch {
    return false;
  }
}

export function getCurrentLicenseDate(now = new Date()) {
  return datePartsInTimeZone(now);
}

export function calculateExpirationDate(activationDate) {
  return addCalendarDays(activationDate, LICENSE_DURATION_DAYS);
}

export function getRemainingDays(expirationDate, currentDate = getCurrentLicenseDate()) {
  const expiration = parseDateOnly(expirationDate).timestamp;
  const current = parseDateOnly(currentDate).timestamp;
  return Math.round((expiration - current) / MILLISECONDS_PER_DAY);
}

export function getLicenseStatus(license, currentDate = getCurrentLicenseDate()) {
  if (!isConfiguredLicense(license)) return LICENSE_STATUSES.UNCONFIGURED;
  if (license.blocked === true) return LICENSE_STATUSES.BLOCKED;

  const currentTimestamp = parseDateOnly(currentDate).timestamp;
  const activationTimestamp = parseDateOnly(license.activationDate).timestamp;
  const lastValidationTimestamp = parseDateOnly(license.lastValidationDate).timestamp;
  if (currentTimestamp < activationTimestamp) return LICENSE_STATUSES.UNCONFIGURED;
  if (currentTimestamp < lastValidationTimestamp) return LICENSE_STATUSES.BLOCKED;

  const remainingDays = getRemainingDays(license.expirationDate, currentDate);
  if (remainingDays < 0) return LICENSE_STATUSES.EXPIRED;
  if (remainingDays <= 7) return LICENSE_STATUSES.EXPIRING;
  return LICENSE_STATUSES.ACTIVE;
}

export function canAccessOperationalModules(licenseStatus) {
  return [LICENSE_STATUSES.ACTIVE, LICENSE_STATUSES.EXPIRING].includes(licenseStatus);
}

export function shouldShowExpirationWarning(remainingDays) {
  return Number.isInteger(remainingDays) && remainingDays >= 0 && remainingDays <= 7;
}

export function getLicenseMessage(licenseStatus, remainingDays) {
  if (licenseStatus === LICENSE_STATUSES.EXPIRED) {
    return "Licencia vencida. Contacte al administrador.";
  }
  if (licenseStatus === LICENSE_STATUSES.BLOCKED) {
    return "Licencia bloqueada. Contacte al administrador.";
  }
  if (licenseStatus === LICENSE_STATUSES.UNCONFIGURED) {
    return "Licencia no configurada. Contacte al administrador.";
  }
  if (licenseStatus !== LICENSE_STATUSES.EXPIRING || !shouldShowExpirationWarning(remainingDays)) {
    return "";
  }
  if (remainingDays === 7) return "La licencia vencerá en 7 días.";
  if (remainingDays === 3) return "La licencia está próxima a vencer.";
  if (remainingDays === 1) return "La licencia vence mañana.";
  if (remainingDays === 0) return "La licencia vence hoy.";
  return `La licencia vencerá en ${remainingDays} días.`;
}

export function evaluateLicense(license, currentDate = getCurrentLicenseDate()) {
  const status = getLicenseStatus(license, currentDate);
  const configured = status !== LICENSE_STATUSES.UNCONFIGURED;
  const remainingDays = configured ? getRemainingDays(license.expirationDate, currentDate) : null;

  return {
    clientName: configured ? String(license.clientName) : "",
    status,
    activationDate: configured ? license.activationDate : "",
    expirationDate: configured ? license.expirationDate : "",
    remainingDays,
    licenseId: configured ? String(license.licenseId) : "",
    lastValidationDate: configured ? license.lastValidationDate : "",
    message: getLicenseMessage(status, remainingDays),
    operationalAccess: canAccessOperationalModules(status),
  };
}

export function buildLocalTestLicense(
  scenario,
  { currentDate = getCurrentLicenseDate(), clientName = "Confinamiento Arizona" } = {},
) {
  parseDateOnly(currentDate);
  if (scenario === LOCAL_LICENSE_SCENARIOS.UNCONFIGURED) return null;

  const expirationOffsets = {
    [LOCAL_LICENSE_SCENARIOS.ACTIVE]: LICENSE_DURATION_DAYS,
    [LOCAL_LICENSE_SCENARIOS.EXPIRING]: 3,
    [LOCAL_LICENSE_SCENARIOS.EXPIRED]: -1,
    [LOCAL_LICENSE_SCENARIOS.BLOCKED]: LICENSE_DURATION_DAYS,
  };
  if (!Object.hasOwn(expirationOffsets, scenario)) {
    throw new RangeError("Escenario local de licencia inválido.");
  }

  const expirationDate = addCalendarDays(currentDate, expirationOffsets[scenario]);
  const activationDate = addCalendarDays(expirationDate, -LICENSE_DURATION_DAYS);
  return {
    activationDate,
    expirationDate,
    blocked: scenario === LOCAL_LICENSE_SCENARIOS.BLOCKED,
    clientName: String(clientName ?? "").trim() || "Confinamiento Arizona",
    licenseId: `LOCAL-${scenario.toUpperCase()}-${activationDate.replaceAll("-", "")}`,
    lastValidationDate: currentDate,
  };
}
