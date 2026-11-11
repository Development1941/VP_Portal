import { loadWorkspace } from "@/lib/data";
import { PortalError } from "@/lib/form";
import { isResourceAllocation } from "@/lib/hourly-sheet";
import { toCsv } from "@/lib/pmd-flow";
import { getSession } from "@/lib/session";
import { assertCanExport, type ExportKey } from "@/lib/tab-access";
import type { Workspace } from "@/lib/types";

const KINDS: Record<string, ExportKey> = { utilization: "utilization", dsr: "dsrHourlyTracker", checklist: "deliveryChecklist" };

function sheet(kind: string, data: Workspace) {
  if (kind === "utilization") {
    const rows = data.hourlyEntries.filter(isResourceAllocation);
    return toCsv(
      ["S.no", "Project", "Sprint", "Resource", "Task", "EST Start Date", "EST End Date", "Estimated Hours", "Target hours embee", "Actual Start Date", "Actual End Date", "Actual Hours", "Status", "Approval"],
      rows.map((row) => [row.sheetNo || "", row.project, row.sprint, row.resource, row.task || row.notes, row.estStart, row.estEnd, row.estimatedHours, row.targetHours, row.actualStart, row.actualEnd, row.actualHours, row.status, row.approval]),
    );
  }
  if (kind === "dsr") {
    const rows = data.hourlyEntries.filter((row) => !isResourceAllocation(row));
    return toCsv(
      ["S.no", "Project", "Sprint", "Resource", "Task", "Date", "Hours Spent", "Status", "Blocker", "Company"],
      rows.map((row) => [row.sheetNo || "", row.project, row.sprint, row.resource, row.task || row.notes, row.workDate, row.hours, row.status, row.blocker ?? "", row.company]),
    );
  }
  return toCsv(
    ["S.no", "Date of completion", "Project", "Sprint", "Task", "Resource", "Status", "Client Approval"],
    data.checklistItems.map((row) => [row.sheetNo || "", row.completedOn, row.project, row.sprint, row.task, row.resource, row.status, row.clientApproval]),
  );
}

export async function GET(request: Request) {
  const user = await getSession();
  if (!user) return new Response("Sign in to export.", { status: 401 });
  const kind = new URL(request.url).searchParams.get("kind") ?? "";
  const tab = KINDS[kind];
  if (!tab) return new Response("Unknown export.", { status: 400 });
  try {
    assertCanExport(user, tab);
  } catch (error) {
    if (error instanceof PortalError) return new Response(error.message, { status: 403 });
    throw error;
  }
  const data = await loadWorkspace(user.id);
  const name = `${kind === "dsr" ? "hourly-tracker" : kind === "utilization" ? "resource-allocation" : "delivery-checklist"}-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(sheet(kind, data), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
