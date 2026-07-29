import { formatCurrency, formatNumber } from "../domain/formatters.js?v=20260621-stage1-clean-all";
import { metricGrid, screenHeader, section } from "../components/layout.js?v=20260723-editable-loads-v2";
import { simpleTable } from "../components/table.js?v=20260723-phase-d";
import { escapeHtml } from "../domain/html.js?v=20260723-history-validation";
import {
  canDeleteHistory,
  canEditHistory,
} from "../domain/permissions.js?v=20260727-history-delete-v1";
import { reportScreen } from "./reportScreen.js?v=20260723-report-history-v1";

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

function historyTable(snapshots, filters, deletionContext = {}) {
  const filtered = snapshots.filter((snapshot) => snapshotMatches(snapshot, filters));
  const rows = filtered.map((snapshot) => {
    const summary = snapshot.summary ?? {};
    const snapshotId = escapeHtml(snapshot.id);
    const isDeleting =
      deletionContext.deleteStatus === "deleting" &&
      deletionContext.deletingSnapshotId === snapshot.id;
    const deleteAction = deletionContext.allowed
      ? `
          <button
            type="button"
            class="danger-action"
            data-action="deleteHistorySnapshot:${snapshotId}"
            aria-label="Eliminar registro del ${escapeHtml(summary.workDate ?? "")}"
            title="Eliminar registro"
            ${deletionContext.deleteStatus === "deleting" ? "disabled" : ""}
          >${isDeleting ? "Eliminando..." : "Eliminar"}</button>
        `
      : "";
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
      `
        <div class="history-row-actions">
          <button type="button" class="secondary-action" data-action="openHistorySnapshot:${snapshotId}">Ver registro</button>
          ${deleteAction}
        </div>
      `,
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

export function historyScreen(historyState, permissionContext = {}) {
  const historyEditable = canEditHistory(permissionContext.role);
  const historyDeletable = canDeleteHistory(permissionContext.role);
  const selectedActions = historyState.selectedSnapshot
    ? `
        ${
          historyEditable && !historyState.isEditing
            ? '<button type="button" class="primary-action" data-action="startHistoryCorrection">Corregir registro</button>'
            : ""
        }
        ${
          historyEditable && historyState.isEditing
            ? `
                <button type="button" class="primary-action" data-action="saveHistoryCorrection" ${historyState.saveStatus === "saving" ? "disabled" : ""}>Guardar corrección</button>
                <button type="button" class="secondary-action" data-action="cancelHistoryCorrection">Cancelar corrección</button>
              `
            : ""
        }
        <button type="button" class="secondary-action" data-action="closeHistorySnapshot">Volver al día actual</button>
      `
    : "";
  const header = screenHeader({
    eyebrow: "Modulo HISTORIAL",
    title: "Historial de registros",
    description: "Consulta de dias guardados como fotografia historica de REGISTRO.",
    actions: `
      <button type="button" class="primary-action" data-action="loadHistory">Actualizar historial</button>
      ${selectedActions}
    `,
  });

  if (historyState.selectedSnapshot) {
    const snapshot = historyState.selectedSnapshot;
    const computed =
      historyState.isEditing && historyState.draftComputedState
        ? historyState.draftComputedState
        : snapshot.computed_state ?? { reportRows: [] };
    const summary = snapshot.summary ?? {};
    const bannerTitle = historyState.isEditing
      ? "Corrección administrativa"
      : "Vista histórica - Solo consulta";
    return `
      ${header}
      <div class="history-banner">
        <strong>${bannerTitle}</strong>
        <span>${escapeHtml(summary.workDate ?? "")} · ${escapeHtml(formatDateTime(snapshot.saved_at))}</span>
      </div>
      ${historyState.message ? `<div class="history-message">${escapeHtml(historyState.message)}</div>` : ""}
      ${reportScreen(computed, {
        workDate: summary.workDate,
        editable: historyEditable && historyState.isEditing,
        actionPrefix: "updateHistoricalReport",
        rowId: (_row, index) => index,
        resetAction: false,
      })}
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
    ${section(
      "Dias guardados",
      historyTable(historyState.snapshots, historyState.filters, {
        allowed: historyDeletable,
        deleteStatus: historyState.deleteStatus,
        deletingSnapshotId: historyState.deletingSnapshotId,
      }),
    )}
  `;
}
