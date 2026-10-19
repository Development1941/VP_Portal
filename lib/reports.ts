import { todayIso } from "@/lib/dates";
import { roundMoney } from "@/lib/format";
import { entryValue, outstanding } from "@/lib/metrics";
import type { Project, Workspace } from "@/lib/types";

export function projectEconomics(project: Project, data: Workspace) {
  const sheets = data.timesheets.filter((entry) => entry.projectId === project.id);
  const billableHours = roundMoney(sheets.filter((entry) => entry.billable).reduce((sum, entry) => sum + entry.hours, 0));
  const otherHours = roundMoney(sheets.filter((entry) => !entry.billable).reduce((sum, entry) => sum + entry.hours, 0));
  const invoices = data.invoices.filter((invoice) => invoice.projectId === project.id && invoice.status !== "void");
  const invoiced = roundMoney(
    data.lines.filter((line) => invoices.some((invoice) => invoice.id === line.invoiceId)).reduce((sum, line) => sum + line.amount, 0),
  );
  const seenFixed = new Set<string>();
  let unbilled = 0;
  for (const entry of sheets) {
    if (entry.status !== "approved" || !entry.billable || entry.invoiceId) continue;
    const feature = data.features.find((item) => item.id === entry.featureId);
    const alreadyInvoiced = data.lines.some((line) => line.featureId === feature?.id && invoices.some((invoice) => invoice.id === line.invoiceId));
    if (feature?.billingType === "fixed" && !alreadyInvoiced) seenFixed.add(feature.id);
    else unbilled += entryValue(entry, data.features, data.members, data.rates, data.users);
  }
  for (const featureId of seenFixed) {
    unbilled += data.features.find((feature) => feature.id === featureId)?.fixedAmount ?? 0;
  }
  unbilled = roundMoney(unbilled);
  const cost = roundMoney(
    sheets.reduce((sum, entry) => sum + entry.hours * (data.users.find((person) => person.id === entry.userId)?.hourlyCost ?? 0), 0),
  );
  const due = roundMoney(invoices.reduce((sum, invoice) => sum + outstanding(invoice, data.lines, data.payments), 0));
  const recognized = roundMoney(invoiced + unbilled);
  return {
    billableHours,
    otherHours,
    invoiced,
    unbilled,
    recognized,
    cost,
    profit: roundMoney(recognized - cost),
    due,
    budgetUsed: project.budgetAmount > 0 ? Math.min(100, Math.round((recognized / project.budgetAmount) * 100)) : 0,
  };
}

export function dues(data: Workspace) {
  return data.invoices
    .map((invoice) => ({ invoice, amount: outstanding(invoice, data.lines, data.payments) }))
    .filter((row) => row.amount > 0)
    .sort((a, b) => a.invoice.dueDate.localeCompare(b.invoice.dueDate));
}

export function isOverdue(dueDate: string, amount: number) {
  return amount > 0 && Boolean(dueDate) && dueDate < todayIso();
}
