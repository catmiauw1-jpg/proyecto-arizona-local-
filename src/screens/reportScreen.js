import { formatCurrency, formatNumber, formatPercent } from "../domain/formatters.js?v=20260621-stage1-clean-all";
import { metricGrid, screenHeader, section } from "../components/layout.js?v=20260621-stage1-clean-all";
import { simpleTable } from "../components/table.js?v=20260621-stage1-clean-all";

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
    row.pen,
    row.currentDiet,
    row.lotCode,
    row.animalCount,
    formatNumber(row.estimatedWeight),
    formatNumber(row.cmoLot),
    formatNumber(row.cmoAnimal),
    formatNumber(row.cmsLot),
    formatNumber(row.cmsAnimal),
    formatPercent(row.imsPct),
    formatCurrency(row.nutritionalCostAnimal),
    formatCurrency(row.nutritionalCostLot),
  ]);

  const table = simpleTable(
    [
      "Corral",
      "Tipo dieta",
      "Lote",
      "Cabezas",
      "PV estimado",
      "CMO lote",
      "CMO animal",
      "CMS lote",
      "CMS animal",
      "IMS %PV",
      "Costo/animal",
      "Costo lote",
    ],
    rows,
  );

  return `
    ${header}
    ${metrics}
    ${section("Registro calculado", table)}
  `;
}






