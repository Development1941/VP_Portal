import { PortalError } from "@/lib/form";
import { presentSow, sowCompany } from "@/lib/sow-board";
import type { SowRecord } from "@/lib/types";
import * as XLSX from "xlsx";

type HeaderName = "S.no" | "Project" | "Sprint" | "Link" | "Signature" | "Signed on" | "Change";

function normHeader(value: unknown) {
  return String(value ?? "").replace(/[\s./]+/g, "").toLowerCase();
}

function mapHeader(value: unknown): HeaderName | null {
  const name = normHeader(value);
  if (name === "sno" || name === "srno" || name === "slno" || name === "s#") return "S.no";
  if (name.includes("project")) return "Project";
  if (name.includes("sprint")) return "Sprint";
  if (name.includes("link") || name.includes("reference")) return "Link";
  if (name.includes("signedon") || name === "signeddate") return "Signed on";
  if (name.includes("signed") || name.includes("unsigned")) return "Signature";
  if (name.includes("addendum") || name.includes("change") || name === "cr" || name.startsWith("cr")) return "Change";
  return null;
}

function cellText(value: unknown) {
  if (value == null) return "";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : String(value);
  const text = String(value).replace(/\r/g, "").trim();
  if (text === "nan" || text === "None") return "";
  return text;
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

function rowsFromMatrix(matrix: unknown[][], sheetName: string): SowRecord[] {
  const rows = matrix.filter((row) => row.some((cell) => cellText(cell) !== ""));
  let headerAt = -1;
  for (let index = 0; index < rows.length; index += 1) {
    const mapped = rows[index].map(mapHeader);
    if (mapped.includes("Project") && (mapped.includes("S.no") || mapped.includes("Signature") || mapped.includes("Link"))) {
      headerAt = index;
      break;
    }
  }
  if (headerAt < 0) return [];
  const header = rows[headerAt].map(mapHeader);
  const at = (name: HeaderName) => header.indexOf(name);
  const kind: SowRecord["kind"] = header.includes("Signature") || header.includes("Change") || header.includes("Sprint") ? "status" : "bid";
  const parsed: SowRecord[] = [];
  rows.slice(headerAt + 1).forEach((raw, index) => {
    const project = at("Project") >= 0 ? cellText(raw[at("Project")]) : "";
    if (!project) return;
    const snoText = at("S.no") >= 0 ? cellText(raw[at("S.no")]) : "";
    const sno = Math.round(Number(snoText));
    const sheetNo = Number.isFinite(sno) && sno > 0 ? sno : index + 1;
    parsed.push(presentSow({
      id: `sow-${kind}-${sheetNo}`,
      kind,
      sheetNo,
      project,
      sprint: at("Sprint") >= 0 ? cellText(raw[at("Sprint")]) : "",
      link: at("Link") >= 0 ? cellText(raw[at("Link")]) : "",
      signature: at("Signature") >= 0 ? cellText(raw[at("Signature")]) : "",
      signedOn: at("Signed on") >= 0 ? cellText(raw[at("Signed on")]) : "",
      changeRequest: at("Change") >= 0 ? cellText(raw[at("Change")]) : "",
      company: sowCompany(project),
    }));
  });
  void sheetName;
  return parsed;
}

export function parseSowSheet(buffer: Buffer, filename: string) {
  const name = filename.toLowerCase();
  let matrices: { name: string; rows: unknown[][] }[];
  if (name.endsWith(".csv")) matrices = [{ name: filename, rows: parseCsv(buffer.toString("utf8")) }];
  else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const book = XLSX.read(buffer, { type: "buffer", cellDates: false, raw: false });
    matrices = book.SheetNames.map((sheetName) => ({
      name: sheetName,
      rows: XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[sheetName], { header: 1, raw: false, defval: "" }),
    }));
  } else throw new PortalError("Upload a .csv or .xlsx file.");
  const saved = new Map<string, SowRecord>();
  for (const sheet of matrices) {
    for (const row of rowsFromMatrix(sheet.rows, sheet.name)) saved.set(`${row.kind}-${row.sheetNo}-${row.project}`, row);
  }
  if (!saved.size) throw new PortalError("No SOW table was found. Include Project Name and the signed status or a reference link.");
  return [...saved.values()].sort((a, b) => a.kind.localeCompare(b.kind) || a.sheetNo - b.sheetNo);
}
