import { NextResponse } from "next/server";
import { canUseIpoModel } from "@/lib/finance/access";
import { SAMPLE_HISTORICALS } from "@/lib/finance/ipo-model";
import { extractPdfText, parseHistoricalHints } from "@/lib/finance/ipo-pdf";
import { getFinanceSession } from "@/lib/finance/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getFinanceSession();
  if (!user || !canUseIpoModel(user)) {
    return NextResponse.json({ error: "IPO model is limited to Admin and Finance employees." }, { status: 403 });
  }

  const form = await request.formData();
  const files = form.getAll("files").filter((item): item is File => item instanceof File && item.size > 0);
  if (!files.length) return NextResponse.json({ error: "Choose at least one PDF." }, { status: 400 });

  const texts: string[] = [];
  for (const file of files) {
    if (!/\.pdf$/i.test(file.name)) continue;
    if (file.size > 8 * 1024 * 1024) continue;
    const bytes = new Uint8Array(await file.arrayBuffer());
    texts.push(extractPdfText(bytes));
  }
  const combined = texts.join(" \n ");
  const hints = parseHistoricalHints(combined);
  const historical = structuredClone(SAMPLE_HISTORICALS);
  let filled = 0;

  if (hints.companyName) {
    historical.companyName = hints.companyName;
    filled += 1;
  }
  if (hints.lastAuditedYear) {
    historical.lastAuditedYear = hints.lastAuditedYear;
    filled += 1;
  }
  if (hints.revenue) {
    historical.pnl.revenue = hints.revenue;
    filled += 1;
  }
  if (hints.materials) {
    historical.pnl.materials = hints.materials;
    filled += 1;
  }
  if (hints.employee) {
    historical.pnl.employee = hints.employee;
    filled += 1;
  }
  if (hints.otherExpenses) {
    historical.pnl.otherExpenses = hints.otherExpenses;
    filled += 1;
  }
  if (hints.depreciation) {
    historical.pnl.depreciation = hints.depreciation;
    filled += 1;
  }
  if (hints.financeCosts) {
    historical.pnl.financeCosts = hints.financeCosts;
    filled += 1;
  }
  if (hints.tax) {
    historical.pnl.tax = hints.tax;
    filled += 1;
  }
  if (hints.fixedAssets) {
    historical.bs.fixedAssets = hints.fixedAssets;
    filled += 1;
  }
  if (hints.inventories) {
    historical.bs.inventories = hints.inventories;
    filled += 1;
  }
  if (hints.receivables) {
    historical.bs.receivables = hints.receivables;
    filled += 1;
  }
  if (hints.cash) {
    historical.bs.cash = hints.cash;
    filled += 1;
  }
  if (hints.borrowings) {
    historical.bs.borrowings = hints.borrowings;
    filled += 1;
  }
  if (hints.shareCapital) {
    historical.bs.shareCapital = hints.shareCapital;
    filled += 1;
  }
  if (hints.reserves) {
    historical.bs.reserves = hints.reserves;
    filled += 1;
  }
  if (hints.payables) {
    historical.bs.payables = hints.payables;
    filled += 1;
  }

  return NextResponse.json({
    historical,
    filled,
    chars: combined.length,
    files: files.map((file) => file.name),
    note:
      filled > 0
        ? `Read ${files.length} PDF(s) and filled ${filled} line items. Review blue cells before download.`
        : "No clear 3-year figures were found in the PDF text layer. Sample audited numbers were loaded for editing (scanned PDFs need OCR first).",
  });
}
