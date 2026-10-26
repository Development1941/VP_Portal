import { PortalError } from "@/lib/form";
import type { SessionUser } from "@/lib/types";
import * as XLSX from "xlsx";

export type HourlySheetRow = {
  workDate: string;
  project: string;
  hours: number;
  notes: string;
  role: string;
  person: string;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function cellText(value: unknown) {
  if (value == null) return "";
  if (value instanceof Date) return "";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : String(value);
  return String(value).replace(/\r/g, "").trim();
}

function fromExcelSerial(serial: number) {
  const utc = new Date(Math.round((serial - 25569) * 86400 * 1000));
  if (Number.isNaN(utc.getTime())) return "";
  return `${utc.getUTCFullYear()}-${pad(utc.getUTCMonth() + 1)}-${pad(utc.getUTCDate())}`;
}

function asDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }
  if (typeof value === "number" && value > 20000 && value < 80000) return fromExcelSerial(value);
  const text = cellText(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const match = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (!match) return "";
  const day = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return "";
  return `${match[3]}-${pad(month)}-${pad(day)}`;
}

function asHours(value: unknown) {
  const text = cellText(value).replace(/hours?|hrs?/gi, "").trim();
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

function headerKey(value: unknown) {
  const name = cellText(value).toLowerCase().replace(/[^a-z]+/g, "");
  if (["date", "workdate", "day"].includes(name)) return "date";
  if (name.includes("project") || name === "client") return "project";
  if (["hours", "hour", "hrs", "hr", "time"].includes(name)) return "hours";
  if (name.includes("note") || name.includes("task") || name.includes("remark") || name.includes("description") || name === "work") return "notes";
  if (name === "role" || name === "designation") return "role";
  if (["name", "person", "employee", "user"].includes(name)) return "person";
  return "";
}

function compact(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function canUseHourlyTracker(user: { email: string; fullName: string }) {
  const email = user.email.toLowerCase();
  const name = user.fullName.toLowerCase();
  const sai = email === "owner@embee.local" || name.includes("gsvk");
  const harshit = email === "director@embee.local" || name.includes("harshit");
  return sai || harshit;
}

export function hourlyRowsForUser(rows: HourlySheetRow[], user: SessionUser) {
  const roles = new Set([user.roleName, user.roleSlug].map(compact).filter(Boolean));
  const people = new Set([user.fullName, user.email].map(compact).filter(Boolean));
  const matched = rows.filter((row) => {
    const roleOk = !row.role || roles.has(compact(row.role));
    const personOk = !row.person || people.has(compact(row.person));
    return roleOk && personOk;
  });
  if (!matched.length) throw new PortalError("That file has no rows for your role.");
  return matched;
}

export function parseHourlySheet(bytes: Buffer, filename: string) {
  const csv = filename.toLowerCase().endsWith(".csv");
  const workbook = csv
    ? XLSX.read(bytes.toString("utf8"), { type: "string", cellDates: true })
    : XLSX.read(bytes, { type: "buffer", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0] ?? ""];
  if (!sheet) throw new PortalError("That file has no sheet.");
  const matrix = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(sheet, { header: 1, raw: true, defval: "" });
  let headerAt = -1;
  const columns: Record<string, number> = {};
  for (let index = 0; index < Math.min(matrix.length, 15); index += 1) {
    const found: Record<string, number> = {};
    matrix[index].forEach((cell, column) => {
      const key = headerKey(cell);
      if (key && found[key] == null) found[key] = column;
    });
    if (found.date != null && found.hours != null) {
      headerAt = index;
      Object.assign(columns, found);
      break;
    }
  }
  if (headerAt < 0) throw new PortalError("The sheet needs Date and Hours columns.");
  const rows: HourlySheetRow[] = [];
  for (const line of matrix.slice(headerAt + 1)) {
    const workDate = asDate(line[columns.date]);
    const hours = asHours(line[columns.hours]);
    if (!workDate || hours <= 0) continue;
    if (hours > 24) throw new PortalError("Hours must be greater than 0 and at most 24.");
    rows.push({
      workDate,
      project: columns.project == null ? "" : cellText(line[columns.project]),
      hours,
      notes: columns.notes == null ? "" : cellText(line[columns.notes]),
      role: columns.role == null ? "" : cellText(line[columns.role]),
      person: columns.person == null ? "" : cellText(line[columns.person]),
    });
  }
  if (!rows.length) throw new PortalError("Add a date and hours for each row.");
  return rows;
}
