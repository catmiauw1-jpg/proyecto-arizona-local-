import { SHEETS } from "../domain/model.js?v=20260723-phase-e";

import {
  LICENSE_STATUSES,
  LOCAL_LICENSE_SCENARIOS,
} from "../domain/license.js?v=20260723-phase-e";
import {
  ROLES,
  canViewDietConfiguration,
  roleLabel,
} from "../domain/permissions.js?v=20260727-history-delete-v1";
import { escapeHtml } from "../domain/html.js?v=20260723-history-validation";

function localDevelopmentTool(roleContext) {
  if (!roleContext?.localToolEnabled) return "";

  return `
    <div class="local-role-tool" role="region" aria-label="Herramienta local de prueba">
      <strong>Herramienta local de prueba</strong>
      <label>
        <span>Rol activo</span>
        <select data-action="setLocalRole">
          <option value="${ROLES.ADMIN}" ${roleContext.role === ROLES.ADMIN ? "selected" : ""}>
            ${roleLabel(ROLES.ADMIN)}
          </option>
          <option value="${ROLES.OPERATOR}" ${roleContext.role === ROLES.OPERATOR ? "selected" : ""}>
            ${roleLabel(ROLES.OPERATOR)}
          </option>
        </select>
      </label>
      <label>
        <span>Escenario de licencia</span>
        <select data-action="setLocalLicenseScenario">
          <option value="${LOCAL_LICENSE_SCENARIOS.ACTIVE}" ${roleContext.licenseScenario === LOCAL_LICENSE_SCENARIOS.ACTIVE ? "selected" : ""}>Activa</option>
          <option value="${LOCAL_LICENSE_SCENARIOS.EXPIRING}" ${roleContext.licenseScenario === LOCAL_LICENSE_SCENARIOS.EXPIRING ? "selected" : ""}>Próxima a vencer</option>
          <option value="${LOCAL_LICENSE_SCENARIOS.EXPIRED}" ${roleContext.licenseScenario === LOCAL_LICENSE_SCENARIOS.EXPIRED ? "selected" : ""}>Vencida</option>
          <option value="${LOCAL_LICENSE_SCENARIOS.BLOCKED}" ${roleContext.licenseScenario === LOCAL_LICENSE_SCENARIOS.BLOCKED ? "selected" : ""}>Bloqueada</option>
          <option value="${LOCAL_LICENSE_SCENARIOS.UNCONFIGURED}" ${roleContext.licenseScenario === LOCAL_LICENSE_SCENARIOS.UNCONFIGURED ? "selected" : ""}>No configurada</option>
        </select>
      </label>
      <span>No forma parte de la interfaz final.</span>
    </div>
  `;
}

function licenseNotice(licenseContext, activeSheet) {
  if (!licenseContext?.message) return "";

  const expiring = licenseContext.status === LICENSE_STATUSES.EXPIRING;
  const title = expiring ? "Licencia próxima a vencer" : `Licencia ${licenseContext.status.toLowerCase()}`;
  return `
    <div class="license-notice ${expiring ? "is-warning" : "is-blocked"}" role="status">
      <div>
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(licenseContext.message)}</span>
      </div>
      ${activeSheet === "LICENCIA" ? "" : '<a class="secondary-action" href="#/LICENCIA">Ver licencia</a>'}
    </div>
  `;
}

function workDayFeedback(workDayContext) {
  const message = workDayContext?.message;
  if (
    !message ||
    message === "Día recuperado correctamente." ||
    message === "Día activo iniciado sin datos guardados."
  ) {
    return "";
  }

  return `<div class="work-day-feedback" role="status">${escapeHtml(message)}</div>`;
}

export function appLayout({
  activeSheet,
  content,
  workDayContext = null,
  roleContext = null,
  licenseContext = null,
}) {
  const visibleSheets = SHEETS.filter(
    (sheet) =>
      sheet.kind !== "diet" || canViewDietConfiguration(roleContext?.role),
  );

  return `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-mark">
            <img src="./src/assets/logo-arizona.png" alt="Logo Confinamiento Arizona" />
          </div>
          <div>
            <strong>Confinamiento Arizona</strong>
            <span>Sistema de gestion</span>
          </div>
        </div>
        <nav class="nav-list">
          ${visibleSheets.map(
            (sheet) => `
              <a href="#/${encodeURIComponent(sheet.id)}" class="${activeSheet === sheet.id ? "active" : ""}">
                ${sheet.label}
              </a>
            `,
          ).join("")}
        </nav>
      </aside>
      <main class="workspace">
        ${localDevelopmentTool(roleContext)}
        ${licenseNotice(licenseContext, activeSheet)}
        ${workDayFeedback(workDayContext)}
        ${content}
      </main>
    </div>
  `;
}

export function screenHeader({ title, eyebrow, description, actions = "" }) {
  return `
    <header class="screen-header">
      <div>
        <span class="eyebrow">${escapeHtml(eyebrow)}</span>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(description)}</p>
      </div>
      <div class="screen-actions">${actions}</div>
    </header>
  `;
}

export function section(title, content, aside = "") {
  return `
    <section class="section">
      <div class="section-title">
        <h2>${escapeHtml(title)}</h2>
        ${aside ? `<div>${aside}</div>` : ""}
      </div>
      ${content}
    </section>
  `;
}

export function metricGrid(metrics) {
  return `
    <div class="metric-grid">
      ${metrics
        .map(
          (metric) => `
            <div class="metric">
              <span>${escapeHtml(metric.label)}</span>
              <strong>${metric.value}</strong>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

export function formulaNote({ status = "pending", title, text }) {
  return `
    <div class="formula-note ${status}">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(text)}</span>
    </div>
  `;
}

export function statusPill(status) {
  const ok = status === "Correcto";
  return `<span class="status-pill ${ok ? "ok" : "warn"}">${escapeHtml(status)}</span>`;
}






