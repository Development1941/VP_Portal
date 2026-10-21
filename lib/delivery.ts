import { addDays, startOfWeek } from "@/lib/dates";
import { PortalError } from "@/lib/form";
import type { Client, Project, Task, Timesheet, Workstream } from "@/lib/types";

export type IntakeRequest = {
  clientName: string;
  name: string;
  estimatedHours: number;
  startDate: string;
  dueDate: string;
  ownerId: string;
  source: Project["source"];
  summary: string;
  initiatedById: string;
  initiatedFor: string;
  initiatedFrom: string;
};

export function organizationName(client: Pick<Client, "name" | "company">) {
  return (client.company || client.name).trim();
}

export function isIntakeOwner(roleSlug: string) {
  return roleSlug === "admin" || roleSlug === "project_owner";
}

export function clientForProfile(clients: Client[], user: { fullName: string; email: string }) {
  const email = user.email.toLowerCase();
  const name = user.fullName.toLowerCase();
  const active = clients.filter((client) => client.status === "active");
  return active.find((client) => client.email.toLowerCase() === email) || active.find((client) => client.name.toLowerCase() === name);
}

export function assertIntake(input: IntakeRequest, organizations: string[]) {
  if (!input.name.trim()) throw new PortalError("Project name is required.");
  if (!input.clientName.trim()) throw new PortalError("Client name is required.");
  if (!input.startDate) throw new PortalError("Requested start date is required.");
  if (!input.dueDate) throw new PortalError("Project due date is required.");
  if (input.dueDate < input.startDate) throw new PortalError("The due date must be on or after the requested start date.");
  if (input.estimatedHours <= 0) throw new PortalError("Estimated hours must be greater than 0.");
  if (!organizations.includes(input.initiatedFrom.trim())) throw new PortalError("Choose the organization this request came from.");
}

export const REQUIREMENT_SOURCES = [
  ["requirement_document", "Requirement document"],
  ["proposal", "Proposal"],
  ["meeting_transcript", "Meeting transcript"],
  ["email_thread", "Email thread"],
] as const;

export const DELIVERY_STATUSES = [
  ["in_progress", "In progress"],
  ["done", "Done"],
  ["blocked", "Blocked"],
] as const;

export const BILLING_TERMS = [
  ["milestone", "Milestone based"],
  ["monthly_tm", "Monthly T&M"],
  ["fixed_fee", "Fixed fee"],
] as const;

export const APPROVAL_STATUSES = [
  ["signed", "Signed"],
  ["pending", "Pending"],
  ["rejected", "Rejected"],
] as const;

export const PAYMENT_STATUSES = [
  ["paid", "Paid"],
  ["partially_paid", "Partially paid"],
  ["overdue", "Overdue"],
  ["not_due", "Not due"],
] as const;

export const ESCALATION_TYPES = [
  ["blocker", "Blocker"],
  ["concern", "Concern"],
  ["dependency", "Dependency"],
] as const;

export const ESCALATION_STATUSES = [
  ["open", "Open"],
  ["in_review", "In review"],
  ["resolved", "Resolved"],
] as const;

export function sowDefaults() {
  return {
    estimatedHours: 0,
    source: "requirement_document" as const,
    sowStage: "draft" as const,
    deliveryStatus: "in_progress" as const,
    billingTerms: "milestone" as const,
    approvalStatus: "pending" as const,
    renewalDate: "",
    scope: "",
    deliverables: "",
    risks: "",
    pendingActions: "",
    deliveryOwnerId: "",
    invoicingStatus: "Not invoiced",
    paymentStatus: "not_due" as const,
    activated: false,
    sowFileName: "",
    sowFilePath: "",
    initiatedById: "",
    initiatedFor: "",
    initiatedFrom: "",
  };
}

export function keepDelivery(existing: Project, input: Project): Project {
  return {
    ...input,
    estimatedHours: existing.estimatedHours,
    source: existing.source,
    sowStage: existing.sowStage,
    deliveryStatus: existing.deliveryStatus,
    billingTerms: existing.billingTerms,
    approvalStatus: existing.approvalStatus,
    renewalDate: existing.renewalDate,
    scope: existing.scope,
    deliverables: existing.deliverables,
    risks: existing.risks,
    pendingActions: existing.pendingActions,
    deliveryOwnerId: existing.deliveryOwnerId,
    invoicingStatus: existing.invoicingStatus,
    paymentStatus: existing.paymentStatus,
    activated: existing.activated,
    sowFileName: existing.sowFileName,
    sowFilePath: existing.sowFilePath,
    initiatedById: existing.initiatedById,
    initiatedFor: existing.initiatedFor,
    initiatedFrom: existing.initiatedFrom,
  };
}

export function statusForDelivery(delivery: Project["deliveryStatus"], activated: boolean): Project["status"] {
  if (delivery === "done") return "completed";
  if (delivery === "blocked") return "on_hold";
  return activated ? "active" : "planning";
}

export function billingModelFor(terms: Project["billingTerms"]): Project["billingModel"] {
  if (terms === "monthly_tm") return "hourly";
  return "fixed";
}

export function defaultWorkstreams(): Workstream[] {
  return [
    { id: "ws_intake", name: "Project intake", ownerName: "Intake desk", targetDate: "2026-10-14", status: "in_progress" },
    { id: "ws_sow", name: "SOW management", ownerName: "Admin desk", targetDate: "2026-10-18", status: "in_progress" },
    { id: "ws_res", name: "Resource allocation", ownerName: "Project owner", targetDate: "2026-10-20", status: "in_progress" },
    { id: "ws_tasks", name: "Delivery & tasks", ownerName: "Delivery owner", targetDate: "2026-10-25", status: "blocked" },
    { id: "ws_bill", name: "Billing & utilization", ownerName: "Finance ops", targetDate: "2026-10-28", status: "in_progress" },
    { id: "ws_esc", name: "Escalations & blockers", ownerName: "VP office", targetDate: "2026-10-15", status: "done" },
  ];
}

export function hoursConsumed(projectId: string, timesheets: Pick<Timesheet, "projectId" | "hours">[], tasks: Pick<Task, "projectId" | "actualHours">[]) {
  const logged = timesheets.filter((entry) => entry.projectId === projectId).reduce((sum, entry) => sum + entry.hours, 0);
  if (logged > 0) return logged;
  return tasks.filter((task) => task.projectId === projectId).reduce((sum, task) => sum + task.actualHours, 0);
}

export function weekDays(start = startOfWeek()) {
  return [0, 1, 2, 3, 4].map((offset) => addDays(start, offset));
}

export function sourceLabel(source: Project["source"]) {
  return REQUIREMENT_SOURCES.find(([value]) => value === source)?.[1] ?? source;
}

export function handoverSections(
  project: Project,
  tasks: Pick<Task, "title" | "actualHours" | "estimatedHours">[],
  resources: string[],
  clientName: string,
  deliveryOwner: string,
  consumed: number,
) {
  const spent = tasks.reduce((sum, task) => sum + task.actualHours, 0);
  const estimated = tasks.reduce((sum, task) => sum + task.estimatedHours, 0);
  const balance = Math.max(0, project.estimatedHours - consumed);
  return [
    ["Project overview and objectives", `${clientName}: ${project.name}. Delivery owner ${deliveryOwner}.`],
    ["Current scope and deliverables", project.scope || project.deliverables || `Per SOW, ${project.startDate || "start TBC"} to ${project.endDate || "end TBC"}.`],
    ["Work completed and pending", tasks.map((task) => `${task.title} (${task.actualHours}/${task.estimatedHours}h)`).join(", ") || "No tasks yet."],
    ["Technical architecture, access and environment dependencies", "To be captured by the project owner."],
    ["Resource responsibilities and training requirements", resources.join("; ") || "Unassigned."],
    ["Timeline, milestones and blockers", project.risks || "None recorded."],
    ["Hours spent, remaining effort and SOW/billing linkage", `${spent}h spent on tasks, ${Math.max(0, estimated - spent)}h remaining on tasks; ${balance}h SOW balance; ${project.invoicingStatus}.`],
    ["Immediate next steps and support required", project.pendingActions || "None recorded."],
  ] as const;
}
