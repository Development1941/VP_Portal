import type { FinanceCapacityRow } from "@/lib/finance/types";

export const CAPACITY_UNIT_OPTIONS = [
  "MT",
  "MTPA",
  "KL",
  "KLPA",
  "MW",
  "MWPA",
  "Units",
  "Units / year",
  "Sq ft",
  "Beds",
  "Other",
] as const;

export function emptyCapacityRow(id = `cap_${Math.random().toString(36).slice(2, 9)}`): FinanceCapacityRow {
  return { id, product: "", capacity: "", unit: "MT" };
}

export function summarizeCapacityRows(rows: FinanceCapacityRow[]) {
  const filled = rows.filter((row) => row.product.trim() || row.capacity.trim() || row.unit.trim());
  return {
    products: filled.map((row) => row.product.trim()).filter(Boolean).join(", "),
    capacities: filled
      .map((row) => {
        const parts = [row.product.trim(), row.capacity.trim(), row.unit.trim()].filter(Boolean);
        return parts.join(" · ");
      })
      .filter(Boolean)
      .join("; "),
  };
}

/** Best-effort migration when only legacy free-text products / capacities exist. */
export function capacityRowsFromLegacy(products: string, capacities: string): FinanceCapacityRow[] {
  const productParts = products
    .split(/[,;|/]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const capacityParts = capacities
    .split(/[;|]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (!productParts.length && !capacityParts.length) return [emptyCapacityRow()];

  if (productParts.length) {
    return productParts.map((product, index) => {
      const capacityHint = capacityParts[index] || capacityParts[0] || "";
      const match = capacityHint.match(/^(.+?)\s+([\d.,]+)\s*([A-Za-z/%]+)?$/);
      if (match && !productParts[index]) {
        return {
          id: `cap_legacy_${index}`,
          product: match[1].trim(),
          capacity: match[2].trim(),
          unit: (match[3] || "MT").trim(),
        };
      }
      const unitMatch = capacityHint.match(/([\d.,]+)\s*([A-Za-z/%]+)?/);
      return {
        id: `cap_legacy_${index}`,
        product,
        capacity: unitMatch?.[1] || capacityHint.replace(product, "").trim(),
        unit: unitMatch?.[2] || "MT",
      };
    });
  }

  return capacityParts.map((part, index) => {
    const match = part.match(/^(.+?)\s*[·:-]\s*([\d.,]+)\s*([A-Za-z/%]+)?$/) || part.match(/^(.+?)\s+([\d.,]+)\s*([A-Za-z/%]+)?$/);
    if (match) {
      return {
        id: `cap_legacy_${index}`,
        product: match[1].trim(),
        capacity: match[2].trim(),
        unit: (match[3] || "MT").trim(),
      };
    }
    return { id: `cap_legacy_${index}`, product: part, capacity: "", unit: "MT" };
  });
}

export function capacityRowsFromForm(form: FormData): FinanceCapacityRow[] {
  const count = Math.max(0, Number(form.get("cap_count") || 0));
  const rows: FinanceCapacityRow[] = [];
  for (let index = 0; index < count; index += 1) {
    const product = String(form.get(`cap_product_${index}`) ?? "").trim();
    const capacity = String(form.get(`cap_capacity_${index}`) ?? "").trim();
    const unit = String(form.get(`cap_unit_${index}`) ?? "").trim();
    if (!product && !capacity && !unit) continue;
    rows.push({
      id: String(form.get(`cap_id_${index}`) ?? `cap_${index}`),
      product,
      capacity,
      unit: unit || "MT",
    });
  }
  return rows.length ? rows : [emptyCapacityRow()];
}

export function normalizeCapacityRows(rows: FinanceCapacityRow[] | undefined | null): FinanceCapacityRow[] {
  if (!rows?.length) return [emptyCapacityRow()];
  return rows.map((row, index) => ({
    id: row.id || `cap_${index}`,
    product: row.product || "",
    capacity: row.capacity || "",
    unit: row.unit || "MT",
  }));
}
