import { PortalError } from "@/lib/form";
import { formatSheetLabel } from "@/lib/status-board";
import type { StatusUpdate } from "@/lib/types";
import * as XLSX from "xlsx";

type HeaderName = "S.no" | "Project" | "Sub Item" | "Status" | "Task/Remarks" | "Date" | "Sheet";

function normHeader(value: unknown) {
  return String(value ?? "").replace(/[\s.]+/g, "").toLowerCase();
}

function mapHeader(value: unknown): HeaderName | null {
  const name = normHeader(value);
  if (name === "sno" || name === "srno" || name === "slno" || name === "s#") return "S.no";
  if (name.includes("project")) return "Project";
  if (name.includes("sub")) return "Sub Item";
  if (name === "date" || name === "statusdate") return "Date";
  if (name === "sheet" || name === "sheetname" || name === "sheetlabel") return "Sheet";
  if (name.includes("status")) return "Status";
  if (name.includes("task") || name.includes("remark")) return "Task/Remarks";
  return null;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function cellText(value: unknown) {
  if (value == null) return "";
  if (value instanceof Date) return "";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : String(value);
  const text = String(value).replace(/\r/g, "").trim();
  if (text === "nan" || text === "None") return "";
  return text;
}

function fromExcelSerial(serial: number) {
  const utc = new Date(Math.round((serial - 25569) * 86400 * 1000));
  if (Number.isNaN(utc.getTime())) return "";
  return `${utc.getUTCFullYear()}-${pad(utc.getUTCMonth() + 1)}-${pad(utc.getUTCDate())}`;
}

function dateFromMatch(dayText: string, monthText: string, yearText: string) {
  const day = Number(dayText);
  const month = Number(monthText);
  if (month < 1 || month > 12 || day < 1 || day > 31) return "";
  return `${yearText}-${pad(month)}-${pad(day)}`;
}

function findDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }
  if (typeof value === "number" && value > 20000 && value < 80000) return fromExcelSerial(value);
  const text = cellText(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const match = text.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  return match ? dateFromMatch(match[1], match[2], match[3]) : "";
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") cell += char;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function occupied(matrix: unknown[][]) {
  return matrix.filter((row) => row.some((cell) => cellText(cell) !== ""));
}

function sheetRows(matrix: unknown[][], sheetName: string) {
  const rows = occupied(matrix);
  let headerAt = -1;
  for (let index = 0; index < rows.length; index += 1) {
    const mapped = rows[index].map(mapHeader);
    if (mapped.includes("S.no") && mapped.includes("Project")) {
      headerAt = index;
      break;
    }
  }
  if (headerAt < 0) return [] as StatusUpdate[];

  let sheetDate = findDate(sheetName);
  if (!sheetDate) {
    for (const row of rows.slice(0, headerAt)) {
      for (const cell of row) {
        sheetDate = findDate(cell);
        if (sheetDate) break;
      }
      if (sheetDate) break;
    }
  }

  const header = rows[headerAt].map(mapHeader);
  const at = (name: HeaderName) => header.indexOf(name);
  const snoAt = at("S.no");
  const projectAt = at("Project");
  const subAt = at("Sub Item");
  const statusAt = at("Status");
  const remarksAt = at("Task/Remarks");
  const dateAt = at("Date");
  const sheetAt = at("Sheet");
  const parsed: StatusUpdate[] = [];
  let lastNo = "";
  let lastProject = "";

  for (const raw of rows.slice(headerAt + 1)) {
    const snoCell = snoAt >= 0 ? cellText(raw[snoAt]) : "";
    const projectCell = projectAt >= 0 ? cellText(raw[projectAt]) : "";
    const sno = snoCell || lastNo;
    const project = projectCell || lastProject;
    if (sno) lastNo = sno;
    if (project) lastProject = project;
    const subItem = subAt >= 0 ? cellText(raw[subAt]) : "";
    const status = statusAt >= 0 ? cellText(raw[statusAt]) : "";
    const remarks = remarksAt >= 0 ? cellText(raw[remarksAt]) : "";
    if (!subItem && !status && !remarks) continue;
    if (!project) continue;
    const statusDate = (dateAt >= 0 ? findDate(raw[dateAt]) : "") || sheetDate;
    if (!statusDate) throw new PortalError(`Add the date to the sheet name or the title above the table${sheetName ? ` (${sheetName})` : ""}.`);
    const sheetNo = Math.round(Number(sno));
    parsed.push({
      sheetNo: Number.isFinite(sheetNo) && sheetNo > 0 ? sheetNo : 0,
      project,
      subItem,
      status,
      remarks,
      statusDate,
      sheetLabel: (sheetAt >= 0 ? cellText(raw[sheetAt]) : "") || sheetName || formatSheetLabel(statusDate),
      fields: {},
    });
  }
  return parsed;
}

function workbookSheets(buffer: Buffer) {
  const book = XLSX.read(buffer, { type: "buffer", cellDates: false, raw: true });
  return book.SheetNames.map((name) => ({
    name,
    rows: XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[name], { header: 1, raw: true, defval: "", blankrows: false }),
  }));
}

export function parseStatusSheet(buffer: Buffer, filename: string) {
  const name = filename.toLowerCase();
  const stem = filename.replace(/\.[^.]+$/, "").trim();
  const sheets = name.endsWith(".csv")
    ? [{ name: stem, rows: parseCsv(buffer.toString("utf8")) }]
    : name.endsWith(".xlsx") || name.endsWith(".xls")
      ? workbookSheets(buffer)
      : null;
  if (!sheets) throw new PortalError("Upload a .csv or .xlsx file.");

  const saved = new Map<string, StatusUpdate>();
  let parsedSheets = 0;
  for (const sheet of sheets) {
    const rows = sheetRows(sheet.rows, sheet.name);
    if (!rows.length) continue;
    parsedSheets += 1;
    for (const row of rows) saved.set(`${row.project}\u0000${row.subItem}\u0000${row.statusDate}`, row);
  }
  if (!parsedSheets || !saved.size) {
    throw new PortalError("No status table was found. The sheet needs S.no and Project columns, with the date in the sheet name or title.");
  }
  if (saved.size > 5000) throw new PortalError("Upload 5,000 rows or fewer.");
  return [...saved.values()];
}
