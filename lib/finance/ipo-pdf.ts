/** Lightweight text-PDF extractor for demo (text-layer PDFs only; scanned pages need OCR). */

function decodePdfString(raw: string) {
  return raw
    .replace(/\\n/g, " ")
    .replace(/\\r/g, " ")
    .replace(/\\t/g, " ")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\")
    .replace(/\\(\d{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
}

export function extractPdfText(bytes: Uint8Array) {
  const latin = new TextDecoder("latin1").decode(bytes);
  const chunks: string[] = [];
  const literal = /\((?:\\.|[^\\)])*\)/g;
  let match: RegExpExecArray | null;
  while ((match = literal.exec(latin))) {
    const body = match[0].slice(1, -1);
    const text = decodePdfString(body).trim();
    if (text.length > 1) chunks.push(text);
  }
  const hex = /<([0-9A-Fa-f\s]+)>/g;
  while ((match = hex.exec(latin))) {
    const hexBody = match[1].replace(/\s+/g, "");
    if (hexBody.length < 4 || hexBody.length % 2) continue;
    let out = "";
    for (let i = 0; i < hexBody.length; i += 2) {
      out += String.fromCharCode(parseInt(hexBody.slice(i, i + 2), 16));
    }
    const text = out.replace(/\u0000/g, "").trim();
    if (text.length > 1) chunks.push(text);
  }
  return chunks.join(" ").replace(/\s+/g, " ").trim();
}

function findTriple(text: string, labels: RegExp[]) {
  for (const label of labels) {
    const re = new RegExp(`${label.source}[^0-9\\-]{0,40}(-?\\d+(?:\\.\\d+)?)[^0-9\\-]{0,20}(-?\\d+(?:\\.\\d+)?)[^0-9\\-]{0,20}(-?\\d+(?:\\.\\d+)?)`, "i");
    const match = text.match(re);
    if (match) return [Number(match[1]), Number(match[2]), Number(match[3])] as [number, number, number];
  }
  return null;
}

export function parseHistoricalHints(text: string) {
  const company =
    text.match(/(?:M\/s\.?\s+|Name of the Company[:\s]+)?([A-Z][A-Za-z0-9 &.,'-]{6,60}(?:Limited|Ltd\.?|Private Limited))/i)?.[1]?.trim() ||
    "";
  const year = Number(text.match(/FY\s*(20\d{2})|March\s*31,?\s*(20\d{2})|year\s*ended\s*.*?(20\d{2})/i)?.[1] || text.match(/(20\d{2})\s*A/)?.[1] || 0);

  return {
    companyName: company,
    lastAuditedYear: year || undefined,
    revenue: findTriple(text, [/Revenue from operations/, /Total income from operations/, /Net sales/, /Revenue/]),
    materials: findTriple(text, [/Cost of materials? consumed/, /Cost of goods sold/, /Purchases of stock/]),
    employee: findTriple(text, [/Employee benefit/, /Employee costs?/, /Staff costs?/]),
    otherExpenses: findTriple(text, [/Other expenses/, /Operating expenses/]),
    depreciation: findTriple(text, [/Depreciation and amortisation/, /Depreciation/]),
    financeCosts: findTriple(text, [/Finance costs?/, /Interest expense/]),
    tax: findTriple(text, [/Tax expense/, /Current tax/, /Provision for tax/]),
    pat: findTriple(text, [/Profit for the (?:year|period)/, /Profit after tax/, /Net profit/]),
    fixedAssets: findTriple(text, [/Property,? plant and equipment/, /Fixed assets/, /PPE/]),
    inventories: findTriple(text, [/Inventories/]),
    receivables: findTriple(text, [/Trade receivables/, /Sundry debtors/]),
    cash: findTriple(text, [/Cash and cash equivalents/, /Cash and bank/]),
    borrowings: findTriple(text, [/Borrowings/, /Long-term borrowings/]),
    shareCapital: findTriple(text, [/Equity share capital/, /Share capital/]),
    reserves: findTriple(text, [/Other equity/, /Reserves and surplus/]),
    payables: findTriple(text, [/Trade payables/]),
  };
}
