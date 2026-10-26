import { PortalError } from "@/lib/form";
import type { SessionUser } from "@/lib/types";
import * as XLSX from "xlsx";

export type HourlySheetRow = {
  sheetNo: number;
  project: string;
  sprint: string;
  resource: string;
  task: string;
  workDate: string;
  hours: number;
  status: string;
  company: string;
  estStart: string;
  estEnd: string;
  estimatedHours: number | null;
  targetHours: number | null;
  actualStart: string;
  actualEnd: string;
  actualHours: number | null;
  approval: string;
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
  const match = text.match(/^(\d{1,2})([/.-])(\d{1,2})\2(\d{4})$/);
  if (!match) return "";
  const first = Number(match[1]);
  const second = Number(match[3]);
  let month = match[2] === "/" ? first : second;
  let day = match[2] === "/" ? second : first;
  if (month > 12 && day <= 12) {
    const swap = month;
    month = day;
    day = swap;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return "";
  return `${match[4]}-${pad(month)}-${pad(day)}`;
}

function asHours(value: unknown) {
  const text = cellText(value).replace(/hours?|hrs?/gi, "").trim();
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function headerKey(value: unknown) {
  const name = cellText(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (name === "sno" || name === "srno" || name === "serial") return "sheetNo";
  if (name === "project" || name === "client") return "project";
  if (name === "sprint") return "sprint";
  if (name === "resource" || name === "person" || name === "employee" || name === "name") return "resource";
  if (name === "task" || name.endsWith("task")) return "task";
  if (name === "date" || name === "workdate" || name === "day") return "date";
  if (name === "eststartdate" || name === "estimatedstartdate") return "estStart";
  if (name === "estenddate" || name === "estimatedenddate") return "estEnd";
  if (name === "estimatedhours") return "estimatedHours";
  if (name === "targethoursembee" || name === "targethours") return "targetHours";
  if (name === "actualstartdate") return "actualStart";
  if (name === "actualenddate") return "actualEnd";
  if (name === "actualhours") return "actualHours";
  if (name === "hoursspent" || name === "hours" || name === "hour" || name === "hrs" || name === "hr") return "hours";
  if (name === "status") return "status";
  if (name === "company" || name === "comapny") return "company";
  if (name === "approval" || name === "aproval") return "approval";
  if (name.includes("note") || name.includes("remark") || name.includes("description")) return "notes";
  if (name === "role" || name === "designation") return "role";
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
  const teamSheet = rows.some((row) => row.resource);
  const matched = teamSheet
    ? rows
    : rows.filter((row) => {
        const roleOk = !row.role || roles.has(compact(row.role));
        const personOk = !row.person || people.has(compact(row.person));
        return roleOk && personOk;
      });
  if (!matched.length) throw new PortalError(teamSheet ? "That file has no hourly rows." : "That file has no rows for your role.");
  return matched;
}

export function presentHourlyEntry<T extends HourlySheetRow>(row: T): T {
  return {
    ...row,
    sheetNo: row.sheetNo || 0,
    sprint: row.sprint || "",
    resource: row.resource || "",
    task: row.task || row.notes || "",
    status: row.status || "",
    company: row.company || "",
    estStart: row.estStart || "",
    estEnd: row.estEnd || "",
    estimatedHours: row.estimatedHours ?? null,
    targetHours: row.targetHours ?? null,
    actualStart: row.actualStart || "",
    actualEnd: row.actualEnd || "",
    actualHours: row.actualHours ?? null,
    approval: row.approval || "",
  };
}

export function isResourceAllocation(row: { estimatedHours?: number | null; targetHours?: number | null; estStart?: string }) {
  return row.estimatedHours != null || row.targetHours != null || Boolean(row.estStart);
}

export function hourlySheetLayout(rows: { estStart?: string; estEnd?: string; estimatedHours?: number | null; targetHours?: number | null; actualStart?: string }[]) {
  return rows.some((row) => row.estStart || row.estEnd || row.estimatedHours || row.targetHours || row.actualStart) ? "plan" : "log";
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
    if (found.project != null && (found.hours != null || found.date != null || found.estimatedHours != null || found.actualHours != null || found.task != null)) {
      headerAt = index;
      Object.assign(columns, found);
      break;
    }
  }
  if (headerAt < 0) throw new PortalError("The sheet needs Project and Hours Spent, or the utilization columns.");
  const rows: HourlySheetRow[] = [];
  for (const line of matrix.slice(headerAt + 1)) {
    const textAt = (key: string) => (columns[key] == null ? "" : cellText(line[columns[key]]));
    const dateAt = (key: string) => (columns[key] == null ? "" : asDate(line[columns[key]]));
    const hoursAt = (key: string) => (columns[key] == null ? null : asHours(line[columns[key]]));
    const project = textAt("project");
    const task = textAt("task") || textAt("notes");
    const resource = textAt("resource");
    const workDate = dateAt("date") || dateAt("actualStart") || dateAt("estStart");
    const spent = hoursAt("hours");
    const actualHours = hoursAt("actualHours");
    const hours = spent ?? actualHours ?? 0;
    if (!project && !task && !resource && !workDate) continue;
    if (spent != null && spent > 24) throw new PortalError("Hours Spent must be from 0 to 24.");
    rows.push({
      sheetNo: Number(textAt("sheetNo")) || 0,
      project,
      sprint: textAt("sprint"),
      resource,
      task,
      workDate,
      hours,
      status: textAt("status"),
      company: textAt("company"),
      estStart: dateAt("estStart"),
      estEnd: dateAt("estEnd"),
      estimatedHours: hoursAt("estimatedHours"),
      targetHours: hoursAt("targetHours"),
      actualStart: dateAt("actualStart"),
      actualEnd: dateAt("actualEnd"),
      actualHours,
      approval: textAt("approval"),
      notes: task,
      role: textAt("role"),
      person: resource,
    });
  }
  if (!rows.length) throw new PortalError("That file has no hourly rows.");
  return rows;
}
