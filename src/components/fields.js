import { DIET_LABELS } from "../domain/model.js?v=20260723-phase-e";
import { formatCell, toNumber } from "../domain/formatters.js?v=20260621-stage1-clean-all";
import { escapeHtml } from "../domain/html.js?v=20260723-history-validation";

export function valueInput({
  value,
  type = "text",
  onInput,
  options = [],
  disabled = false,
  calculatedValue,
}) {
  const disabledAttributes = disabled ? 'disabled aria-disabled="true"' : "";
  const calculatedAttribute =
    calculatedValue === undefined
      ? ""
      : `data-calculated-value="${escapeHtml(calculatedValue)}"`;

  if (type === "select") {
    return `
      <select data-action="${escapeHtml(onInput)}" ${disabledAttributes}>
        ${options
          .map(
            (option) =>
              `<option value="${escapeHtml(option)}" ${option === value ? "selected" : ""}>${escapeHtml(option)}</option>`,
          )
          .join("")}
      </select>
    `;
  }

  const isNumeric = [
    "number",
    "percent",
    "percentInteger",
    "percentInput",
    "currency",
    "integer",
  ].includes(type);
  const inputType = type === "date" ? "date" : "text";
  const step =
    type === "percent"
      ? "0.001"
      : ["percentInput", "number", "currency"].includes(type)
        ? "0.01"
        : "1";
  const hasValue = value !== "" && value !== null && value !== undefined;
  const shownValue =
    ["percentInteger", "percentInput"].includes(type) && hasValue
      ? Number((toNumber(value) * 100).toFixed(type === "percentInteger" ? 0 : 4))
      : type === "percent" && hasValue
        ? toNumber(value)
        : value;

  return `
    <input
      type="${inputType}"
      step="${step}"
      ${isNumeric ? `inputmode="${type === "percentInteger" ? "numeric" : "decimal"}"` : ""}
      value="${escapeHtml(shownValue ?? "")}"
      data-action="${escapeHtml(onInput)}"
      ${calculatedAttribute}
      ${disabledAttributes}
    />
  `;
}

export function calculatedCell(value, type) {
  return `<span class="calculated-value">${escapeHtml(formatCell(value, type))}</span>`;
}

export function dietSelect(value, action) {
  return valueInput({ value, type: "select", onInput: action, options: DIET_LABELS });
}










