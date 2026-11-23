"use client";

import { CAPACITY_UNIT_OPTIONS, emptyCapacityRow } from "@/lib/finance/capacity";
import type { FinanceCapacityRow } from "@/lib/finance/types";

export function CapacityGrid({
  rows,
  onChange,
  canAddRows = true,
  readOnly = false,
}: {
  rows: FinanceCapacityRow[];
  onChange: (rows: FinanceCapacityRow[]) => void;
  canAddRows?: boolean;
  readOnly?: boolean;
}) {
  function patch(index: number, key: keyof FinanceCapacityRow, value: string) {
    onChange(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, [key]: value } : row)));
  }

  function addRow() {
    onChange([...rows, emptyCapacityRow()]);
  }

  function removeRow(index: number) {
    if (rows.length <= 1) {
      onChange([emptyCapacityRow()]);
      return;
    }
    onChange(rows.filter((_, rowIndex) => rowIndex !== index));
  }

  return (
    <div className="capacity-grid">
      <input type="hidden" name="cap_count" value={rows.length} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Capacity</th>
              <th>Unit</th>
              {!readOnly ? <th aria-label="Row actions" /> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id}>
                <td>
                  <input type="hidden" name={`cap_id_${index}`} value={row.id} />
                  <input
                    name={`cap_product_${index}`}
                    value={row.product}
                    onChange={(event) => patch(index, "product", event.target.value)}
                    placeholder="Product / SKU"
                    readOnly={readOnly}
                  />
                </td>
                <td>
                  <input
                    name={`cap_capacity_${index}`}
                    value={row.capacity}
                    onChange={(event) => patch(index, "capacity", event.target.value)}
                    placeholder="e.g. 12000"
                    readOnly={readOnly}
                  />
                </td>
                <td>
                  {readOnly ? (
                    <input name={`cap_unit_${index}`} value={row.unit} readOnly />
                  ) : (
                    <select name={`cap_unit_${index}`} value={row.unit || "MT"} onChange={(event) => patch(index, "unit", event.target.value)}>
                      {CAPACITY_UNIT_OPTIONS.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                      {row.unit && !CAPACITY_UNIT_OPTIONS.includes(row.unit as (typeof CAPACITY_UNIT_OPTIONS)[number]) ? (
                        <option value={row.unit}>{row.unit}</option>
                      ) : null}
                    </select>
                  )}
                </td>
                {!readOnly ? (
                  <td>
                    <button type="button" className="btn ghost compact" onClick={() => removeRow(index)} disabled={rows.length <= 1}>
                      Remove
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canAddRows && !readOnly ? (
        <button type="button" className="btn ghost" onClick={addRow}>
          Add product row
        </button>
      ) : null}
    </div>
  );
}
