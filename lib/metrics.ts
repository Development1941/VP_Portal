import type {
  DirectoryUser,
  Feature,
  Invoice,
  InvoiceLine,
  Payment,
  ProjectMember,
  RateCard,
  Timesheet,
} from "@/lib/types";
import { roundMoney } from "@/lib/format";

export function invoiceFigures(invoice: Invoice, lines: InvoiceLine[]) {
  const subtotal = roundMoney(
    lines.filter((line) => line.invoiceId === invoice.id).reduce((sum, line) => sum + line.amount, 0),
  );
  const tax = roundMoney(subtotal * (invoice.taxRate / 100));
  return { subtotal, tax, total: roundMoney(subtotal + tax) };
}

export function amountPaid(invoiceId: string, payments: Payment[]) {
  return roundMoney(
    payments
      .filter((payment) => payment.invoiceId === invoiceId && payment.direction === "incoming" && payment.status === "completed")
      .reduce((sum, payment) => sum + payment.amount, 0),
  );
}

export function outstanding(invoice: Invoice, lines: InvoiceLine[], payments: Payment[]) {
  if (invoice.status === "void") return 0;
  const { total } = invoiceFigures(invoice, lines);
  return roundMoney(Math.max(0, total - amountPaid(invoice.id, payments)));
}

export function resolveBillRate(
  entry: { userId: string; projectId: string; featureId: string },
  features: Feature[],
  members: ProjectMember[],
  rates: RateCard[],
  users: DirectoryUser[],
) {
  const feature = features.find((item) => item.id === entry.featureId);
  if (feature?.billingType === "hourly" && feature.hourlyRate > 0) return feature.hourlyRate;
  const member = members.find((item) => item.projectId === entry.projectId && item.userId === entry.userId);
  if (member && member.billRate > 0) return member.billRate;
  const userRate = rates.find((rate) => rate.scope === "user" && rate.targetId === entry.userId);
  if (userRate) return userRate.hourlyRate;
  const projectRate = rates.find((rate) => rate.scope === "project" && rate.targetId === entry.projectId);
  if (projectRate) return projectRate.hourlyRate;
  const person = users.find((user) => user.id === entry.userId);
  const roleRate = rates.find((rate) => rate.scope === "role" && rate.targetId === person?.roleId);
  if (roleRate) return roleRate.hourlyRate;
  return rates.find((rate) => rate.scope === "company")?.hourlyRate ?? 0;
}

export function entryValue(
  entry: Timesheet,
  features: Feature[],
  members: ProjectMember[],
  rates: RateCard[],
  users: DirectoryUser[],
) {
  if (!entry.billable) return 0;
  const feature = features.find((item) => item.id === entry.featureId);
  if (feature?.billingType === "fixed") return 0;
  return roundMoney(entry.hours * resolveBillRate(entry, features, members, rates, users));
}

export function nextInvoiceStatus(invoice: Invoice, lines: InvoiceLine[], payments: Payment[]): Invoice["status"] {
  if (invoice.status === "void") return "void";
  const paid = amountPaid(invoice.id, payments);
  const { total } = invoiceFigures(invoice, lines);
  if (paid <= 0) return invoice.status === "draft" ? "draft" : "sent";
  if (paid + 0.5 >= total) return "paid";
  return "partial";
}
