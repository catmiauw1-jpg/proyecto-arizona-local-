import { formatNumber, round } from "../domain/formatters.js";
import { formulaNote, metricGrid, screenHeader, section } from "../components/layout.js";
import { simpleTable } from "../components/table.js";

function inputNumber(value) {
  return round(value, 2).toFixed(2);
}

export function consumptionScreen(computed) {
  const totalExpectedMs = computed.consumptionRows.reduce((total, row) => total + row.expectedMs, 0);
  const totalRealizedMs = computed.consumptionRows.reduce((total, row) => total + row.realizedMs, 0);
  const totalExpectedMo = computed.consumptionRows.reduce((total, row) => total + row.expectedMo, 0);
  const totalRealizedMo = computed.consumptionRows.reduce((total, row) => total + row.realizedMo, 0);

  const header = screenHeader({
    eyebrow: "Hoja ANOTACION DE CONSUMO",
    title: "Anotacion de consumo",
    description: "Consolida previsto/realizado y permite capturar ajustes manuales por piquete.",
    actions: `
      <button
        class="primary-action"
        type="button"
        data-action="applyConsumptionFromCalculated"
        title="Replica Macro3: copia C3:F22 y pega valores en H3:K22"
      >
        Copiar calculados a amarillos
      </button>
    `,
  });

  const metrics = metricGrid([
    { label: "Previsto MS", value: formatNumber(totalExpectedMs) },
    { label: "Realizado MS", value: formatNumber(totalRealizedMs) },
    { label: "Previsto MO", value: formatNumber(totalExpectedMo) },
    { label: "Realizado MO", value: formatNumber(totalRealizedMo) },
  ]);

  const rows = computed.consumptionRows.map((row) => [
    row.pen,
    row.currentDiet,
    formatNumber(row.expectedMs),
    formatNumber(row.realizedMs),
    formatNumber(row.expectedMo),
    formatNumber(row.realizedMo),
    `<input type="number" step="0.01" value="${inputNumber(row.msPlannedManual)}" data-action="updateConsumption:${row.lotId}:msPlannedManual:number" />`,
    `<input type="number" step="0.01" value="${inputNumber(row.msRealizedManual)}" data-action="updateConsumption:${row.lotId}:msRealizedManual:number" />`,
    `<input type="number" step="0.01" value="${inputNumber(row.moPlannedManual)}" data-action="updateConsumption:${row.lotId}:moPlannedManual:number" />`,
    `<input type="number" step="0.01" value="${inputNumber(row.moRealizedManual)}" data-action="updateConsumption:${row.lotId}:moRealizedManual:number" />`,
  ]);

  const table = simpleTable(
    [
      "Corral",
      "Dieta actual",
      "Previsto MS",
      "Realizado MS",
      "Previsto MO",
      "Realizado MO",
      "MS previsto",
      "MS realizado",
      "MO previsto",
      "MO realizado",
    ],
    rows,
  );

  return `
    ${header}
    ${formulaNote({
      status: "exact",
      title: "Flecha del Excel",
      text: "La macro Macro3 copia los valores de C3:F22 y los pega en H3:K22. El boton replica esa accion sobre las columnas amarillas editables.",
    })}
    ${metrics}
    ${section("Consumo por piquete", table)}
  `;
}
