import { calculatedCell, valueInput } from "./fields.js?v=20260723-phase-d";

export function dataTable({
  columns,
  rows,
  rowId,
  actionPrefix,
  compact = false,
  isEditable = () => true,
}) {
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
                      return `<td class="${cellClass}" data-label="${column.label}">${calculatedCell(value, column.type)}</td>`;
                      }
                      const editable = isEditable({ column, row });
                      return `
                        <td class="input-cell ${editable ? "" : "disabled-input-cell"}" data-label="${column.label}">
                          ${valueInput({
                            value,
                            type: column.type,
                            options: column.options ?? [],
                            onInput: `${actionPrefix}:${rowId(row)}:${column.key}:${column.type}`,
                            disabled: !editable,
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





