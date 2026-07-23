import { formatCurrency, formatNumber } from "../domain/formatters.js?v=20260621-stage1-clean-all";
import { metricGrid, screenHeader, section } from "../components/layout.js?v=20260621-stage1-clean-all";
import { simpleTable } from "../components/table.js?v=20260621-stage1-clean-all";
import { escapeHtml } from "../domain/html.js?v=20260723-history-validation";
import { reportScreen } from "./reportScreen.js?v=20260621-stage1-clean-all";

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-BO", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function includesText(value, filter) {
  if (!filter) return true;
  return String(value ?? "").toLowerCase().includes(filter.toLowerCase());
}

function snapshotMatches(snapshot, filters) {
  const summary = snapshot.summary ?? {};
  const rows = summary.reportRows ?? [];
  const dateOk = !filters.date || summary.workDate === filters.date;
  const penOk = !filters.pen || rows.some((row) => includesText(row.pen, filters.pen));
  const lotOk = !filters.lot || rows.some((row) => includesText(row.lotCode, filters.lot));
  const dietOk = !filters.diet || rows.some((row) => includesText(row.currentDiet, filters.diet));
  return dateOk && penOk && lotOk && dietOk;
}

function filterPanel(filters) {
  return `
    <section class="section history-filter">
      <div class="section-title">
        <h2>Filtros</h2>
      </div>
      <div class="form-grid">
        <label>
          <span>Fecha</span>
          <input type="date" value="${escapeHtml(filters.date)}" data-history-filter="date" />
        </label>
        <label>
          <span>Piquete</span>
          <input type="text" value="${escapeHtml(filters.pen)}" data-history-filter="pen" />
        </label>
        <label>
          <span>Lote</span>
          <input type="text" value="${escapeHtml(filters.lot)}" data-history-filter="lot" />
        </label>
        <label>
          <span>Dieta</span>
          <input type="text" value="${escapeHtml(filters.diet)}" data-history-filter="diet" />
        </label>
      </div>
    </section>
  `;
}

function historyTable(snapshots, filters) {
  const filtered = snapshots.filter((snapshot) => snapshotMatches(snapshot, filters));
  const rows = filtered.map((snapshot) => {
    const summary = snapshot.summary ?? {};
    return [
      escapeHtml(summary.workDate ?? ""),
      escapeHtml(formatDateTime(snapshot.saved_at)),
      formatNumber(summary.activePens ?? 0, 0),
      formatNumber(summary.totalAnimals ?? 0, 0),
      formatNumber(summary.totalCmsLot ?? 0),
      formatNumber(summary.totalCmoLot ?? 0),
      formatCurrency(summary.totalNutritionalCost ?? 0),
      escapeHtml(String(snapshot.saved_by ?? "").slice(0, 8)),
      escapeHtml(snapshot.snapshot_type ?? ""),
      `<button type="button" class="secondary-action" data-action="openHistorySnapshot:${escapeHtml(snapshot.id)}">Ver registro</button>`,
    ];
  });

  return simpleTable(
    [
      "Fecha",
      "Hora",
      "Piquetes con datos",
      "Animales",
      "CMS total",
      "CMO total",
      "Costo nutricional total",
      "Usuario",
      "Tipo",
      "Accion",
    ],
    rows,
  );
}

export function historyScreen(historyState) {
  const header = screenHeader({
    eyebrow: "Modulo HISTORIAL",
    title: "Historial de registros",
    description: "Consulta de dias guardados como fotografia historica de REGISTRO.",
    actions: `
      <button type="button" class="primary-action" data-action="loadHistory">Actualizar historial</button>
      ${
        historyState.selectedSnapshot
          ? '<button type="button" class="secondary-action" data-action="closeHistorySnapshot">Volver al dia actual</button>'
          : ""
      }
    `,
  });

  if (historyState.selectedSnapshot) {
    const snapshot = historyState.selectedSnapshot;
    const computed = snapshot.computed_state ?? { reportRows: [] };
    const summary = snapshot.summary ?? {};
    return `
      ${header}
      <div class="history-banner">
        <strong>Vista histórica — Solo consulta</strong>
        <span>${escapeHtml(summary.workDate ?? "")} · ${escapeHtml(formatDateTime(snapshot.saved_at))}</span>
      </div>
      ${reportScreen(computed)}
    `;
  }

  const metrics = metricGrid([
    { label: "Historicos", value: historyState.snapshots.length },
    { label: "Ultima fecha", value: escapeHtml(historyState.snapshots[0]?.summary?.workDate ?? "") },
    { label: "Ultimo guardado", value: formatDateTime(historyState.snapshots[0]?.saved_at) },
    { label: "Estado", value: historyState.status === "loading" ? "Cargando" : "Listo" },
  ]);

  return `
    ${header}
    ${historyState.message ? `<div class="history-message">${escapeHtml(historyState.message)}</div>` : ""}
    ${metrics}
    ${filterPanel(historyState.filters)}
    ${section("Dias guardados", historyTable(historyState.snapshots, historyState.filters))}
  `;
}
