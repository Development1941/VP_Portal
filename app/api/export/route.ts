import * as XLSX from "xlsx";
import { loadWorkspace } from "@/lib/data";
import { PortalError } from "@/lib/form";
import { isResourceAllocation } from "@/lib/hourly-sheet";
import { toCsv } from "@/lib/pmd-flow";
import { getSession } from "@/lib/session";
import { assertCanExport, type ExportKey } from "@/lib/tab-access";
import type { Workspace } from "@/lib/types";

const KINDS: Record<string, ExportKey> = { utilization: "utilization", dsr: "dsrHourlyTracker", checklist: "deliveryChecklist" };
const FILES: Record<string, string> = { utilization: "resource-allocation", dsr: "hourly-tracker", checklist: "delivery-checklist" };

type Cell = string | number | null | undefined;
type Table = { headers: string[]; rows: Cell[][]; groupBy?: number };

function table(kind: string, data: Workspace): Table {
  if (kind === "utilization") {
    const rows = data.hourlyEntries.filter(isResourceAllocation);
    return {
      headers: ["S.no", "Project", "Sprint", "Resource", "Task", "EST Start Date", "EST End Date", "Estimated Hours", "Target hours embee", "Actual Start Date", "Actual End Date", "Actual Hours", "Status", "Approval"],
      rows: rows.map((row) => [row.sheetNo || "", row.project, row.sprint, row.resource, row.task || row.notes, row.estStart, row.estEnd, row.estimatedHours, row.targetHours, row.actualStart, row.actualEnd, row.actualHours, row.status, row.approval]),
    };
  }
  if (kind === "dsr") {
    const rows = data.hourlyEntries.filter((row) => !isResourceAllocation(row));
    return {
      headers: ["S.no", "Project", "Sprint", "Resource", "Task", "Date", "Hours Spent", "Status", "Blocker", "Company"],
      rows: rows.map((row) => [row.sheetNo || "", row.project, row.sprint, row.resource, row.task || row.notes, row.workDate, row.hours, row.status, row.blocker ?? "", row.company]),
    };
  }
  const items = [...data.checklistItems].sort((a, b) => a.project.localeCompare(b.project) || (a.completedOn || "").localeCompare(b.completedOn || "") || a.sheetNo - b.sheetNo);
  return {
    headers: ["S.no", "Project", "Date of completion", "Sprint", "Task", "Resource", "Status", "Client Approval"],
    rows: items.map((row) => [row.sheetNo || "", row.project, row.completedOn, row.sprint, row.task, row.resource, row.status, row.clientApproval]),
    groupBy: 1,
  };
}

function sheetName(name: string, used: Set<string>) {
  const base = (name.replace(/[\\/?*[\]:]/g, " ").trim() || "Sheet").slice(0, 28);
  let candidate = base;
  for (let index = 2; used.has(candidate.toLowerCase()); index += 1) candidate = `${base.slice(0, 25)} ${index}`;
  used.add(candidate.toLowerCase());
  return candidate;
}

function workbook({ headers, rows, groupBy }: Table) {
  const book = XLSX.utils.book_new();
  const used = new Set<string>();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([headers, ...rows]), sheetName("All", used));
  if (groupBy != null) {
    const groups = new Map<string, Cell[][]>();
    for (const row of rows) {
      const key = String(row[groupBy] ?? "").trim() || "No project";
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    for (const [name, list] of groups) XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([headers, ...list]), sheetName(name, used));
  }
  return XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export async function GET(request: Request) {
  const user = await getSession();
  if (!user) return new Response("Sign in to export.", { status: 401 });
  const params = new URL(request.url).searchParams;
  const kind = params.get("kind") ?? "";
  const excel = params.get("format") === "xlsx";
  const tab = KINDS[kind];
  if (!tab) return new Response("Unknown export.", { status: 400 });
  try {
    assertCanExport(user, tab);
  } catch (error) {
    if (error instanceof PortalError) return new Response(error.message, { status: 403 });
    throw error;
  }
  const data = await loadWorkspace(user.id);
  const sheet = table(kind, data);
  const name = `${FILES[kind]}-${new Date().toISOString().slice(0, 10)}.${excel ? "xlsx" : "csv"}`;
  const body = excel ? new Uint8Array(workbook(sheet)) : toCsv(sheet.headers, sheet.rows);
  return new Response(body, {
    headers: {
      "Content-Type": excel ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
