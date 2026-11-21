import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import { purposeLabel, type IpoHistoricals, type IpoIssueInputs } from "@/lib/finance/ipo-model";

function setCell(sheet: XLSX.WorkSheet, address: string, value: string | number) {
  const existing = sheet[address] as XLSX.CellObject | undefined;
  sheet[address] = { ...(existing || {}), t: typeof value === "number" ? "n" : "s", v: value };
  if (existing && "f" in existing) delete (sheet[address] as XLSX.CellObject).f;
}

function setTriple(sheet: XLSX.WorkSheet, row: number, values: [number, number, number]) {
  setCell(sheet, `B${row}`, values[0]);
  setCell(sheet, `C${row}`, values[1]);
  setCell(sheet, `D${row}`, values[2]);
}

function templatePath() {
  return path.join(process.cwd(), "public", "ipo", "IPO_Financial_Model_Template.xlsx");
}

export function buildIpoWorkbook(historical: IpoHistoricals, issue: IpoIssueInputs) {
  const bytes = fs.readFileSync(templatePath());
  const wb = XLSX.read(bytes, { type: "buffer", cellFormula: true });

  const assumptions = wb.Sheets.Assumptions;
  const ipo = wb.Sheets.IPO;
  const pnl = wb.Sheets.PnL;
  const bs = wb.Sheets.BS;
  const cf = wb.Sheets.CF;
  const cover = wb.Sheets.Cover;
  const rev = wb.Sheets.Rev_Build;

  setCell(assumptions, "B6", historical.companyName);
  setCell(assumptions, "B7", historical.units);
  setCell(assumptions, "B8", historical.lastAuditedYear);
  setCell(assumptions, "B2", `All amounts in ${historical.units} unless stated`);
  setCell(assumptions, "E11", issue.existingRevGrowth[0]);
  setCell(assumptions, "F11", issue.existingRevGrowth[1]);
  setCell(assumptions, "G11", issue.existingRevGrowth[2]);
  setCell(assumptions, "H11", Math.max(0.08, issue.existingRevGrowth[2] - 0.02));
  setCell(assumptions, "I11", Math.max(0.06, issue.existingRevGrowth[2] - 0.04));
  setCell(assumptions, "B35", issue.existingCapacity);
  setCell(assumptions, "B36", issue.capexPerUnit);
  setCell(assumptions, "B37", issue.revenuePerUnit);
  setCell(assumptions, "B38", issue.priceEscalation);
  setCell(assumptions, "E39", issue.utilY1);
  setCell(assumptions, "F39", issue.utilY2);
  setCell(assumptions, "G39", issue.utilY3);
  setCell(assumptions, "H39", issue.utilY4);
  setCell(assumptions, "I39", issue.utilY5);

  setCell(ipo, "B2", historical.companyName);
  setCell(ipo, "B6", issue.preIssueSharesCr);
  setCell(ipo, "B7", issue.faceValue);
  setCell(ipo, "B8", issue.priceFloor);
  setCell(ipo, "B9", issue.priceCap);
  setCell(ipo, "B10", issue.issuePrice);
  setCell(ipo, "B11", issue.freshIssue);
  setCell(ipo, "B12", issue.ofs);
  setCell(ipo, "B14", issue.issueExpensePct);
  setCell(ipo, "B15", issue.ipoCloseYear);
  setCell(ipo, "B26", issue.objectCapexPct);
  setCell(ipo, "B27", issue.objectDebtPct);
  setCell(ipo, "B28", issue.objectWcPct);
  const gcp = Math.max(0, 1 - issue.objectCapexPct - issue.objectDebtPct - issue.objectWcPct);
  setCell(ipo, "B29", gcp);

  setCell(pnl, "B2", historical.companyName);
  setTriple(pnl, 6, historical.pnl.revenue);
  setTriple(pnl, 7, historical.pnl.otherIncome);
  setTriple(pnl, 8, historical.pnl.materials);
  setTriple(pnl, 9, historical.pnl.employee);
  setTriple(pnl, 10, historical.pnl.otherExpenses);
  setTriple(pnl, 12, historical.pnl.depreciation);
  setTriple(pnl, 13, historical.pnl.financeCosts);
  setTriple(pnl, 15, historical.pnl.tax);

  setCell(bs, "B2", historical.companyName);
  setTriple(bs, 6, historical.bs.fixedAssets);
  setTriple(bs, 7, historical.bs.investments);
  setTriple(bs, 8, historical.bs.inventories);
  setTriple(bs, 9, historical.bs.receivables);
  setTriple(bs, 10, historical.bs.otherCurrentAssets);
  setTriple(bs, 11, historical.bs.cash);
  setTriple(bs, 15, historical.bs.shareCapital);
  setTriple(bs, 16, historical.bs.reserves);
  setTriple(bs, 17, historical.bs.borrowings);
  setTriple(bs, 18, historical.bs.otherNcl);
  setTriple(bs, 19, historical.bs.payables);
  setTriple(bs, 20, historical.bs.otherCurrentLiab);

  setCell(cf, "B2", historical.companyName);
  setTriple(cf, 10, historical.cf.wcChange);
  setTriple(cf, 16, historical.cf.taxPaid);
  setTriple(cf, 21, historical.cf.otherCapex);
  setTriple(cf, 23, historical.cf.otherInvesting);
  setTriple(cf, 29, historical.cf.otherBorrowings);
  setTriple(cf, 31, historical.cf.financePaid);
  setTriple(cf, 32, historical.cf.dividends);
  setTriple(cf, 33, historical.cf.otherFinancing);
  setTriple(cf, 37, historical.cf.openingCash);

  setCell(rev, "B2", historical.companyName);
  setTriple(rev, 6, historical.pnl.revenue);

  setCell(cover, "A1", `${historical.companyName} - IPO financial model`);
  setCell(
    cover,
    "A2",
    `Purpose: ${purposeLabel(issue.purpose)}. ${issue.projectionYears}-year forward projections with IPO proceeds, utilisation and capacity-driven revenue. Draft for review; not investment advice.`,
  );

  const out = XLSX.write(wb, { type: "buffer", bookType: "xlsx", cellStyles: true });
  return Buffer.from(out);
}
