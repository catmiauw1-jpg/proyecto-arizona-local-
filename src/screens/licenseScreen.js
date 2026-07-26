import { LICENSE_STATUSES } from "../domain/license.js?v=20260723-phase-e";
import { escapeHtml } from "../domain/html.js?v=20260723-history-validation";
import { metricGrid, screenHeader, section } from "../components/layout.js?v=20260723-editable-loads-v2";

function displayValue(value, fallback = "No disponible") {
  const normalized = String(value ?? "").trim();
  return escapeHtml(normalized || fallback);
}

function remainingDaysValue(remainingDays) {
  if (!Number.isFinite(remainingDays)) return "No disponible";
  return String(Math.max(0, remainingDays));
}

function renewalPanel(license) {
  if (license.operationalAccess) return "";

  const reason =
    license.status === LICENSE_STATUSES.BLOCKED
      ? "La licencia fue bloqueada y requiere revisión administrativa."
      : license.status === LICENSE_STATUSES.UNCONFIGURED
        ? "No existe una licencia válida configurada en este equipo."
        : "La licencia llegó al final de su periodo de uso.";

  return section(
    "Renovación de licencia",
    `
      <div class="license-contact">
        <strong>${escapeHtml(reason)}</strong>
        <p>Contacte al administrador para configurar o renovar la licencia local.</p>
      </div>
    `,
  );
}

export function licenseScreen(license) {
  const header = screenHeader({
    eyebrow: "Control local",
    title: "Licencia",
    description: "Estado y vigencia de la licencia asociada a este equipo.",
  });
  const metrics = metricGrid([
    { label: "Cliente", value: displayValue(license.clientName) },
    { label: "Estado", value: displayValue(license.status) },
    { label: "Días restantes", value: remainingDaysValue(license.remainingDays) },
  ]);
  const details = `
    <dl class="license-details">
      <div>
        <dt>Fecha de activación</dt>
        <dd>${displayValue(license.activationDate)}</dd>
      </div>
      <div>
        <dt>Fecha de vencimiento</dt>
        <dd>${displayValue(license.expirationDate)}</dd>
      </div>
      <div>
        <dt>Identificador de licencia</dt>
        <dd>${displayValue(license.licenseId)}</dd>
      </div>
      <div>
        <dt>Última validación</dt>
        <dd>${displayValue(license.lastValidationDate)}</dd>
      </div>
    </dl>
  `;

  return `
    ${header}
    <div class="license-status-panel ${license.operationalAccess ? "is-valid" : "is-blocked"}">
      <span>Estado actual</span>
      <strong>${displayValue(license.status)}</strong>
      ${license.message ? `<p>${escapeHtml(license.message)}</p>` : ""}
    </div>
    ${metrics}
    ${section("Datos de licencia", details)}
    ${renewalPanel(license)}
  `;
}
