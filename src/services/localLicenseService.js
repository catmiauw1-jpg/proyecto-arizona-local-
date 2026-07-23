import {
  LICENSE_STATUSES,
  LOCAL_LICENSE_SCENARIOS,
  buildLocalTestLicense,
  evaluateLicense,
  getCurrentLicenseDate,
} from "../domain/license.js";
import { loadStoredLicense, saveStoredLicense } from "../state/licenseStore.js";

const SCENARIOS_BY_STATUS = Object.freeze({
  [LICENSE_STATUSES.ACTIVE]: LOCAL_LICENSE_SCENARIOS.ACTIVE,
  [LICENSE_STATUSES.EXPIRING]: LOCAL_LICENSE_SCENARIOS.EXPIRING,
  [LICENSE_STATUSES.EXPIRED]: LOCAL_LICENSE_SCENARIOS.EXPIRED,
  [LICENSE_STATUSES.BLOCKED]: LOCAL_LICENSE_SCENARIOS.BLOCKED,
  [LICENSE_STATUSES.UNCONFIGURED]: LOCAL_LICENSE_SCENARIOS.UNCONFIGURED,
});
const LOCAL_SCENARIO_VALUES = new Set(Object.values(LOCAL_LICENSE_SCENARIOS));

let licenseRecord = null;
let initialized = false;

export function initializeLocalLicense({
  clientName,
  currentDate = getCurrentLicenseDate(),
  localToolEnabled,
  storage,
}) {
  if (initialized) return getLicenseEvaluation(currentDate);

  const stored = loadStoredLicense(storage);
  licenseRecord = stored.license;
  if (!stored.exists && localToolEnabled) {
    licenseRecord = buildLocalTestLicense(LOCAL_LICENSE_SCENARIOS.ACTIVE, {
      currentDate,
      clientName,
    });
  } else if (
    [LICENSE_STATUSES.ACTIVE, LICENSE_STATUSES.EXPIRING, LICENSE_STATUSES.EXPIRED].includes(
      evaluateLicense(licenseRecord, currentDate).status,
    )
  ) {
    licenseRecord = { ...licenseRecord, lastValidationDate: currentDate };
  }

  if (!stored.exists || licenseRecord) saveStoredLicense(licenseRecord, storage);
  initialized = true;
  return getLicenseEvaluation(currentDate);
}

export function getLicenseEvaluation(currentDate = getCurrentLicenseDate()) {
  return evaluateLicense(licenseRecord, currentDate);
}

export function licenseAllowsOperations(currentDate = getCurrentLicenseDate()) {
  return getLicenseEvaluation(currentDate).operationalAccess;
}

export function getLocalLicenseScenario(currentDate = getCurrentLicenseDate()) {
  return SCENARIOS_BY_STATUS[getLicenseEvaluation(currentDate).status];
}

export function changeLocalLicenseScenario(
  scenario,
  {
    clientName,
    currentDate = getCurrentLicenseDate(),
    localToolEnabled,
    storage,
  },
) {
  if (!localToolEnabled || !LOCAL_SCENARIO_VALUES.has(scenario)) {
    return { changed: false, evaluation: getLicenseEvaluation(currentDate) };
  }

  licenseRecord = buildLocalTestLicense(scenario, { currentDate, clientName });
  saveStoredLicense(licenseRecord, storage);
  initialized = true;
  return { changed: true, evaluation: getLicenseEvaluation(currentDate) };
}

export function resetLicenseRuntime() {
  licenseRecord = null;
  initialized = false;
}
