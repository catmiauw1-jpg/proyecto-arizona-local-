export function toNumber(value, fallback = 0) {
  let normalizedValue = value;
  if (typeof value === "string") {
    normalizedValue = value.trim().replace(/\s/g, "");
    const lastComma = normalizedValue.lastIndexOf(",");
    const lastDot = normalizedValue.lastIndexOf(".");

    if (lastComma >= 0 && lastDot >= 0) {
      normalizedValue =
        lastComma > lastDot
          ? normalizedValue.replace(/\./g, "").replace(",", ".")
          : normalizedValue.replace(/,/g, "");
    } else {
      normalizedValue = normalizedValue.replace(",", ".");
    }
  }
  const number = Number(normalizedValue);
  return Number.isFinite(number) ? number : fallback;
}

export function round(value, decimals = 2) {
  const number = toNumber(value);
  const factor = 10 ** decimals;
  return Math.round((number + Number.EPSILON) * factor) / factor;
}

export function formatNumber(value, decimals = 2) {
  return new Intl.NumberFormat("es-BO", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(toNumber(value));
}

export function formatInteger(value) {
  return new Intl.NumberFormat("es-BO", {
    maximumFractionDigits: 0,
  }).format(toNumber(value));
}

export function formatPercent(value, decimals = 2) {
  return new Intl.NumberFormat("es-BO", {
    style: "percent",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(toNumber(value));
}

export function formatCurrency(value) {
  return `Bs ${formatNumber(value, 2)}`;
}

export function formatCell(value, type) {
  if (value === null || value === undefined || value === "") return "";
  if (type === "percent") return formatPercent(value);
  if (type === "currency") return formatCurrency(value);
  if (type === "integer") return formatInteger(value);
  if (type === "number") return formatNumber(value);
  return String(value);
}

export function dateDiffInDays(toDate, fromDate) {
  const end = new Date(`${toDate}T00:00:00`);
  const start = new Date(`${fromDate}T00:00:00`);
  if (Number.isNaN(end.getTime()) || Number.isNaN(start.getTime())) return 0;
  return Math.round((end - start) / 86400000);
}

