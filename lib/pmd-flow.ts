import { PortalError } from "./form.ts";
import type { ChecklistItem, Escalation, HourlyEntry } from "./types.ts";

export const PROJECT_STATUS_OPTIONS = ["In Progress", "Pending", "Not Started", "On Hold", "Blocked", "Completed", "Delivered", "Closed"];

export const DSR_STATUS_OPTIONS = ["In Progress", "Completed", "Pending", "Not Started", "On Hold", "Blocked"];

export const CHECKLIST_STATUS_OPTIONS = ["Completed", "Delivered", "In Review", "Reopened"];

export const APPROVAL_OPTIONS = ["Pending", "Approved", "Rejected"];

export const ACTIVITY_PATTERN = /^(status\.|sow\.|hourly\.|allocation\.|escalation\.|checklist\.|project\.intake)/;

export type RowError = { row: number; message: string };

type HourlyShape = Pick<HourlyEntry, "project" | "task" | "status" | "hours" | "workDate"> &
  Partial<Pick<HourlyEntry, "id" | "sprint" | "resource" | "estStart" | "estimatedHours" | "targetHours" | "actualHours" | "actualEnd" | "approval" | "blocker">>;

export function isBlockedStatus(status: string | undefined) {
  return /\bblock/i.test(status ?? "");
}

export function isSettledStatus(status: string | undefined) {
  const value = (status ?? "").toLowerCase();
  return value.includes("complete") || value.includes("done") || value.includes("closed") || value.includes("delivered");
}

export function isPlanRow(row: { estimatedHours?: number | null; targetHours?: number | null; estStart?: string }) {
  return row.estimatedHours != null || row.targetHours != null || Boolean(row.estStart);
}

function norm(value: string | undefined) {
  return (value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function taskKey(project: string, task: string) {
  return `${norm(project)}::${norm(task)}`;
}

export function assertBlockerRemarks(row: { status: string; blocker?: string }) {
  if (isBlockedStatus(row.status) && !(row.blocker ?? "").trim()) throw new PortalError("Add blocker remarks when the status is Blocked.");
}

export function formatRowErrors(errors: RowError[]) {
  if (!errors.length) return "";
  const shown = errors.slice(0, 8).map((error) => `Row ${error.row}: ${error.message}`);
  const more = errors.length > 8 ? ` and ${errors.length - 8} more` : "";
  return ` ${errors.length} ${errors.length === 1 ? "row was" : "rows were"} skipped (${shown.join("; ")}${more}).`;
}

export function appendByKey<T>(current: T[], incoming: T[], key: (row: T) => string) {
  const seen = new Set(current.map(key));
  const added: T[] = [];
  let skipped = 0;
  for (const row of incoming) {
    const id = key(row);
    if (seen.has(id)) {
      skipped += 1;
      continue;
    }
    seen.add(id);
    added.push(row);
  }
  return { rows: [...current, ...added], added, skipped };
}

export function hourlyDedupeKey(row: Pick<HourlyEntry, "project" | "resource" | "task" | "sprint" | "workDate" | "hours" | "estStart" | "estimatedHours" | "targetHours">) {
  const base = [norm(row.project), norm(row.resource), norm(row.task), norm(row.sprint)];
  if (isPlanRow(row)) return ["plan", ...base, row.estStart, String(row.estimatedHours ?? ""), String(row.targetHours ?? "")].join("|");
  return ["log", ...base, row.workDate, String(row.hours)].join("|");
}

function blockerDescription(entry: HourlyShape) {
  const parts = [entry.task.trim() || "Task", entry.resource?.trim() ? `(${entry.resource.trim()})` : "", entry.workDate ? `on ${entry.workDate}` : ""].filter(Boolean);
  return `${parts.join(" ")}: ${(entry.blocker ?? "").trim()}`;
}

export type BlockerContext = { actorId: string; actorName: string; now: string; projectId: string; makeId: () => string };

export function syncBlockerEscalation(escalations: Escalation[], entry: HourlyShape & { id: string }, context: BlockerContext) {
  const existing = escalations.find((item) => item.sourceEntryId === entry.id);
  if (isBlockedStatus(entry.status)) {
    if (existing) {
      const reopened = existing.status === "resolved";
      Object.assign(existing, {
        description: blockerDescription(entry),
        projectName: entry.project,
        projectId: existing.projectId || context.projectId,
        status: reopened ? "open" : existing.status,
        updatedBy: context.actorId,
        updatedAt: context.now,
        ...(reopened ? { resolvedAt: "", resolvedBy: "" } : {}),
      });
      return { item: existing, action: reopened ? ("reopened" as const) : ("updated" as const) };
    }
    const item: Escalation = {
      id: context.makeId(),
      projectId: context.projectId,
      projectName: entry.project,
      type: "blocker",
      description: blockerDescription(entry),
      ownerName: entry.resource?.trim() || context.actorName,
      dueDate: "",
      status: "open",
      createdBy: context.actorId,
      createdAt: context.now,
      sourceEntryId: entry.id,
      resolutionNote: "",
      updatedBy: context.actorId,
      updatedAt: context.now,
    };
    escalations.unshift(item);
    return { item, action: "created" as const };
  }
  if (existing && existing.status !== "resolved") {
    existing.status = "resolved";
    existing.resolutionNote = existing.resolutionNote?.trim() || "Unblocked on the hourly tracker.";
    existing.updatedBy = context.actorId;
    existing.updatedAt = context.now;
    existing.resolvedBy = context.actorId;
    existing.resolvedAt = context.now;
    return { item: existing, action: "resolved" as const };
  }
  return { item: existing ?? null, action: "none" as const };
}

export function dsrStatusForEscalation(escalation: Pick<Escalation, "status">, currentStatus: string) {
  if (escalation.status === "resolved") return isBlockedStatus(currentStatus) ? "In Progress" : currentStatus;
  return "Blocked";
}

function hash(text: string) {
  let value = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value.toString(36);
}

export function checklistIdFor(project: string, task: string) {
  return `chk_${hash(taskKey(project, task))}`;
}

function loggedHours(row: HourlyShape) {
  return row.hours || row.actualHours || 0;
}

function plannedHours(row: HourlyShape) {
  return row.estimatedHours ?? row.targetHours ?? 0;
}

export function isTaskComplete(plans: HourlyShape[], logs: HourlyShape[]) {
  if (!plans.length || !logs.length) return false;
  if (logs.some((row) => isBlockedStatus(row.status))) return false;
  const planned = plans.reduce((sum, row) => sum + plannedHours(row), 0);
  const logged = logs.reduce((sum, row) => sum + loggedHours(row), 0);
  const latest = [...logs].sort((a, b) => (b.workDate || "").localeCompare(a.workDate || ""))[0];
  if (isSettledStatus(latest.status)) return true;
  if (planned > 0) return logged >= planned;
  return logs.every((row) => isSettledStatus(row.status));
}

export function isLoggedComplete(logs: HourlyShape[]) {
  if (!logs.length || logs.some((row) => isBlockedStatus(row.status))) return false;
  const latest = [...logs].sort((a, b) => (b.workDate || "").localeCompare(a.workDate || ""))[0];
  return isSettledStatus(latest.status);
}

export function deriveChecklist(entries: HourlyShape[], existing: ChecklistItem[], now: string): ChecklistItem[] {
  const plans = new Map<string, HourlyShape[]>();
  const logs = new Map<string, HourlyShape[]>();
  for (const row of entries) {
    if (!row.project.trim() || !row.task.trim()) continue;
    const key = taskKey(row.project, row.task);
    const bucket = isPlanRow(row) ? plans : logs;
    const list = bucket.get(key) ?? [];
    list.push(row);
    bucket.set(key, list);
  }
  const known = new Set(existing.map((item) => item.id));
  let next = existing.reduce((max, item) => Math.max(max, item.sheetNo || 0), 0);
  const created: ChecklistItem[] = [];
  for (const key of new Set([...plans.keys(), ...logs.keys()])) {
    const planned = plans.get(key) ?? [];
    const actual = logs.get(key) ?? [];
    const complete = planned.length ? isTaskComplete(planned, actual) : isLoggedComplete(actual);
    if (!complete) continue;
    const first = planned[0] ?? [...actual].sort((a, b) => (b.workDate || "").localeCompare(a.workDate || ""))[0];
    const id = checklistIdFor(first.project, first.task);
    if (known.has(id)) continue;
    known.add(id);
    next += 1;
    const completedOn = [...actual.map((row) => row.workDate), ...planned.map((row) => row.actualEnd ?? "")].filter(Boolean).sort().pop() ?? "";
    created.push({
      id,
      sheetNo: next,
      project: first.project.trim(),
      sprint: (first.sprint ?? "").trim(),
      task: first.task.trim(),
      resource: (first.resource ?? "").trim(),
      completedOn,
      status: "Completed",
      clientApproval: (first.approval ?? "").trim(),
      source: "auto",
      createdBy: "system",
      createdAt: now,
      updatedBy: "system",
      updatedAt: now,
    });
  }
  return created;
}

export function applyApprovalWriteBack(entries: HourlyShape[], item: Pick<ChecklistItem, "project" | "task" | "clientApproval">) {
  const key = taskKey(item.project, item.task);
  let changed = 0;
  for (const row of entries) {
    if (!isPlanRow(row) || taskKey(row.project, row.task) !== key) continue;
    if ((row.approval ?? "") === item.clientApproval) continue;
    row.approval = item.clientApproval;
    changed += 1;
  }
  return changed;
}

export function activityHref(action: string) {
  if (action.startsWith("status.")) return "/project-status";
  if (action.startsWith("sow.") || action.startsWith("project.intake")) return "/sow";
  if (action.startsWith("hourly.")) return "/delivery";
  if (action.startsWith("allocation.")) return "/utilization";
  if (action.startsWith("escalation.")) return "/escalations";
  if (action.startsWith("checklist.")) return "/checklist";
  return "/dashboard";
}

function csvCell(value: string | number | null | undefined) {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]) {
  return `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}
