import {
  formatCurrency,
  formatInteger,
  formatNumber,
  formatPercent,
  toNumber,
} from "../domain/formatters.js?v=20260621-stage1-clean-all";
import { metricGrid, screenHeader, section } from "../components/layout.js?v=20260723-editable-loads-v2";
import { dataTable, simpleTable } from "../components/table.js?v=20260724-video-fixes-v1";
import { escapeHtml } from "../domain/html.js?v=20260723-history-validation";
import { calculateReportPeriod } from "../domain/reportHistory.js?v=20260723-report-history-v1";

const EDITABLE_REPORT_COLUMNS = [
  { key: "pen", label: "CORRAL", input: true, type: "text" },
  { key: "currentDiet", label: "TIPO DIETA", input: true, type: "text" },
  { key: "dietName", label: "NOMBRE DIETA", input: true, type: "text" },
  { key: "lotCode", label: "LOTE", input: true, type: "text" },
  { key: "animalCount", label: "CANTIDAD ANIMALES", input: true, type: "integer" },
  { key: "estimatedWeight", label: "PV ESTIMADO", input: true, type: "number" },
  { key: "cmoLot", label: "CMO LOTE", input: true, type: "number" },
  { key: "cmoAnimal", label: "CMO ANIMAL", input: true, type: "number" },
  { key: "cmsLot", label: "CMS LOTE", input: true, type: "number" },
  { key: "cmsAnimal", label: "CMS ANIMAL", input: true, type: "number" },
  { key: "imsPct", label: "IMS (%PV)", input: true, type: "percentInput" },
  {
    key: "nutritionalCostAnimal",
    label: "COSTO/NUTRICIONAL/ANIMAL",
    input: true,
    type: "currency",
  },
];

function currentReportTable(rows, context = {}) {
  if (context.editable) {
    const editableRows = rows.map((row, index) => ({
      ...row,
      reportRowId: context.rowId?.(row, index) ?? row.lotId ?? index,
    }));
    return dataTable({
      columns: EDITABLE_REPORT_COLUMNS,
      rows: editableRows,
      rowId: (row) => row.reportRowId,
      actionPrefix: context.actionPrefix ?? "updateReportOverride",
    });
  }

  return simpleTable(
    [
      "CORRAL",
      "TIPO DIETA",
      "NOMBRE DIETA",
      "LOTE",
      "CANTIDAD ANIMALES",
      "PV ESTIMADO",
      "CMO LOTE",
      "CMO ANIMAL",
      "CMS LOTE",
      "CMS ANIMAL",
      "IMS (%PV)",
      "COSTO/NUTRICIONAL/ANIMAL",
    ],
    rows.map((row) => [
      escapeHtml(row.pen),
      escapeHtml(row.currentDiet),
      escapeHtml(row.dietName),
      escapeHtml(row.lotCode),
      formatInteger(row.animalCount),
      formatNumber(row.estimatedWeight),
      formatNumber(row.cmoLot),
      formatNumber(row.cmoAnimal),
      formatNumber(row.cmsLot),
      formatNumber(row.cmsAnimal),
      formatPercent(row.imsPct),
      formatCurrency(row.nutritionalCostAnimal),
    ]),
  );
}

function averageReportTable(rows) {
  return simpleTable(
    [
      "CORRAL",
      "JORNADAS",
      "ANIMALES PROM.",
      "PV PROM.",
      "CMO LOTE PROM.",
      "CMO ANIMAL PROM.",
      "CMS LOTE PROM.",
      "CMS ANIMAL PROM.",
      "IMS PROM.",
      "COSTO/ANIMAL PROM.",
      "COSTO LOTE PROM.",
    ],
    rows.map((row) => [
      escapeHtml(row.pen),
      row.periodDays,
      formatNumber(row.average.animalCount),
      formatNumber(row.average.estimatedWeight),
      formatNumber(row.average.cmoLot),
      formatNumber(row.average.cmoAnimal),
      formatNumber(row.average.cmsLot),
      formatNumber(row.average.cmsAnimal),
      formatPercent(row.average.imsPct),
      formatCurrency(row.average.nutritionalCostAnimal),
      formatCurrency(row.average.nutritionalCostLot),
    ]),
  );
}

function totalReportTable(rows) {
  return simpleTable(
    [
      "CORRAL",
      "JORNADAS",
      "PV TOTAL REFERENCIAL",
      "CMO LOTE ACUM.",
      "CMO ANIMAL ACUM.",
      "CMS LOTE ACUM.",
      "CMS ANIMAL ACUM.",
      "COSTO/ANIMAL ACUM.",
      "COSTO LOTE ACUM.",
    ],
    rows.map((row) => [
      escapeHtml(row.pen),
      row.periodDays,
      formatNumber(row.total.estimatedLiveWeight),
      formatNumber(row.total.cmoLot),
      formatNumber(row.total.cmoAnimal),
      formatNumber(row.total.cmsLot),
      formatNumber(row.total.cmsAnimal),
      formatCurrency(row.total.nutritionalCostAnimal),
      formatCurrency(row.total.nutritionalCostLot),
    ]),
  );
}

function periodLabel(workDates, workDate) {
  if (!workDates.length) return workDate || "Día actual";
  if (workDates.length === 1) return workDates[0];
  return `${workDates[0]} a ${workDates.at(-1)}`;
}

function reportActions(reportContext) {
  const actions = [];

  if (reportContext.editable && reportContext.resetAction !== false) {
    actions.push(
      '<button type="button" class="secondary-action" data-action="clearReportOverrides">Restablecer cálculos</button>',
    );
  }
  if (reportContext.canSaveWorkDay === true) {
    const disabled = reportContext.saveStatus === "saving" ? "disabled" : "";
    actions.push(
      `<button type="button" class="secondary-action" data-action="saveWorkDay" ${disabled}>Guardar avance</button>`,
    );
  }
  if (reportContext.canCloseWorkDay === true) {
    const disabled = reportContext.closeStatus === "saving" ? "disabled" : "";
    actions.push(
      `<button type="button" class="primary-action" data-action="closeWorkDay" ${disabled}>Cerrar y guardar día</button>`,
    );
  }

  return actions.join("");
}

export function reportScreen(computed, reportContext = {}) {
  const period = calculateReportPeriod(
    computed.reportRows,
    reportContext.snapshots,
    reportContext.workDate,
  );
  const totalAnimals = computed.reportRows.reduce(
    (total, row) => total + toNumber(row.animalCount),
    0,
  );
  const avgIms =
    computed.reportRows.reduce(
      (total, row) => total + toNumber(row.imsPct),
      0,
    ) /
    Math.max(computed.reportRows.length, 1);
  const reportDate =
    reportContext.workDate || period.workDates.at(-1) || "Día actual";
  const rangeLabel = periodLabel(period.workDates, reportContext.workDate);

  const header = screenHeader({
    eyebrow: "Módulo REGISTRO",
    title: "Informe financiero nutricional",
    description: "Resultados diarios, promedios y acumulados calculados por corral.",
    actions: reportActions(reportContext),
  });

  const metrics = metricGrid([
    { label: "Fecha del informe", value: escapeHtml(reportDate) },
    { label: "Jornadas incluidas", value: period.dayCount },
    {
      label: "Costo nutricional del día",
      value: formatCurrency(period.currentTotalCost),
    },
    {
      label: "Costo acumulado",
      value: formatCurrency(period.periodTotalCost),
    },
    { label: "Animales actuales", value: totalAnimals },
    { label: "IMS promedio del día", value: formatPercent(avgIms) },
  ]);

  const loadingMessage =
    reportContext.historyStatus === "loading"
      ? '<div class="history-message">Cargando jornadas guardadas para calcular el período...</div>'
      : "";

  return `
    ${header}
    ${metrics}
    ${loadingMessage}
    ${section(
      `Registro del día ${reportDate}`,
      currentReportTable(computed.reportRows, reportContext),
    )}
    ${section(
      "FINANCIERO PROMEDIO",
      averageReportTable(period.rows),
      `<span>${escapeHtml(rangeLabel)}</span>`,
    )}
    ${section(
      "FINANCIERO TOTAL",
      totalReportTable(period.rows),
      `<span>${period.dayCount} jornada${period.dayCount === 1 ? "" : "s"}</span>`,
    )}
  `;
}
