export const SHEETS = [
  { id: "ADAPT", label: "ADAPT", kind: "diet", dietId: "ADAPTACION" },
  { id: "TRANS", label: "TRANS", kind: "diet", dietId: "TRANSICION" },
  { id: "TERM", label: "TERM", kind: "diet", dietId: "TERMINACION" },
  { id: "Ingreso", label: "Ingreso", kind: "income" },
  { id: "ADAPTACION", label: "ADAPTACION", kind: "feeding", dietId: "ADAPTACION" },
  { id: "TRANSICION", label: "TRANSICION", kind: "feeding", dietId: "TRANSICION" },
  { id: "TERMINACION", label: "TERMINACION", kind: "feeding", dietId: "TERMINACION" },
  { id: "ANOTACION DE CONSUMO", label: "ANOTACION DE CONSUMO", kind: "consumption" },
  { id: "REGISTRO", label: "REGISTRO", kind: "report" },
];

export const DIET_SHEETS = {
  ADAPT: "ADAPTACION",
  TRANS: "TRANSICION",
  TERM: "TERMINACION",
};

export const DIET_LABELS = ["ADAPTACION", "TRANSICION", "TERMINACION"];

export const INGREDIENT_COLUMNS = [
  { key: "name", label: "Insumo", type: "text", input: true },
  { key: "dryMatterPct", label: "%MS", type: "percent", input: true },
  { key: "inclusionMsPct", label: "% inclusion MS", type: "percent", input: true },
  { key: "inclusionMoPct", label: "% inclusion MO", type: "percent", input: false },
  { key: "normalizedMoPct", label: "% inclusion M.O", type: "percent", input: false },
  { key: "dietDryMatterPct", label: "%MS dieta", type: "percent", input: false },
  { key: "costBsTon", label: "Costo Bs/ton", type: "currency", input: true },
  { key: "costContributionBsTon", label: "Costo Bs/ton", type: "currency", input: false },
];

export const LOT_COLUMNS = [
  { key: "entryDate", label: "Fecha ingreso", input: true, type: "date" },
  { key: "pen", label: "Piquete", input: true, type: "text" },
  { key: "lotCode", label: "Lote", input: true, type: "number" },
  { key: "animalCount", label: "Cantidad animales", input: true, type: "number" },
  { key: "initialWeight", label: "Peso inicial", input: false, role: "locked", type: "number" },
  { key: "estimatedWeight", label: "Peso estimado", input: false, type: "number" },
  { key: "initialImsPct", label: "IMS %PV inicial", input: false, role: "locked", type: "percent" },
  { key: "estimatedGmd", label: "GMD estimado", input: false, role: "locked", type: "number" },
  { key: "initialCmsKg", label: "CMS kg inicial", input: false, type: "number" },
  { key: "daysInConfinement", label: "Dias confinamiento", input: false, type: "integer" },
  { key: "currentDiet", label: "Dieta actual", input: true, type: "select" },
  { key: "totalFeedMs", label: "Total alimento MS", input: false, type: "number" },
  { key: "totalFeedMo", label: "Total alimento MO", input: false, type: "number" },
  { key: "consumptionAdjustmentPct", label: "Ajuste consumo", input: true, type: "percent" },
  { key: "cmsPerAnimal", label: "CMS/animal", input: false, type: "number" },
  { key: "cmoPerAnimal", label: "CMO/animal", input: false, type: "number" },
  { key: "cmsPctAnimal", label: "%CMS/animal", input: false, type: "percent" },
];

export const TREATMENTS = [
  { number: 1, timeKey: "time1", shareKey: "share1" },
  { number: 2, timeKey: "time2", shareKey: "share2" },
  { number: 3, timeKey: "time3", shareKey: "share3" },
  { number: 4, timeKey: "time4", shareKey: "share4" },
  { number: 5, timeKey: "time5", shareKey: "share5" },
];
