"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/data";
import { asPermissions, list, num, str, type FormState, PortalError } from "@/lib/form";
import { getSession, signIn, signOut } from "@/lib/session";
import type { Client, Feature, Milestone, Payment, Project, RateCard, Role, Task, Timesheet } from "@/lib/types";

async function run(work: () => Promise<void>, ok = "Saved."): Promise<FormState> {
  const user = await getSession();
  if (!user) return { error: "Your session expired. Sign in again." };
  try {
    await work();
    revalidatePath("/", "layout");
    return { ok };
  } catch (error) {
    if (error instanceof PortalError) {
      revalidatePath("/", "layout");
      return { error: error.message };
    }
    throw error;
  }
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

export async function saveProfileAction(_prev: FormState, form: FormData) {
  return run(async () => {
    const user = await actor();
    await db().saveProfile(user, {
      fullName: str(form, "fullName"),
      title: str(form, "title"),
      phone: str(form, "phone"),
      about: str(form, "about"),
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
      estimatedHours: num(form, "estimatedHours"),
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
      estimatedHours: 0,
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
    await db().saveTimesheet(user, input);
  }, "DSR saved.");
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
