export const LICENSE_STORAGE_KEY = "__arizona_local_license_v1__";
const LICENSE_STORAGE_VERSION = 1;

function resolveStorage(storage) {
  return storage ?? globalThis.localStorage;
}

function cloneLicense(license) {
  if (license === null) return null;
  if (!license || typeof license !== "object" || Array.isArray(license)) return null;
  return {
    activationDate: license.activationDate,
    expirationDate: license.expirationDate,
    blocked: license.blocked === true,
    clientName: license.clientName,
    licenseId: license.licenseId,
    lastValidationDate: license.lastValidationDate,
  };
}

export function loadStoredLicense(storage) {
  const target = resolveStorage(storage);
  let stored;

  try {
    stored = target.getItem(LICENSE_STORAGE_KEY);
  } catch {
    return { exists: true, license: null };
  }
  if (stored === null) return { exists: false, license: null };

  try {
    const parsed = JSON.parse(stored);
    if (parsed?.version !== LICENSE_STORAGE_VERSION || !Object.hasOwn(parsed, "license")) {
      return { exists: true, license: null };
    }
    return { exists: true, license: cloneLicense(parsed.license) };
  } catch {
    return { exists: true, license: null };
  }
}

export function saveStoredLicense(license, storage) {
  const target = resolveStorage(storage);
  try {
    target.setItem(
      LICENSE_STORAGE_KEY,
      JSON.stringify({
        version: LICENSE_STORAGE_VERSION,
        license: cloneLicense(license),
      }),
    );
    return true;
  } catch {
    return false;
  }
}
