import { sowCompany } from "@/lib/sow-board";
import type { StatusUpdate } from "@/lib/types";

export function canPublishStatus(user: { email: string; fullName: string; sheetEditor?: boolean }) {
  if (user.sheetEditor) return true;
  const email = user.email.toLowerCase();
  const name = user.fullName.toLowerCase();
  return email === "owner@embee.local" || name.includes("gsvk");
}

export function visibleStatus<T extends { company?: string }>(user: { email: string; fullName: string; companyScope?: string }, rows: T[]) {
  const email = user.email.toLowerCase();
  const name = user.fullName.toLowerCase().trim();
  const scope = (user.companyScope || "").trim().toLowerCase();
  const assureOnly = scope === "assure" || email === "rakhee@embee.local" || email === "brian@embee.local" || name === "rakhee" || name === "brian";
  if (!assureOnly) return rows;
  return rows.filter((row) => (row.company || "").trim().toLowerCase() === "assure");
}

export function formatSheetLabel(iso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : "";
}

export function statusIdentity(row: Pick<StatusUpdate, "project" | "subItem" | "statusDate">) {
  const text = `${(row.project || "").trim()}\u0000${(row.subItem || "").trim()}\u0000${(row.statusDate || "").slice(0, 10)}`;
  let value = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return `status_${value.toString(36)}`;
}

export function presentStatus(row: StatusUpdate): StatusUpdate {
  const statusDate = (row.statusDate || "").slice(0, 10);
  const fields: Record<string, string> = {};
  for (const [key, value] of Object.entries(row.fields ?? {})) {
    const text = String(value ?? "").trim();
    if (text) fields[key] = text;
  }
  return {
    id: row.id || statusIdentity(row),
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedBy: row.updatedBy,
    updatedAt: row.updatedAt,
    sheetNo: row.sheetNo || 0,
    project: (row.project || "").trim(),
    subItem: (row.subItem || "").trim(),
    status: (row.status || "").trim(),
    remarks: row.remarks || "",
    statusDate,
    sheetLabel: (row.sheetLabel || "").trim() || formatSheetLabel(statusDate),
    company: (row.company || "").trim() || sowCompany(row.project || ""),
    fields,
  };
}

export function statusKey(row: StatusUpdate) {
  const item = presentStatus(row);
  return `${item.project}\u0000${item.subItem}\u0000${item.statusDate}`;
}

export function mergeStatus(current: StatusUpdate[], incoming: StatusUpdate[]) {
  const map = new Map<string, StatusUpdate>();
  for (const row of current) {
    const item = presentStatus(row);
    if (item.project && item.statusDate) map.set(statusKey(item), item);
  }
  for (const row of incoming) {
    const item = presentStatus(row);
    if (item.project && item.statusDate) map.set(statusKey(item), item);
  }
  return [...map.values()].sort((a, b) => b.statusDate.localeCompare(a.statusDate) || a.sheetNo - b.sheetNo || a.project.localeCompare(b.project));
}

export function latestStatus(rows: StatusUpdate[]) {
  return statusAsOf(rows, "9999-12-31");
}

export function isArchiveDate(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)));
}

export function statusDates(rows: StatusUpdate[]) {
  return [...new Set(rows.map((row) => (row.statusDate || "").slice(0, 10)).filter(Boolean))].sort().reverse();
}

export function statusAsOf(rows: StatusUpdate[], asOf: string) {
  const ready = rows.map(presentStatus).filter((row) => row.project && row.statusDate && row.statusDate <= asOf);
  if (!ready.length) return { date: "", rows: [] as StatusUpdate[] };
  const date = ready.reduce((max, row) => (row.statusDate > max ? row.statusDate : max), ready[0].statusDate);
  return {
    date,
    rows: ready
      .filter((row) => row.statusDate === date)
      .sort((a, b) => a.sheetNo - b.sheetNo || a.project.localeCompare(b.project)),
  };
}

export function groupStatus(rows: StatusUpdate[]) {
  const groups: { key: string; sheetNo: number; project: string; items: StatusUpdate[] }[] = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (last && last.project === row.project && last.sheetNo === row.sheetNo) last.items.push(row);
    else groups.push({ key: `${row.sheetNo}-${row.project}-${groups.length}`, sheetNo: row.sheetNo, project: row.project, items: [row] });
  }
  return groups;
}

export function extraStatusColumns(rows: StatusUpdate[]) {
  const columns: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row.fields ?? {})) {
      if (seen.has(key)) continue;
      seen.add(key);
      columns.push(key);
    }
  }
  return columns;
}

export function statusNeedsAttention(status: string) {
  const value = status.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return value === "pending" || value.includes("not started");
}

export function statusIsSettled(status: string) {
  const value = status.toLowerCase();
  return value.includes("complete") || value.includes("closed") || value.includes("delivered");
}

export function statusTone(status: string) {
  const value = status.toLowerCase();
  if (value.includes("block")) return "bad";
  if (value.includes("hold") || value.includes("not started") || value.includes("to get") || value === "tbd") return "warn";
  if (value.includes("complete") || value.includes("closed")) return "ok";
  return "";
}
