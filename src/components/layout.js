import { SHEETS } from "../domain/model.js?v=20260621-stage1-clean-all";

function formatDateTime(value) {
  if (!value) return "Sin guardar";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin guardar";
  return new Intl.DateTimeFormat("es-BO", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function dayStatusBar(workDayContext) {
  if (!workDayContext?.workDay) return "";

  const statusLabels = {
    ready: "Sin guardar",
    saving: "Guardando...",
    saved: "Guardado",
    error: "Error al guardar",
  };
  const status = statusLabels[workDayContext.saveStatus] ?? "Sin guardar";
  const disabled = workDayContext.saveStatus === "saving" ? "disabled" : "";
  const historyDisabled = workDayContext.historyStatus === "saving" ? "disabled" : "";
  const actions = workDayContext.isHistoryView
    ? '<strong>Solo consulta</strong>'
    : `
      <button type="button" data-action="saveWorkDay" ${disabled}>Guardar día</button>
      <button type="button" class="secondary-action" data-action="saveRegistroHistory" ${historyDisabled}>
        Guardar día en historial
      </button>
    `;

  return `
    <div class="day-status-bar">
      <div>
        <span>Día activo</span>
        <strong>${workDayContext.period?.name ?? "Periodo activo"}</strong>
      </div>
      <div>
        <span>Fecha de trabajo</span>
        <strong>${workDayContext.workDate ?? workDayContext.workDay.work_date ?? ""}</strong>
      </div>
      <div>
        <span>Último guardado</span>
        <strong>${formatDateTime(workDayContext.lastSavedAt)}</strong>
      </div>
      <div>
        <span>Estado</span>
        <strong>${status}</strong>
      </div>
      ${actions}
      ${workDayContext.message ? `<p>${workDayContext.message}</p>` : ""}
    </div>
  `;
}

export function appLayout({ activeSheet, content, sessionContext = null, workDayContext = null }) {
  const userEmail = sessionContext?.user?.email ?? "";
  const clientName = sessionContext?.client?.name ?? "";

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
          ${SHEETS.map(
            (sheet) => `
              <a href="#/${encodeURIComponent(sheet.id)}" class="${activeSheet === sheet.id ? "active" : ""}">
                ${sheet.label}
              </a>
            `,
          ).join("")}
        </nav>
        ${
          sessionContext
            ? `
              <div class="session-card">
                <span>${clientName}</span>
                <strong>${userEmail}</strong>
                <button type="button" data-action="authSignOut">Cerrar sesion</button>
              </div>
            `
            : ""
        }
      </aside>
      <main class="workspace">
        ${dayStatusBar(workDayContext)}
        ${content}
      </main>
    </div>
  `;
}

export function screenHeader({ title, eyebrow, description, actions = "" }) {
  return `
    <header class="screen-header">
      <div>
        <span class="eyebrow">${eyebrow}</span>
        <h1>${title}</h1>
        <p>${description}</p>
      </div>
      <div class="screen-actions">${actions}</div>
    </header>
  `;
}

export function section(title, content, aside = "") {
  return `
    <section class="section">
      <div class="section-title">
        <h2>${title}</h2>
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
              <span>${metric.label}</span>
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
      <strong>${title}</strong>
      <span>${text}</span>
    </div>
  `;
}

export function statusPill(status) {
  const ok = status === "Correcto";
  return `<span class="status-pill ${ok ? "ok" : "warn"}">${status}</span>`;
}






