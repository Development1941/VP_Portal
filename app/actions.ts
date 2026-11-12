"use server";

import { revalidatePath } from "next/cache";
import { isCurrency } from "@/lib/currency";
import { redirect } from "next/navigation";
import { db } from "@/lib/data";  
import { parseIntakeDate } from "@/lib/dates";
import { REQUIREMENT_SOURCES, sowDefaults } from "@/lib/delivery";
import { prettyDate } from "@/lib/format";
import { asPermissions, list, num, str, type FormState, PortalError } from "@/lib/form";
import { getSession, signIn, signOut } from "@/lib/session";
import { parseHourlySheetReport } from "@/lib/hourly-sheet";
import { formatRowErrors } from "@/lib/pmd-flow";
import { parseStatusSheet } from "@/lib/status-sheet";
import { parseSowSheet } from "@/lib/sow-sheet";
import type { ChecklistItem, HourlyEntry, SowRecord, StatusUpdate } from "@/lib/types";
import type { Client, Escalation, Feature, Milestone, Payment, Project, RateCard, Role, Task, Timesheet, Workstream } from "@/lib/types";

function choice<T extends string>(form: FormData, key: string, options: readonly T[], fallback: T): T {
  const value = str(form, key);
  return (options as readonly string[]).includes(value) ? (value as T) : fallback;
}

function filesOf(form: FormData, key: string) {
  return form.getAll(key).filter((item): item is File => item instanceof File && item.size > 0);
}

async function run(work: () => Promise<void | string>, ok = "Saved."): Promise<FormState> {
  const user = await getSession();
  if (!user) return { error: "Your session expired. Sign in again." };
  try {
    const message = await work();
    revalidatePath("/", "layout");
    return { ok: message || ok };
  } catch (error) {
    if (error instanceof PortalError) {
      revalidatePath("/", "layout");
      return { error: error.message };
    }
    throw error;
  }
}

function appendMessage(result: { added: number; skipped: number; updated?: number }, noun: string, errors = "") {
  const parts = [`Added ${result.added} ${noun}${result.added === 1 ? "" : "s"}.`];
  if (result.updated) parts.push(`Updated ${result.updated} existing ${result.updated === 1 ? "row" : "rows"}.`);
  if (result.skipped > 0) parts.push(`${result.skipped} matching ${result.skipped === 1 ? "row was" : "rows were"} already there and left unchanged.`);
  return `${parts.join(" ")}${errors}`;
}

async function sheetFile(form: FormData, key: string) {
  const file = filesOf(form, key)[0];
  if (!file) throw new PortalError("Choose a CSV or Excel file.");
  if (file.size > 4 * 1024 * 1024) throw new PortalError("That file is larger than 4 MB.");
  return { bytes: Buffer.from(await file.arrayBuffer()), name: file.name };
}

function hourlyReport(file: { bytes: Buffer; name: string }) {
  const report = parseHourlySheetReport(file.bytes, file.name);
  if (!report.rows.length) throw new PortalError(`No valid rows were found.${formatRowErrors(report.errors)}`);
  return report;
}

async function actor() {
  const user = await getSession();
  if (!user) throw new PortalError("Your session expired. Sign in again.");
  return user;
}

export async function loginAction(_prev: FormState, form: FormData): Promise<FormState> {
  const presets: Record<string, [string, string]> = {
    director: ["director@embee.local", "demo123"],
    owner: ["owner@embee.local", "demo123"],
    manager: ["manav@embee.local", "demo123"],
    scrum: ["sm@embee.local", "demo123"],
    yuvraj: ["yuvraj@embee.local", "demo123"],
    client: ["rakhee@embee.local", "demo123"],
    brian: ["brian@embee.local", "demo123"],
    member: ["ishaan@embee.local", "demo123"],
  };
  const preset = presets[str(form, "preset")];
  try {
    await signIn(preset?.[0] || str(form, "email"), preset?.[1] || str(form, "password"));
  } catch (error) {
    if (error instanceof PortalError) return { error: error.message };
    throw error;
  }
  redirect("/dashboard");
}

export async function saveStudioCurrencyAction(form: FormData) {
  const user = await actor();
  const currency = str(form, "currency");
  if (!isCurrency(currency)) throw new PortalError("Choose a supported currency.");
  await db().saveStudioCurrency(user, currency);
  revalidatePath("/", "layout");
}

export async function saveProfileAction(_prev: FormState, form: FormData) {
  return run(async () => {
    const user = await actor();
    await db().saveProfile(user, {
      fullName: str(form, "fullName"),
      title: str(form, "title"),
      phone: str(form, "phone"),
      about: str(form, "about"),
      email: str(form, "email"),
      password: str(form, "password"),
    });
  }, "Profile updated.");
}

export async function saveAvatarAction(_prev: FormState, form: FormData) {
  return run(async () => {
    const user = await actor();
    const file = form.get("avatar");
    if (!(file instanceof File) || file.size === 0) throw new PortalError("Choose an image to upload.");
    if (file.size > 800_000) throw new PortalError("Keep the picture under 800 KB.");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new PortalError("Use a JPG, PNG, or WebP image.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    await db().saveAvatar(user, bytes, file.type);
  }, "Profile picture updated.");
}

export async function signOutAction() {
  await signOut();
  redirect("/login");
}

export async function saveClientAction(_prev: FormState, form: FormData) {
  return run(async () => {
    const user = await actor();
    const input: Client = {
      id: str(form, "id"),
      name: str(form, "name"),
      company: str(form, "company"),
      email: str(form, "email"),
      phone: str(form, "phone"),
      billingEmail: str(form, "billingEmail"),
      address: str(form, "address"),
      taxId: str(form, "taxId"),
      currency: str(form, "currency") || "INR",
      status: (str(form, "status") || "active") as Client["status"],
      notes: str(form, "notes"),
    };
    await db().saveClient(user, input);
  }, "Client saved.");
}

export async function saveProjectAction(_prev: FormState, form: FormData) {
  return run(async () => {
    const user = await actor();
    const input: Project = {
      id: str(form, "id"),
      clientId: str(form, "clientId"),
      name: str(form, "name"),
      code: str(form, "code"),
      description: str(form, "description"),
      status: (str(form, "status") || "planning") as Project["status"],
      billingModel: (str(form, "billingModel") || "hourly") as Project["billingModel"],
      startDate: str(form, "startDate"),
      endDate: str(form, "endDate"),
      budgetAmount: num(form, "budgetAmount"),
      currency: str(form, "currency") || "INR",
      ownerId: str(form, "ownerId"),
      ...sowDefaults(),
    };
    await db().saveProject(user, input);
  }, "Project saved.");
}

export async function saveProjectNoteAction(_prev: FormState, form: FormData) {
  return run(async () => {
    const user = await actor();
    await db().saveProjectNote(user, str(form, "projectId"), str(form, "note"));
  }, "Record saved.");
}

export async function saveMemberAction(_prev: FormState, form: FormData) {
  return run(async () => {
    const user = await actor();
    await db().saveMember(user, {
      projectId: str(form, "projectId"),
      userId: str(form, "userId"),
      memberRole: str(form, "memberRole") || "Contributor",
      billRate: num(form, "billRate"),
    });
  }, "Project team updated.");
}

export async function removeMemberAction(_prev: FormState, form: FormData) {
  return run(async () => {
    const user = await actor();
    await db().removeMember(user, str(form, "projectId"), str(form, "userId"));
  }, "Member removed.");
}

export async function saveMilestoneAction(_prev: FormState, form: FormData) {
  return run(async () => {
    const user = await actor();
    const input: Milestone = {
      id: str(form, "id"),
      projectId: str(form, "projectId"),
      name: str(form, "name"),
      description: str(form, "description"),
      dueDate: str(form, "dueDate"),
      status: (str(form, "status") || "pending") as Milestone["status"],
      amount: num(form, "amount"),
      plannedHours: num(form, "plannedHours"),
    };
    await db().saveMilestone(user, input);
  }, "Milestone saved.");
}

function sprintRows(raw: string) {
  const rows: { name: string; dueDate: string; description: string; plannedHours: number }[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const cells = line
      .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
      .map((cell) => cell.trim().replace(/^"|"$/g, ""));
    const name = cells[0] || "";
    if (!name || /^(name|sprint|milestone)$/i.test(name)) continue;
    let index = 1;
    const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(cells[index] || "") ? cells[index++] : "";
    const plannedHours = /^\d+(?:\.\d+)?$/.test(cells[index] || "") ? Number(cells[index++]) : 0;
    rows.push({ name, dueDate, plannedHours, description: cells.slice(index).join(", ") });
  }
  return rows;
}

export async function uploadSprintsAction(_prev: FormState, form: FormData) {
  return run(async () => {
    const user = await actor();
    const file = form.get("file");
    let raw = str(form, "sheet");
    if (file instanceof File && file.size > 0) {
      if (file.size > 200_000) throw new PortalError("Keep the sprint file under 200 KB.");
      raw = `${await file.text()}\n${raw}`;
    }
    const items = sprintRows(raw);
    if (!items.length) throw new PortalError("Add at least one sprint or milestone.");
    await db().uploadMilestones(user, str(form, "projectId"), items);
  }, "Sprints uploaded.");
}

export async function saveFeatureAction(_prev: FormState, form: FormData) {
  return run(async () => {
    const user = await actor();
    const input: Feature = {
      id: str(form, "id"),
      projectId: str(form, "projectId"),
      name: str(form, "name"),
      description: str(form, "description"),
      billingType: (str(form, "billingType") || "hourly") as Feature["billingType"],
      hourlyRate: num(form, "hourlyRate"),
      fixedAmount: num(form, "fixedAmount"),
      budgetHours: num(form, "budgetHours"),
      status: (str(form, "status") || "planned") as Feature["status"],
    };
    await db().saveFeature(user, input);
  }, "Feature card saved.");
}

export async function saveTaskAction(_prev: FormState, form: FormData) {
  return run(async () => {
    const user = await actor();
    const input: Task = {
      id: str(form, "id"),
      projectId: str(form, "projectId"),
      milestoneId: str(form, "milestoneId"),
      featureId: str(form, "featureId"),
      title: str(form, "title"),
      description: str(form, "description"),
      assigneeId: str(form, "assigneeId"),
      status: (str(form, "status") || "backlog") as Task["status"],
      priority: (str(form, "priority") || "medium") as Task["priority"],
      dueDate: str(form, "dueDate"),
      startDate: "",
      estimatedHours: num(form, "estimatedHours"),
      actualHours: 0,
    };
    await db().saveTask(user, input);
  }, "Task saved.");
}

export async function addWorkTaskAction(_prev: FormState, form: FormData) {
  return run(async () => {
    const user = await actor();
    const input: Task = {
      id: "",
      projectId: str(form, "projectId"),
      milestoneId: "",
      featureId: "",
      title: str(form, "title"),
      description: str(form, "description"),
      assigneeId: user.id,
      status: (["backlog", "in_progress", "review", "done"] as const).includes(str(form, "status") as Task["status"])
        ? (str(form, "status") as Task["status"])
        : "in_progress",
      priority: "medium",
      dueDate: "",
      startDate: "",
      estimatedHours: 0,
      actualHours: 0,
    };
    await db().saveTask(user, input);
  }, "Card added.");
}

export async function taskStatusAction(_prev: FormState, form: FormData) {
  return run(async () => {
    const user = await actor();
    await db().setTaskStatus(user, str(form, "id"), str(form, "status") as Task["status"]);
  }, "Task updated.");
}

export async function saveTimesheetAction(_prev: FormState, form: FormData) {
  return run(async () => {
    const user = await actor();
    const input: Timesheet = {
      id: str(form, "id"),
      userId: user.id,
      projectId: str(form, "projectId"),
      taskId: str(form, "taskId"),
      featureId: str(form, "featureId"),
      workDate: str(form, "workDate"),
      hours: num(form, "hours"),
      billable: form.get("billable") === "on" || form.get("billable") === "true",
      description: str(form, "description"),
      status: "draft",
      approvedBy: "",
      approvedAt: "",
      rejectionNote: "",
      invoiceId: "",
    };
    const saved = await db().saveTimesheet(user, input);
    return saved.overwritten
      ? `The DSR for ${prettyDate(input.workDate)} already existed and has been replaced.`
      : "DSR saved.";
  });
}

export async function deleteTimesheetAction(_prev: FormState, form: FormData) {
  return run(async () => {
    const user = await actor();
    await db().deleteTimesheet(user, str(form, "id"));
  }, "Draft removed.");
}

export async function submitTimesheetsAction(_prev: FormState, form: FormData) {
  return run(async () => {
    const user = await actor();
    await db().submitTimesheets(user, list(form, "id"));
  }, "Timesheets submitted for approval.");
}

export async function decideTimesheetAction(_prev: FormState, form: FormData) {
  return run(async () => {
    const user = await actor();
    const status = str(form, "status");
    if (status !== "approved" && status !== "rejected") throw new PortalError("Choose approve or return.");
    await db().decideTimesheet(user, str(form, "id"), status, str(form, "note"));
  }, "Timesheet updated.");
}

export async function saveRateAction(_prev: FormState, form: FormData) {
  return run(async () => {
    const user = await actor();
    const input: RateCard = {
      id: str(form, "id"),
      label: str(form, "label"),
      scope: (str(form, "scope") || "company") as RateCard["scope"],
      targetId: str(form, "targetId"),
      hourlyRate: num(form, "hourlyRate"),
      currency: str(form, "currency") || "INR",
      effectiveFrom: str(form, "effectiveFrom"),
    };
    await db().saveRate(user, input);
  }, "Rate saved.");
}

export async function createInvoiceAction(_prev: FormState, form: FormData) {
  const user = await getSession();
  if (!user) return { error: "Your session expired. Sign in again." };
  try {
    const id = await db().createInvoice(user, {
      projectId: str(form, "projectId"),
      from: str(form, "from"),
      to: str(form, "to"),
      taxRate: num(form, "taxRate"),
      notes: str(form, "notes"),
    });
    revalidatePath("/", "layout");
    redirect(`/invoices/${id}`);
  } catch (error) {
    if (error instanceof PortalError) return { error: error.message };
    throw error;
  }
}

export async function invoiceStatusAction(_prev: FormState, form: FormData) {
  return run(async () => {
    const user = await actor();
    await db().setInvoiceStatus(user, str(form, "id"), str(form, "status") === "void" ? "void" : "sent");
  }, "Invoice updated.");
}

export async function savePaymentAction(_prev: FormState, form: FormData) {
  return run(async () => {
    const user = await actor();
    const direction = str(form, "direction") === "outgoing" ? "outgoing" : "incoming";
    const input: Payment = {
      id: "",
      direction,
      clientId: direction === "incoming" ? str(form, "clientId") : "",
      userId: direction === "outgoing" ? str(form, "userId") : "",
      invoiceId: str(form, "invoiceId"),
      projectId: str(form, "projectId"),
      amount: num(form, "amount"),
      currency: str(form, "currency") || "INR",
      method: str(form, "method") || "Bank transfer",
      status: "initiated",
      reference: str(form, "reference"),
      notes: str(form, "notes"),
      createdBy: user.id,
      createdAt: "",
      paidAt: "",
    };
    await db().savePayment(user, input);
  }, "Payment initiated.");
}

export async function paymentStatusAction(_prev: FormState, form: FormData) {
  return run(async () => {
    const user = await actor();
    await db().setPaymentStatus(user, str(form, "id"), str(form, "status") as Payment["status"]);
  }, "Payment status updated.");
}

export async function saveRoleAction(_prev: FormState, form: FormData) {
  return run(async () => {
    const user = await actor();
    const input: Role = {
      id: str(form, "id"),
      name: str(form, "name"),
      slug: str(form, "slug"),
      description: str(form, "description"),
      isSystem: false,
      locked: false,
    };
    await db().saveRole(user, input);
  }, "Role saved. Set its permissions below.");
}

export async function saveGrantsAction(_prev: FormState, form: FormData) {
  return run(async () => {
    const user = await actor();
    await db().setGrants(user, str(form, "roleId"), asPermissions(list(form, "permission")));
  }, "Permissions updated. They apply on the next request.");
}

export async function saveStaffAction(_prev: FormState, form: FormData) {
  return run(async () => {
    const user = await actor();
    await db().saveStaff(user, {
      id: str(form, "id"),
      fullName: str(form, "fullName"),
      email: str(form, "email"),
      password: str(form, "password"),
      title: str(form, "title"),
      phone: str(form, "phone"),
      roleId: str(form, "roleId"),
      status: (str(form, "status") || "active") as "active" | "invited" | "inactive",
      hourlyCost: num(form, "hourlyCost"),
    });
  }, "Team member saved.");
}

export async function markReadAction(_prev: FormState, form: FormData) {
  return run(async () => {
    const user = await actor();
    await db().markNotifications(user, str(form, "id") || "all");
  }, "Notifications updated.");
}

export async function resetDemoAction() {
  const user = await getSession();
  if (!user) redirect("/login");
  try {
    await db().resetDemo(user);
  } catch (error) {
    if (error instanceof PortalError) redirect("/settings");
    throw error;
  }
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

function intakeDate(value: string, label: string) {
  try {
    return parseIntakeDate(value);
  } catch {
    throw new PortalError(`Choose a valid ${label}.`);
  }
}

export async function submitIntakeAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await getSession();
  if (!user) return { error: "Your session expired. Sign in again." };
  try {
    await db().submitIntake(
      user,
      {
        clientName: str(form, "clientName"),
        name: str(form, "name"),
        estimatedHours: num(form, "estimatedHours"),
        startDate: intakeDate(str(form, "startDate"), "requested start date"),
        dueDate: intakeDate(str(form, "dueDate"), "project due date"),
        ownerId: str(form, "ownerId"),
        source: choice(form, "source", REQUIREMENT_SOURCES.map(([value]) => value) as readonly Project["source"][], "requirement_document"),
        summary: str(form, "summary"),
        initiatedById: "",
        initiatedFor: str(form, "clientName"),
        initiatedFrom: str(form, "initiatedFrom"),
      },
      filesOf(form, "files"),
    );
  } catch (error) {
    if (error instanceof PortalError) return { error: error.message };
    throw error;
  }
  revalidatePath("/", "layout");
  redirect("/sow?intake=1");
}

export async function saveSowAction(_prev: FormState, form: FormData) {
  return run(async () => {
    const user = await actor();
    const input: Project = {
      ...sowDefaults(),
      id: str(form, "id"),
      clientId: str(form, "clientId"),
      name: str(form, "name"),
      code: "",
      description: str(form, "description"),
      status: "planning",
      billingModel: "hourly",
      startDate: str(form, "startDate"),
      endDate: str(form, "endDate"),
      budgetAmount: num(form, "budgetAmount"),
      currency: str(form, "currency") || "INR",
      ownerId: str(form, "ownerId"),
      estimatedHours: num(form, "estimatedHours"),
      billingTerms: choice(form, "billingTerms", ["milestone", "monthly_tm", "fixed_fee"] as const, "milestone"),
      approvalStatus: choice(form, "approvalStatus", ["signed", "pending", "rejected"] as const, "pending"),
      renewalDate: str(form, "renewalDate"),
      scope: str(form, "scope"),
      deliverables: str(form, "deliverables"),
      risks: str(form, "risks"),
      pendingActions: str(form, "pendingActions"),
      deliveryOwnerId: str(form, "deliveryOwnerId"),
      invoicingStatus: str(form, "invoicingStatus") || "Not invoiced",
      paymentStatus: choice(form, "paymentStatus", ["paid", "partially_paid", "overdue", "not_due"] as const, "not_due"),
    };
    await db().saveSow(user, input);
  }, "SOW saved.");
}

export async function setDeliveryStatusAction(_prev: FormState, form: FormData) {
  return run(async () => {
    const user = await actor();
    await db().setDeliveryStatus(user, str(form, "projectId"), choice(form, "deliveryStatus", ["in_progress", "done", "blocked"] as const, "in_progress"));
  }, "Status updated.");
}

export async function uploadSowAction(_prev: FormState, form: FormData) {
  return run(async () => {
    const user = await actor();
    const file = form.get("file");
    if (!(file instanceof File)) throw new PortalError("Choose a SOW PDF.");
    await db().uploadSowFile(user, str(form, "projectId"), file);
  }, "SOW PDF attached.");
}

export async function finaliseSowAction(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const user = await actor();
    await db().finaliseSow(user, str(form, "projectId"));
  } catch (error) {
    if (error instanceof PortalError) return { error: error.message };
    throw error;
  }
  revalidatePath("/", "layout");
  redirect("/utilization");
}

export async function activateProjectAction(_prev: FormState, form: FormData): Promise<FormState> {
  const projectId = str(form, "projectId");
  try {
    const user = await actor();
    await db().activateProject(user, projectId);
  } catch (error) {
    if (error instanceof PortalError) return { error: error.message };
    throw error;
  }
  revalidatePath("/", "layout");
  redirect(`/delivery?project=${projectId}`);
}

export async function saveDeliverySheetAction(_prev: FormState, form: FormData) {
  return run(async () => {
    const user = await actor();
    const projectId = str(form, "projectId");
    const ids = form.getAll("taskId").map((value) => String(value));
    const rows = ids.map((id) => ({
      id,
      title: str(form, `title:${id}`),
      assigneeId: str(form, `assignee:${id}`),
      startDate: str(form, `start:${id}`),
      dueDate: str(form, `end:${id}`),
      estimatedHours: num(form, `est:${id}`),
      actualHours: num(form, `act:${id}`),
    }));
    await db().saveDeliverySheet(user, projectId, rows);
  }, "Task sheet saved.");
}

export async function uploadAllocationAction(_prev: FormState, form: FormData): Promise<FormState> {
  return run(async () => {
    const user = await actor();
    const report = hourlyReport(await sheetFile(form, "sheet"));
    const result = await db().saveAllocationSheet(user, report.rows);
    return appendMessage(result, "allocation row", formatRowErrors(report.errors));
  });
}

export async function uploadHourlyTrackerAction(_prev: FormState, form: FormData): Promise<FormState> {
  return run(async () => {
    const user = await actor();
    const report = hourlyReport(await sheetFile(form, "sheet"));
    const result = await db().saveHourlySheet(user, report.rows);
    return appendMessage(result, "hourly row", formatRowErrors(report.errors));
  });
}

export async function saveHourlyEntryAction(_prev: FormState, form: FormData): Promise<FormState> {
  return run(async () => {
    const user = await actor();
    const optionalNum = (key: string) => {
      const raw = str(form, key);
      if (!raw) return null;
      const value = Number(raw);
      return Number.isFinite(value) ? value : null;
    };
    const input: HourlyEntry = {
      id: str(form, "id"),
      userId: user.id,
      roleName: user.roleName,
      sheetNo: num(form, "sheetNo"),
      project: str(form, "project"),
      sprint: str(form, "sprint"),
      resource: str(form, "resource"),
      task: str(form, "task"),
      workDate: str(form, "actualStart") || str(form, "workDate") || str(form, "estStart"),
      hours: optionalNum("actualHours") ?? num(form, "hours"),
      status: str(form, "status"),
      company: str(form, "company"),
      estStart: str(form, "estStart"),
      estEnd: str(form, "estEnd"),
      estimatedHours: optionalNum("estimatedHours"),
      targetHours: optionalNum("targetHours"),
      actualStart: str(form, "actualStart"),
      actualEnd: str(form, "actualEnd"),
      actualHours: optionalNum("actualHours"),
      approval: str(form, "approval"),
      notes: str(form, "task"),
      blocker: str(form, "blocker"),
    };
    await db().saveHourlyEntry(user, input);
  }, "Row saved.");
}

export async function deleteHourlyEntryAction(_prev: FormState, form: FormData): Promise<FormState> {
  return run(async () => {
    const user = await actor();
    await db().deleteHourlyEntry(user, str(form, "id"));
  }, "Row removed.");
}

export async function uploadStatusSheetAction(_prev: FormState, form: FormData): Promise<FormState> {
  return run(async () => {
    const user = await actor();
    const file = await sheetFile(form, "sheet");
    const rows = parseStatusSheet(file.bytes, file.name);
    const result = await db().saveStatusSheet(user, rows);
    return appendMessage(result, "status row");
  });
}

export async function saveStatusEntryAction(_prev: FormState, form: FormData): Promise<FormState> {
  return run(async () => {
    const user = await actor();
    const input: StatusUpdate = {
      id: str(form, "id"),
      sheetNo: num(form, "sheetNo"),
      project: str(form, "project"),
      subItem: str(form, "subItem"),
      status: str(form, "status"),
      remarks: String(form.get("remarks") ?? "").trim(),
      statusDate: str(form, "statusDate"),
      company: str(form, "company"),
    };
    await db().saveStatusEntry(user, input);
  }, "Status row saved.");
}

export async function deleteStatusEntryAction(_prev: FormState, form: FormData): Promise<FormState> {
  return run(async () => {
    const user = await actor();
    await db().deleteStatusEntry(user, str(form, "id"));
  }, "Status row removed.");
}

export async function uploadSowSheetAction(_prev: FormState, form: FormData): Promise<FormState> {
  return run(async () => {
    const user = await actor();
    const file = await sheetFile(form, "sow");
    const rows = parseSowSheet(file.bytes, file.name);
    const result = await db().saveSowSheet(user, rows);
    return appendMessage(result, "SOW row");
  });
}

export async function deleteSowRecordAction(_prev: FormState, form: FormData): Promise<FormState> {
  return run(async () => {
    const user = await actor();
    await db().deleteSowRecord(user, str(form, "id"));
  }, "SOW row removed.");
}

export async function saveChecklistAction(_prev: FormState, form: FormData): Promise<FormState> {
  return run(async () => {
    const user = await actor();
    const input: ChecklistItem = {
      id: str(form, "id"),
      sheetNo: num(form, "sheetNo"),
      project: str(form, "project"),
      sprint: str(form, "sprint"),
      task: str(form, "task"),
      resource: str(form, "resource"),
      completedOn: str(form, "completedOn"),
      status: str(form, "status"),
      clientApproval: str(form, "clientApproval"),
      source: "manual",
    };
    await db().saveChecklistItem(user, input);
  }, "Checklist row saved.");
}

export async function deleteChecklistAction(_prev: FormState, form: FormData): Promise<FormState> {
  return run(async () => {
    const user = await actor();
    await db().deleteChecklistItem(user, str(form, "id"));
  }, "Checklist row removed.");
}

export async function uploadChecklistAction(_prev: FormState, form: FormData): Promise<FormState> {
  return run(async () => {
    const user = await actor();
    const report = hourlyReport(await sheetFile(form, "sheet"));
    const result = await db().saveChecklistSheet(user, report.rows);
    return appendMessage(result, "checklist row", formatRowErrors(report.errors));
  });
}

export async function saveSowRecordAction(_prev: FormState, form: FormData): Promise<FormState> {
  return run(async () => {
    const user = await actor();
    const input: SowRecord = {
      id: str(form, "id"),
      kind: choice(form, "kind", ["status", "bid"] as const, "status"),
      sheetNo: num(form, "sheetNo"),
      project: str(form, "project"),
      sprint: str(form, "sprint"),
      link: str(form, "link"),
      signature: str(form, "signature"),
      signedOn: str(form, "signedOn"),
      changeRequest: str(form, "changeRequest"),
      company: str(form, "company"),
    };
    await db().saveSowRecord(user, input);
  }, "SOW row saved.");
}

export async function addDeliveryTaskAction(_prev: FormState, form: FormData) {
  return run(async () => {
    const user = await actor();
    const input: Task & { recordActual: boolean } = {
      id: "",
      projectId: str(form, "projectId"),
      milestoneId: "",
      featureId: "",
      title: str(form, "title") || "New task",
      description: "",
      assigneeId: str(form, "assigneeId"),
      status: "backlog",
      priority: "medium",
      dueDate: str(form, "dueDate"),
      startDate: str(form, "startDate"),
      estimatedHours: num(form, "estimatedHours"),
      actualHours: num(form, "actualHours"),
      recordActual: true,
    };
    await db().saveTask(user, input);
  }, "Task added.");
}

export async function raiseEscalationAction(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const user = await actor();
    await db().raiseEscalation(user, {
      projectId: str(form, "projectId"),
      projectName: str(form, "projectName"),
      type: choice(form, "type", ["blocker", "concern", "dependency"] as const, "blocker") satisfies Escalation["type"],
      description: str(form, "description"),
      ownerName: str(form, "ownerName"),
      dueDate: str(form, "dueDate"),
    });
  } catch (error) {
    if (error instanceof PortalError) return { error: error.message };
    throw error;
  }
  revalidatePath("/", "layout");
  redirect("/escalations");
}

export async function setEscalationStatusAction(_prev: FormState, form: FormData) {
  return run(async () => {
    const user = await actor();
    const resolving = str(form, "intent") === "resolve";
    await db().saveEscalation(user, {
      id: str(form, "id"),
      status: resolving ? "resolved" : choice(form, "status", ["open", "in_review", "resolved"] as const, "open"),
      ownerName: form.has("ownerName") ? str(form, "ownerName") : undefined,
      dueDate: form.has("dueDate") ? str(form, "dueDate") : undefined,
      resolutionNote: form.has("resolutionNote") ? str(form, "resolutionNote") : undefined,
    });
    if (resolving || str(form, "status") === "resolved") return "Escalation resolved and moved to Resolved escalations.";
  }, "Escalation updated.");
}

export async function saveWorkstreamAction(_prev: FormState, form: FormData) {
  return run(async () => {
    const user = await actor();
    await db().saveWorkstream(user, {
      id: str(form, "id"),
      ownerName: str(form, "ownerName"),
      targetDate: str(form, "targetDate"),
      status: choice(form, "status", ["in_progress", "blocked", "done"] as const, "in_progress") satisfies Workstream["status"],
    });
  }, "Workstream updated.");
}
