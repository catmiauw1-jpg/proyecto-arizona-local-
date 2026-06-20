import { SHEETS } from "../domain/model.js?v=20260620-inputs2";

export function appLayout({ activeSheet, content }) {
  return `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-mark">CA</div>
          <div>
            <strong>Confinamiento Arizona</strong>
            <span>Version Excel a programa</span>
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
      </aside>
      <main class="workspace">
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

