import { PortalError } from "@/lib/form";
import type { FinanceProject } from "@/lib/finance/types";
import * as XLSX from "xlsx";

type HeaderName =
  | "serial"
  | "project"
  | "bank"
  | "status"
  | "remarks"
  | "concernedPerson"
  | "caseHead"
  | "company";

function cellText(value: unknown) {
  if (value == null) return "";
  if (value instanceof Date) return "";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : String(value);
  const text = String(value).replace(/\r/g, "").trim();
  if (text === "nan" || text === "None") return "";
  return text;
}

function normHeader(value: unknown) {
  return cellText(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function mapHeader(value: unknown): HeaderName | null {
  const name = normHeader(value);
  if (name === "sno" || name === "srno" || name === "slno" || name === "serial" || name === "s") return "serial";
  if (name === "project" || name.includes("project")) return "project";
  if (name === "bank") return "bank";
  if (name === "status") return "status";
  if (name.includes("task") || name.includes("remark")) return "remarks";
  if (name.includes("concerned") || name === "person" || name === "resource") return "concernedPerson";
  if (name.includes("casehead") || name === "casehead" || name === "head") return "caseHead";
  if (name === "company" || name === "comapny" || name.includes("company")) return "company";
  return null;
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

function matrixFromFile(bytes: Buffer, filename: string) {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".csv")) return parseCsv(bytes.toString("utf8"));
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    const book = XLSX.read(bytes, { type: "buffer", cellDates: true });
    const sheet = book.Sheets[book.SheetNames[0]];
    if (!sheet) return [];
    return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: true });
  }
  throw new PortalError("Upload a CSV or Excel file (.csv, .xlsx, .xls).");
}

function titleFromRows(rows: unknown[][], filename: string) {
  for (const row of rows.slice(0, 4)) {
    const text = row.map(cellText).find((cell) => cell && !mapHeader(cell));
    if (text && text.length > 3) return text;
  }
  return filename.replace(/\.[^.]+$/, "") || "Finance projects";
}

export function parseFinanceSheet(bytes: Buffer, filename: string) {
  const matrix = occupied(matrixFromFile(bytes, filename));
  if (!matrix.length) throw new PortalError("That file has no rows.");

  let headerAt = -1;
  let headers: Array<HeaderName | null> = [];
  for (let index = 0; index < matrix.length; index += 1) {
    const mapped = matrix[index].map(mapHeader);
    if (mapped.includes("serial") && mapped.includes("project")) {
      headerAt = index;
      headers = mapped;
      break;
    }
  }
  if (headerAt < 0) {
    throw new PortalError("Could not find a header row with S.no and Project. Use the finance status sheet format.");
  }

  const sheetTitle = titleFromRows(matrix.slice(0, headerAt), filename);
  const projects: FinanceProject[] = [];
  let lastSerial = "";
  let lastProject = "";
  let lastCompany = "";

  for (let index = headerAt + 1; index < matrix.length; index += 1) {
    const row = matrix[index];
    const values: Partial<Record<HeaderName, string>> = {};
    headers.forEach((header, column) => {
      if (!header) return;
      values[header] = cellText(row[column]);
    });

    const serial = values.serial || "";
    const project = values.project || "";
    const bank = values.bank || "";
    const status = values.status || "";
    const remarks = values.remarks || "";
    const concernedPerson = values.concernedPerson || "";
    const caseHead = values.caseHead || "";
    const company = values.company || "";

    if (!serial && !project && !bank && !status && !remarks && !concernedPerson && !caseHead && !company) continue;

    if (serial) lastSerial = serial;
    if (project) lastProject = project;
    if (company) lastCompany = company;

    projects.push({
      id: `fin_prj_${Date.now()}_${projects.length + 1}`,
      serial: serial || lastSerial,
      project: project || lastProject,
      bank,
      status,
      remarks,
      concernedPerson,
      caseHead,
      company: company || lastCompany,
    });
  }

  if (!projects.length) throw new PortalError("No project rows were found under the header.");
  return { sheetTitle, projects };
}
