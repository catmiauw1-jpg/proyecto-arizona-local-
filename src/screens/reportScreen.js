import { formatCurrency, formatNumber, formatPercent } from "../domain/formatters.js?v=20260621-stage1-clean-all";
import { metricGrid, screenHeader, section } from "../components/layout.js?v=20260723-phase-e";
import { simpleTable } from "../components/table.js?v=20260723-phase-d";
import { escapeHtml } from "../domain/html.js?v=20260723-history-validation";

export function reportScreen(computed) {
  const totalCost = computed.reportRows.reduce((total, row) => total + row.nutritionalCostLot, 0);
  const totalAnimals = computed.reportRows.reduce((total, row) => total + Number(row.animalCount || 0), 0);
  const avgIms =
    computed.reportRows.reduce((total, row) => total + row.imsPct, 0) /
    Math.max(computed.reportRows.length, 1);

  const header = screenHeader({
    eyebrow: "Modulo REGISTRO",
    title: "Informe financiero nutricional",
    description: "Resumen calculado por corral con resultados nutricionales y financieros.",
  });

  const metrics = metricGrid([
    { label: "Costo nutricional total", value: formatCurrency(totalCost) },
    { label: "Animales", value: totalAnimals },
    { label: "IMS promedio", value: formatPercent(avgIms) },
    { label: "Corrales", value: computed.reportRows.length },
  ]);

  const rows = computed.reportRows.map((row) => [
    escapeHtml(row.pen),
    escapeHtml(row.currentDiet),
    escapeHtml(row.dietName),
    escapeHtml(row.lotCode),
    row.animalCount,
    formatNumber(row.estimatedWeight),
    formatNumber(row.cmoLot),
    formatNumber(row.cmoAnimal),
    formatNumber(row.cmsLot),
    formatNumber(row.cmsAnimal),
    formatPercent(row.imsPct),
    formatCurrency(row.nutritionalCostAnimal),
    formatCurrency(row.financialAverage),
    formatCurrency(row.financialTotal),
  ]);

  const table = simpleTable(
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
      "FINANCIERO PROMEDIO",
      "FINANCIERO TOTAL",
    ],
    rows,
  );

  return `
    ${header}
    ${metrics}
    ${section("Registro calculado", table)}
  `;
}






