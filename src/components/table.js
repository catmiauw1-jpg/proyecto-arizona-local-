import { calculatedCell, valueInput } from "./fields.js";

export function dataTable({ columns, rows, rowId, actionPrefix, compact = false }) {
  return `
    <div class="table-wrap ${compact ? "compact" : ""}">
      <table>
        <thead>
          <tr>
            ${columns
              .map(
                (column) => `
                  <th class="${column.input ? "input-head" : column.role === "locked" ? "locked-head" : "calc-head"}">
                    ${column.label}
                  </th>
                `,
              )
              .join("")}
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `
                <tr>
                  ${columns
                    .map((column) => {
                      const value = row[column.key];
                      if (!column.input) {
                      const cellClass = column.role === "locked" ? "locked-cell" : "calc-cell";
                      return `<td class="${cellClass}">${calculatedCell(value, column.type)}</td>`;
                      }
                      return `
                        <td class="input-cell">
                          ${valueInput({
                            value,
                            type: column.type,
                            options: column.options ?? [],
                            onInput: `${actionPrefix}:${rowId(row)}:${column.key}:${column.type}`,
                          })}
                        </td>
                      `;
                    })
                    .join("")}
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

export function simpleTable(headers, rows, { compact = false } = {}) {
  return `
    <div class="table-wrap ${compact ? "compact" : ""}">
      <table>
        <thead>
          <tr>${headers.map((header) => `<th>${header}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}
        </tbody>
      </table>
    </div>
  `;
}
