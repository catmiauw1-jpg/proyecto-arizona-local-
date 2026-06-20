import { DIET_LABELS } from "../domain/model.js";
import { formatCell, toNumber } from "../domain/formatters.js";

export function valueInput({ value, type = "text", onInput, options = [] }) {
  if (type === "select") {
    return `
      <select data-action="${onInput}">
        ${options
          .map((option) => `<option value="${option}" ${option === value ? "selected" : ""}>${option}</option>`)
          .join("")}
      </select>
    `;
  }

  const isNumeric = ["number", "percent", "currency", "integer"].includes(type);
  const inputType = type === "date" ? "date" : "text";
  const step = type === "percent" ? "0.001" : type === "number" || type === "currency" ? "0.01" : "1";
  const shownValue = type === "percent" ? toNumber(value) : value;

  return `
    <input
      type="${inputType}"
      step="${step}"
      ${isNumeric ? 'inputmode="decimal"' : ""}
      value="${shownValue ?? ""}"
      data-action="${onInput}"
    />
  `;
}

export function calculatedCell(value, type) {
  return `<span class="calculated-value">${formatCell(value, type)}</span>`;
}

export function dietSelect(value, action) {
  return valueInput({ value, type: "select", onInput: action, options: DIET_LABELS });
}




