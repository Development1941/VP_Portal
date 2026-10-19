import fs from "fs";
import path from "path";
import { can, canApproveProject, canEditDelivery, canEditTask, canManageProject, canSeeMilestones, canSeeTeamDsr, canUploadMilestones, leadsProject, projectLeads, projectVisible } from "@/lib/access";
import { billingModelFor, defaultWorkstreams, keepDelivery, sowDefaults, statusForDelivery } from "@/lib/delivery";
import { ALL_PERMISSIONS, type PermissionKey } from "@/lib/permissions";
import { addDays, stamp, todayIso } from "@/lib/dates";
import { nid, prettyDate, roundMoney } from "@/lib/format";
import { PortalError } from "@/lib/form";
import { nextInvoiceStatus, resolveBillRate } from "@/lib/metrics";
import type {
  Client,
  Escalation,
  Feature,
  Invoice,
  Milestone,
  Payment,
  Project,
  ProjectFile,
  RateCard,
  Role,
  SessionUser,
  Task,
  Timesheet,
  Workspace,
  Workstream,
} from "@/lib/types";
import { buildSeed, type DemoStore, type DemoUser } from "@/lib/demo/seed";

const filePath = path.join(process.cwd(), ".data", "store.json");
let queue: Promise<unknown> = Promise.resolve();

function read(): DemoStore {
  if (!fs.existsSync(filePath)) {
    const seed = buildSeed();
    write(seed);
    return seed;
  }
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as DemoStore;
  if (!parsed.users || !parsed.roles) return buildSeed();
  return hydrate(parsed);
}

function hydrate(store: DemoStore): DemoStore {
  store.projects = (store.projects ?? []).map((project) => ({ ...sowDefaults(), ...project }));
  store.tasks = (store.tasks ?? []).map((task) => ({ ...task, startDate: task.startDate || "", actualHours: task.actualHours || 0 }));
  store.escalations = store.escalations ?? [];
  store.files = store.files ?? [];
  store.workstreams = store.workstreams?.length ? store.workstreams : defaultWorkstreams();
  return store;
}

function write(store: DemoStore) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temp = `${filePath}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(store, null, 2));
  fs.renameSync(temp, filePath);
}

function mutate<T>(fn: (store: DemoStore) => T): Promise<T> {
  const run = queue.then(() => {
    const store = read();
    const result = fn(store);
    write(store);
    return result;
  });
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function roleName(store: DemoStore, roleId: string) {
  return store.roles.find((role) => role.id === roleId);
}

export function toSession(store: DemoStore, user: DemoUser): SessionUser {
  const role = roleName(store, user.roleId);
  if (!role) throw new PortalError("This account has no role.");
  const permissions = role.locked
    ? ALL_PERMISSIONS
    : store.grants.filter((grant) => grant.roleId === role.id).map((grant) => grant.permission);
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    title: user.title,
    phone: user.phone,
    roleId: role.id,
    roleName: role.name,
    roleSlug: role.slug,
    permissions,
    status: user.status,
    avatarUrl: user.avatarUrl ?? "",
    about: user.about ?? "",
  };
}

function directory(store: DemoStore, viewer: SessionUser): Workspace["users"] {
  const showCost = can(viewer, "team.manage") || can(viewer, "reports.financial") || can(viewer, "payments.manage") || can(viewer, "reports.project");
  return store.users.map((user) => ({
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    title: user.title,
    phone: user.phone,
    roleId: user.roleId,
    roleName: user.roleName,
    roleSlug: user.roleSlug,
    status: user.status,
    hourlyCost: showCost ? user.hourlyCost : 0,
  }));
}

function audit(store: DemoStore, actor: SessionUser, action: string, entity: string, entityId: string, summary: string) {
  store.audit.unshift({ id: nid("au"), actorId: actor.id, action, entity, entityId, summary, createdAt: stamp() });
}

function notify(store: DemoStore, userId: string, title: string, body: string, href: string) {
  if (!userId) return;
  store.notifications.unshift({ id: nid("nt"), userId, title, body, href, read: false, createdAt: stamp() });
}

function requireProject(store: DemoStore, projectId: string) {
  const project = store.projects.find((item) => item.id === projectId);
  if (!project) throw new PortalError("That project was not found.");
  return project;
}

function visibleIds(store: DemoStore, user: SessionUser) {
  return new Set(store.projects.filter((project) => projectVisible(user, project, store.members)).map((project) => project.id));
}

export function sessionById(id: string) {
  const store = read();
  const user = store.users.find((item) => item.id === id && item.status === "active");
  return user ? toSession(store, user) : null;
}

export function demoAuthenticate(email: string, password: string) {
  const store = read();
  const user = store.users.find((item) => item.email.toLowerCase() === email.toLowerCase());
  if (!user || user.password !== password) return null;
  if (user.status !== "active") throw new PortalError("This account is not active.");
  return toSession(store, user);
}

export async function workspace(user: SessionUser): Promise<Workspace> {
  const store = read();
  const ids = visibleIds(store, user);
  const seeClients = can(user, "clients.view");
  const seeMoney = can(user, "invoices.view") || can(user, "reports.financial");
  const seePayments = can(user, "payments.view");
  const seeRates = can(user, "billing.rates");
  const seeAudit = can(user, "audit.view");
  const projects = store.projects.filter((project) => ids.has(project.id));
  const clientIds = new Set(projects.map((project) => project.clientId));
  return {
    users: directory(store, user),
    roles: can(user, "settings.manage") || can(user, "team.manage") ? store.roles : store.roles.filter((role) => role.id === user.roleId),
    grants: can(user, "settings.manage") ? store.grants : [],
    clients: seeClients ? store.clients.filter((client) => can(user, "projects.view_all") || clientIds.has(client.id)) : [],
    projects,
    members: store.members.filter((member) => ids.has(member.projectId)),
    milestones: store.milestones.filter((item) => {
      if (!ids.has(item.projectId)) return false;
      const project = projects.find((entry) => entry.id === item.projectId);
      return Boolean(project && canSeeMilestones(user, project, store.members));
    }),
    features: store.features.filter((item) => ids.has(item.projectId)),
    tasks: store.tasks.filter((item) => ids.has(item.projectId)),
    timesheets: store.timesheets.filter((item) => {
      const project = projects.find((entry) => entry.id === item.projectId);
      if (!project) return false;
      return item.userId === user.id || canSeeTeamDsr(user, project);
    }),
    rates: seeRates ? store.rates : [],
    invoices: seeMoney ? store.invoices.filter((item) => ids.has(item.projectId)) : [],
    lines: seeMoney ? store.lines.filter((line) => store.invoices.some((invoice) => invoice.id === line.invoiceId && ids.has(invoice.projectId))) : [],
    payments: seePayments ? store.payments.filter((item) => !item.projectId || ids.has(item.projectId) || can(user, "projects.view_all")) : [],
    notifications: store.notifications.filter((item) => item.userId === user.id),
    audit: seeAudit ? store.audit : [],
    escalations: (store.escalations ?? []).filter((item) => ids.has(item.projectId)),
    files: (store.files ?? []).filter((item) => ids.has(item.projectId)),
    workstreams: store.workstreams ?? [],
  };
}

function syncRoles(store: DemoStore) {
  for (const user of store.users) {
    const role = roleName(store, user.roleId);
    if (!role) continue;
    user.roleName = role.name;
    user.roleSlug = role.slug;
  }
}

export function saveClient(user: SessionUser, input: Client) {
  if (!can(user, "clients.manage")) throw new PortalError("You cannot edit clients.");
  if (!input.name || !input.company) throw new PortalError("Client name and company are required.");
  return mutate((store) => {
    const existing = store.clients.find((client) => client.id === input.id);
    if (existing) Object.assign(existing, input);
    else store.clients.unshift({ ...input, id: input.id || nid("cli") });
    audit(store, user, "client.save", "client", input.id, `Saved client ${input.company}.`);
  });
}

export function saveProject(user: SessionUser, input: Project) {
  if (!can(user, "projects.manage")) throw new PortalError("You cannot edit projects.");
  if (!input.name || !input.clientId) throw new PortalError("Project name and client are required.");
  return mutate((store) => {
    if (!can(user, "projects.view_all")) input.ownerId = user.id;
    const existing = store.projects.find((project) => project.id === input.id);
    if (existing) {
      if (!canManageProject(user, existing)) throw new PortalError("You can edit only projects you own.");
      Object.assign(existing, keepDelivery(existing, input));
    } else {
      const id = input.id || nid("prj");
      store.projects.unshift({ ...sowDefaults(), ...input, id });
      if (!store.members.some((member) => member.projectId === id && member.userId === input.ownerId)) {
        store.members.push({ projectId: id, userId: input.ownerId, memberRole: "Owner", billRate: 0 });
      }
    }
    audit(store, user, "project.save", "project", input.id, `Saved project ${input.name}.`);
  });
}

export function saveMember(user: SessionUser, input: { projectId: string; userId: string; memberRole: string; billRate: number }) {
  return mutate((store) => {
    const project = requireProject(store, input.projectId);
    if (!canManageProject(user, project)) throw new PortalError("You cannot change this project team.");
    if (!input.userId) throw new PortalError("Choose a team member.");
    const existing = store.members.find((member) => member.projectId === input.projectId && member.userId === input.userId);
    if (existing) Object.assign(existing, input);
    else store.members.push(input);
    audit(store, user, "project.member", "project", input.projectId, "Updated project membership.");
  });
}

export function removeMember(user: SessionUser, projectId: string, memberId: string) {
  return mutate((store) => {
    const project = requireProject(store, projectId);
    if (!canManageProject(user, project)) throw new PortalError("You cannot change this project team.");
    if (memberId === project.ownerId) throw new PortalError("Assign another owner before removing the current owner.");
    store.members = store.members.filter((member) => !(member.projectId === projectId && member.userId === memberId));
    audit(store, user, "project.member.remove", "project", projectId, "Removed a project member.");
  });
}

function tellLeads(store: DemoStore, user: SessionUser, project: Project, title: string, body: string) {
  for (const lead of projectLeads(project, store.members)) {
    if (lead === user.id) continue;
    notify(store, lead, title, body, `/projects/${project.id}`);
  }
}

export function saveMilestone(user: SessionUser, input: Milestone) {
  return mutate((store) => {
    const project = requireProject(store, input.projectId);
    if (!canUploadMilestones(user, project, store.members)) throw new PortalError("You cannot edit milestones.");
    if (!input.name) throw new PortalError("Milestone name is required.");
    if (!(input.plannedHours > 0)) throw new PortalError("Allocate the expected hours for this sprint.");
    const existing = store.milestones.find((item) => item.id === input.id);
    if (existing) Object.assign(existing, input);
    else {
      store.milestones.unshift({ ...input, id: nid("ms") });
      tellLeads(store, user, project, "Sprint uploaded", `${user.fullName} uploaded “${input.name}” on ${project.name}.`);
    }
    audit(store, user, "milestone.save", "milestone", input.id, `Saved milestone ${input.name}.`);
  });
}

export function uploadMilestones(user: SessionUser, projectId: string, items: { name: string; dueDate: string; description: string; plannedHours: number }[]) {
  return mutate((store) => {
    const project = requireProject(store, projectId);
    if (!canUploadMilestones(user, project, store.members)) throw new PortalError("You cannot upload sprints.");
    const names = items.map((item) => item.name.trim()).filter(Boolean);
    if (!names.length) throw new PortalError("Add at least one sprint or milestone.");
    if (items.some((item) => item.name.trim() && !(item.plannedHours > 0))) throw new PortalError("Each sprint needs allocated hours.");
    for (const item of items) {
      if (!item.name.trim()) continue;
      store.milestones.unshift({
        id: nid("ms"),
        projectId,
        name: item.name.trim(),
        description: item.description,
        dueDate: item.dueDate,
        status: "pending",
        amount: 0,
        plannedHours: item.plannedHours,
      });
    }
    tellLeads(store, user, project, "Sprints uploaded", `${user.fullName} uploaded ${names.length} sprint${names.length === 1 ? "" : "s"} on ${project.name}.`);
    audit(store, user, "milestone.upload", "project", projectId, `Uploaded ${names.length} sprints on ${project.name}.`);
  });
}

export function saveFeature(user: SessionUser, input: Feature) {
  return mutate((store) => {
    const project = requireProject(store, input.projectId);
    if (!canManageProject(user, project) || (!can(user, "billing.features") && !can(user, "tasks.manage"))) {
      throw new PortalError("You cannot edit feature cards.");
    }
    if (!input.name) throw new PortalError("Feature name is required.");
    const existing = store.features.find((item) => item.id === input.id);
    if (existing) Object.assign(existing, input);
    else store.features.unshift({ ...input, id: nid("ft") });
    audit(store, user, "feature.save", "feature", input.id, `Saved feature ${input.name}.`);
  });
}

export function saveTask(user: SessionUser, input: Task & { recordActual?: boolean }) {
  return mutate((store) => {
    const project = requireProject(store, input.projectId);
    const managing = can(user, "tasks.manage") && canManageProject(user, project);
    const selfServe =
      !input.id &&
      input.assigneeId === user.id &&
      (["backlog", "in_progress", "review", "done"] as const).includes(input.status) &&
      can(user, "tasks.view") &&
      projectVisible(user, project, store.members);
    if (!managing && !selfServe) throw new PortalError("You cannot add that task.");
    if (!input.title) throw new PortalError("Task title is required.");
    const existing = store.tasks.find((item) => item.id === input.id);
    if (existing) {
      Object.assign(existing, input.recordActual ? input : { ...input, startDate: existing.startDate, actualHours: existing.actualHours });
    } else store.tasks.unshift({ ...input, id: nid("tk"), startDate: input.startDate || "", actualHours: input.actualHours || 0 });
    const assignee = store.users.find((person) => person.id === input.assigneeId);
    if (assignee && assignee.id !== user.id) {
      notify(store, assignee.id, "Task assigned", `${input.title} on ${project.name}.`, `/projects/${project.id}`);
    }
    audit(store, user, "task.save", "task", input.id, `Saved task ${input.title}.`);
  });
}

export function setTaskStatus(user: SessionUser, taskId: string, status: Task["status"]) {
  return mutate((store) => {
    const task = store.tasks.find((item) => item.id === taskId);
    if (!task) throw new PortalError("That task was not found.");
    const project = requireProject(store, task.projectId);
    if (!canEditTask(user, task, project)) throw new PortalError("You cannot update this task.");
    const previous = task.status;
    task.status = status;
    if (status === "done" && previous !== "done") {
      for (const lead of projectLeads(project, store.members)) {
        if (lead === user.id) continue;
        notify(store, lead, "Task done", `${user.fullName} moved “${task.title}” to Done on ${project.name}.`, "/work");
      }
    }
    audit(store, user, "task.status", "task", task.id, `Set “${task.title}” to ${status.replaceAll("_", " ")}.`);
  });
}

function assertTimesheet(input: Timesheet) {
  if (!input.projectId || !input.workDate) throw new PortalError("Project and date are required.");
  if (input.hours <= 0 || input.hours > 24) throw new PortalError("Hours must be greater than 0 and at most 24.");
}

export function saveTimesheet(user: SessionUser, input: Timesheet) {
  if (user.roleSlug === "director") throw new PortalError("The director reads DSR. They do not file one.");
  if (!can(user, "timesheets.submit")) throw new PortalError("You cannot submit timesheets.");
  assertTimesheet(input);
  return mutate((store) => {
    const project = requireProject(store, input.projectId);
    if (!projectVisible(user, project, store.members)) throw new PortalError("You are not on this project.");
    const existing = store.timesheets.find((item) => item.id === input.id);
    if (existing) {
      if (existing.userId !== user.id) throw new PortalError("You can edit only your own logs.");
      if (existing.status !== "draft" && existing.status !== "rejected") throw new PortalError("Approved time is locked.");
      Object.assign(existing, { ...input, userId: user.id, status: "draft", invoiceId: "", approvedBy: "", approvedAt: "", rejectionNote: "" });
    } else {
      store.timesheets.unshift({
        ...input,
        id: nid("ts"),
        userId: user.id,
        status: "draft",
        approvedBy: "",
        approvedAt: "",
        rejectionNote: "",
        invoiceId: "",
      });
    }
    for (const lead of projectLeads(project, store.members)) {
      if (lead === user.id) continue;
      notify(store, lead, "DSR filled", `${user.fullName} filled DSR on ${prettyDate(input.workDate)} for ${project.name}.`, `/timesheets?project=${project.id}`);
    }
    audit(store, user, "timesheet.save", "timesheet", input.id, `Logged ${input.hours}h on ${project.name}.`);
  });
}

export function deleteTimesheet(user: SessionUser, id: string) {
  return mutate((store) => {
    const entry = store.timesheets.find((item) => item.id === id);
    if (!entry) throw new PortalError("That log was not found.");
    if (entry.userId !== user.id || (entry.status !== "draft" && entry.status !== "rejected")) {
      throw new PortalError("Only a draft or returned log can be removed.");
    }
    store.timesheets = store.timesheets.filter((item) => item.id !== id);
    audit(store, user, "timesheet.delete", "timesheet", id, "Removed a draft timesheet.");
  });
}

export function submitTimesheets(user: SessionUser, ids: string[]) {
  return mutate((store) => {
    const entries = store.timesheets.filter((item) => ids.includes(item.id));
    if (!entries.length) throw new PortalError("Nothing in draft to submit.");
    for (const entry of entries) {
      if (entry.userId !== user.id || (entry.status !== "draft" && entry.status !== "rejected")) {
        throw new PortalError("You can submit only your draft or returned logs.");
      }
      entry.status = "submitted";
      entry.rejectionNote = "";
      const project = requireProject(store, entry.projectId);
      notify(store, project.ownerId, "Timesheet submitted", `${user.fullName} submitted ${entry.hours}h on ${project.name}.`, "/timesheets");
    }
    audit(store, user, "timesheet.submit", "timesheet", ids[0] ?? "", `Submitted ${entries.length} timesheet${entries.length === 1 ? "" : "s"}.`);
  });
}

export function decideTimesheet(user: SessionUser, id: string, status: "approved" | "rejected", note: string) {
  return mutate((store) => {
    const entry = store.timesheets.find((item) => item.id === id);
    if (!entry) throw new PortalError("That log was not found.");
    const project = requireProject(store, entry.projectId);
    if (!canApproveProject(user, project)) throw new PortalError("You cannot decide time on this project.");
    if (entry.status !== "submitted") throw new PortalError("Only submitted time can be decided.");
    if (entry.userId === user.id) throw new PortalError("Ask another owner to decide your own time.");
    entry.status = status;
    entry.approvedBy = user.id;
    entry.approvedAt = stamp();
    entry.rejectionNote = status === "rejected" ? note : "";
    notify(
      store,
      entry.userId,
      status === "approved" ? "Timesheet approved" : "Timesheet returned",
      status === "approved" ? `${entry.hours}h on ${project.name} was approved.` : note || `Hours on ${project.name} were returned.`,
      "/timesheets",
    );
    audit(store, user, `timesheet.${status}`, "timesheet", id, `${status === "approved" ? "Approved" : "Returned"} a timesheet on ${project.name}.`);
  });
}

export function saveRate(user: SessionUser, input: RateCard) {
  if (!can(user, "billing.rates")) throw new PortalError("You cannot manage rates.");
  if (!input.label || input.hourlyRate < 0) throw new PortalError("A rate needs a label and an amount.");
  return mutate((store) => {
    const existing = store.rates.find((rate) => rate.id === input.id);
    if (existing) Object.assign(existing, input);
    else store.rates.unshift({ ...input, id: nid("rate") });
    audit(store, user, "rate.save", "rate", input.id, `Saved rate ${input.label}.`);
  });
}

export function createInvoice(
  user: SessionUser,
  input: { projectId: string; from: string; to: string; taxRate: number; notes: string },
) {
  if (!can(user, "invoices.manage")) throw new PortalError("You cannot generate invoices.");
  return mutate((store) => {
    const project = requireProject(store, input.projectId);
    if (!projectVisible(user, project, store.members)) throw new PortalError("That project is outside your access.");
    const entries = store.timesheets.filter(
      (item) =>
        item.projectId === project.id &&
        item.status === "approved" &&
        item.billable &&
        !item.invoiceId &&
        item.workDate >= input.from &&
        item.workDate <= input.to,
    );
    if (!entries.length) throw new PortalError("No approved billable hours are waiting in that range.");
    const invoiceId = nid("inv");
    const groups = new Map<string, Timesheet[]>();
    for (const entry of entries) {
      const key = entry.featureId || "none";
      groups.set(key, [...(groups.get(key) ?? []), entry]);
    }
    const lines: Workspace["lines"] = [];
    for (const [featureId, group] of groups) {
      const feature = store.features.find((item) => item.id === featureId);
      const logged = group.reduce((sum, entry) => sum + entry.hours, 0);
      const rate =
        feature?.billingType === "fixed"
          ? 0
          : feature?.hourlyRate || resolveBillRate(group[0], store.features, store.members, store.rates, store.users);
      const amount = feature?.billingType === "fixed" ? feature.fixedAmount : roundMoney(logged * rate);
      lines.push({
        id: nid("ln"),
        invoiceId,
        featureId: featureId === "none" ? "" : featureId,
        description: feature?.name || "Unassigned work",
        hours: roundMoney(logged),
        rate,
        amount,
      });
      for (const entry of group) entry.invoiceId = invoiceId;
    }
    const year = new Date().getFullYear();
    const number = `INV-${year}-${String(store.invoices.length + 18).padStart(3, "0")}`;
    const invoice: Invoice = {
      id: invoiceId,
      number,
      clientId: project.clientId,
      projectId: project.id,
      issueDate: todayIso(),
      dueDate: addDays(todayIso(), 15),
      status: "draft",
      taxRate: input.taxRate,
      notes: input.notes,
      createdBy: user.id,
    };
    store.invoices.unshift(invoice);
    store.lines.push(...lines);
    notify(store, user.id, "Invoice drafted", `${number} was created for ${project.name}.`, `/invoices/${invoiceId}`);
    audit(store, user, "invoice.create", "invoice", invoiceId, `Drafted ${number} from approved hours.`);
    return invoiceId;
  });
}

export function setInvoiceStatus(user: SessionUser, id: string, status: "sent" | "void") {
  if (!can(user, "invoices.manage")) throw new PortalError("You cannot update invoices.");
  return mutate((store) => {
    const invoice = store.invoices.find((item) => item.id === id);
    if (!invoice) throw new PortalError("That invoice was not found.");
    if (status === "void") {
      const settled = store.payments.some((payment) => payment.invoiceId === id && payment.status === "completed");
      if (settled) throw new PortalError("Void is blocked because a completed receipt is linked.");
      for (const entry of store.timesheets) if (entry.invoiceId === id) entry.invoiceId = "";
      invoice.status = "void";
    } else {
      invoice.status = nextInvoiceStatus({ ...invoice, status: "sent" }, store.lines, store.payments);
    }
    audit(store, user, "invoice.status", "invoice", id, `Marked ${invoice.number} ${invoice.status}.`);
  });
}

function syncInvoice(store: DemoStore, invoiceId: string) {
  const invoice = store.invoices.find((item) => item.id === invoiceId);
  if (!invoice || invoice.status === "void") return;
  invoice.status = nextInvoiceStatus(invoice, store.lines, store.payments);
}

export function savePayment(user: SessionUser, input: Payment) {
  if (!can(user, "payments.manage")) throw new PortalError("You cannot initiate payments.");
  if (input.amount <= 0) throw new PortalError("Amount must be greater than zero.");
  if (input.direction === "incoming" && !input.clientId) throw new PortalError("Choose the client who is paying.");
  if (input.direction === "outgoing" && !input.userId) throw new PortalError("Choose the team member being paid.");
  return mutate((store) => {
    const payment: Payment = {
      ...input,
      id: nid("pay"),
      status: "initiated",
      reference: input.reference || `RCPT-${store.payments.length + 100}`,
      createdBy: user.id,
      createdAt: stamp(),
      paidAt: "",
    };
    store.payments.unshift(payment);
    if (payment.invoiceId) syncInvoice(store, payment.invoiceId);
    const who = payment.direction === "incoming" ? "client receipt" : "team payout";
    notify(store, user.id, "Payment initiated", `${payment.reference} is an initiated ${who}.`, "/payments");
    audit(store, user, "payment.initiate", "payment", payment.id, `Initiated ${payment.reference} for ${payment.amount}.`);
  });
}

export function setPaymentStatus(user: SessionUser, id: string, status: Payment["status"]) {
  if (!can(user, "payments.manage")) throw new PortalError("You cannot update payments.");
  return mutate((store) => {
    const payment = store.payments.find((item) => item.id === id);
    if (!payment) throw new PortalError("That payment was not found.");
    payment.status = status;
    payment.paidAt = status === "completed" ? todayIso() : "";
    if (payment.invoiceId) syncInvoice(store, payment.invoiceId);
    if (payment.userId) {
      notify(store, payment.userId, "Payout updated", `${payment.reference} is now ${status}.`, "/notifications");
    }
    audit(store, user, "payment.status", "payment", id, `Set ${payment.reference} to ${status}.`);
  });
}

export function saveRole(user: SessionUser, input: Role) {
  if (!can(user, "settings.manage")) throw new PortalError("You cannot manage roles.");
  if (!input.name) throw new PortalError("Role name is required.");
  return mutate((store) => {
    const slug = (input.slug || input.name).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    const existing = store.roles.find((role) => role.id === input.id);
    if (existing) {
      if (existing.locked) throw new PortalError("The director role stays locked so the studio always has a super admin.");
      existing.name = input.name;
      existing.description = input.description;
    } else {
      if (store.roles.some((role) => role.slug === slug)) throw new PortalError("A role with that name already exists.");
      store.roles.push({ ...input, id: nid("role"), slug, isSystem: false, locked: false });
    }
    syncRoles(store);
    audit(store, user, "role.save", "role", input.id, `Saved role ${input.name}.`);
  });
}

export function setGrants(user: SessionUser, roleId: string, permissions: PermissionKey[]) {
  if (!can(user, "settings.manage")) throw new PortalError("You cannot change permissions.");
  return mutate((store) => {
    const role = store.roles.find((item) => item.id === roleId);
    if (!role) throw new PortalError("That role was not found.");
    if (role.locked) throw new PortalError("Director permissions stay fully enabled.");
    store.grants = store.grants.filter((grant) => grant.roleId !== roleId);
    for (const permission of permissions) store.grants.push({ roleId, permission });
    audit(store, user, "role.grants", "role", roleId, `Updated permissions for ${role.name}.`);
  });
}

export function saveStaff(
  user: SessionUser,
  input: { id: string; fullName: string; email: string; password: string; title: string; phone: string; roleId: string; status: DemoUser["status"]; hourlyCost: number },
) {
  if (!can(user, "team.manage")) throw new PortalError("You cannot manage the team.");
  if (!input.fullName || !input.email) throw new PortalError("Name and email are required.");
  return mutate((store) => {
    const role = roleName(store, input.roleId);
    if (!role) throw new PortalError("Choose a role.");
    const duplicate = store.users.find((person) => person.email.toLowerCase() === input.email.toLowerCase() && person.id !== input.id);
    if (duplicate) throw new PortalError("That email is already in use.");
    const existing = store.users.find((person) => person.id === input.id);
    if (existing) {
      if (existing.id === user.id && existing.roleId !== input.roleId) throw new PortalError("You cannot change your own role.");
      existing.fullName = input.fullName;
      existing.email = input.email.toLowerCase();
      existing.title = input.title;
      existing.phone = input.phone;
      existing.roleId = input.roleId;
      existing.roleName = role.name;
      existing.roleSlug = role.slug;
      existing.status = input.status;
      existing.hourlyCost = input.hourlyCost;
      if (input.password) existing.password = input.password;
    } else {
      if (input.password.length < 6) throw new PortalError("A new member needs a password of at least 6 characters.");
      store.users.push({
        id: nid("usr"),
        fullName: input.fullName,
        email: input.email.toLowerCase(),
        password: input.password,
        title: input.title,
        phone: input.phone,
        roleId: role.id,
        roleName: role.name,
        roleSlug: role.slug,
        status: input.status,
        hourlyCost: input.hourlyCost,
      });
    }
    audit(store, user, "team.save", "user", input.id, `Saved team member ${input.fullName}.`);
  });
}

export function saveProfile(user: SessionUser, input: { fullName: string; title: string; phone: string; about: string }) {
  if (!input.fullName.trim()) throw new PortalError("Name is required.");
  return mutate((store) => {
    const person = store.users.find((item) => item.id === user.id);
    if (!person) throw new PortalError("That profile was not found.");
    person.fullName = input.fullName.trim();
    person.title = input.title.trim();
    person.phone = input.phone.trim();
    person.about = input.about.trim();
    audit(store, user, "profile.save", "user", user.id, "Updated their profile.");
  });
}

export function saveAvatar(user: SessionUser, bytes: Uint8Array, contentType: string) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(contentType)) throw new PortalError("Use a JPG, PNG, or WebP image.");
  const dataUrl = `data:${contentType};base64,${Buffer.from(bytes).toString("base64")}`;
  return mutate((store) => {
    const person = store.users.find((item) => item.id === user.id);
    if (!person) throw new PortalError("That profile was not found.");
    person.avatarUrl = dataUrl;
    audit(store, user, "profile.avatar", "user", user.id, "Updated their profile picture.");
  });
}

export function saveProjectNote(user: SessionUser, projectId: string, note: string) {
  const text = note.trim();
  if (text.length < 3) throw new PortalError("Write a short record of what changed.");
  if (text.length > 500) throw new PortalError("Keep the record under 500 characters.");
  return mutate((store) => {
    const project = requireProject(store, projectId);
    if (!projectVisible(user, project, store.members)) throw new PortalError("That project is outside your access.");
    audit(store, user, "project.note", "project", projectId, text);
    tellLeads(store, user, project, "Project record", `${user.fullName} recorded a note on ${project.name}.`);
  });
}

export function projectLog(user: SessionUser, projectId: string) {
  const store = read();
  const project = requireProject(store, projectId);
  if (!projectVisible(user, project, store.members)) throw new PortalError("That project is outside your access.");
  const ids = new Set<string>([
    projectId,
    ...store.milestones.filter((item) => item.projectId === projectId).map((item) => item.id),
    ...store.tasks.filter((item) => item.projectId === projectId).map((item) => item.id),
  ]);
  return store.audit.filter((entry) => ids.has(entry.entityId)).slice(0, 40);
}

export function markNotifications(user: SessionUser, id: string) {
  return mutate((store) => {
    for (const item of store.notifications) {
      if (item.userId === user.id && (id === "all" || item.id === id)) item.read = true;
    }
  });
}

function rememberFile(store: DemoStore, user: SessionUser, projectId: string, kind: ProjectFile["kind"], file: File) {
  if (!file || file.size === 0) return;
  store.files.unshift({
    id: nid("file"),
    projectId,
    kind,
    fileName: file.name,
    createdBy: user.id,
    createdAt: stamp(),
  });
}

export async function submitIntake(
  user: SessionUser,
  input: { clientName: string; name: string; estimatedHours: number; startDate: string; ownerId: string; source: Project["source"]; summary: string },
  files: File[],
) {
  if (!can(user, "projects.manage")) throw new PortalError("You cannot submit a project intake.");
  if (!input.name.trim()) throw new PortalError("Project name is required.");
  let projectId = "";
  await mutate((store) => {
    const company = input.clientName.trim();
    if (!company) throw new PortalError("Client name is required.");
    let client = store.clients.find((item) => item.company.toLowerCase() === company.toLowerCase() || item.name.toLowerCase() === company.toLowerCase());
    if (!client) {
      client = { id: nid("cli"), name: company, company, email: "", phone: "", billingEmail: "", address: "", taxId: "", currency: "INR", status: "active", notes: "" };
      store.clients.unshift(client);
    }
    const ownerId = can(user, "projects.view_all") ? input.ownerId || user.id : user.id;
    projectId = nid("prj");
    store.projects.unshift({
      ...sowDefaults(),
      id: projectId,
      clientId: client.id,
      name: input.name.trim(),
      code: input.name.trim().replace(/\s+/g, "-").slice(0, 16).toUpperCase(),
      description: input.summary.trim(),
      status: "planning",
      billingModel: "hourly",
      startDate: input.startDate,
      endDate: "",
      budgetAmount: 0,
      currency: "INR",
      ownerId,
      estimatedHours: input.estimatedHours,
      source: input.source,
    });
    store.members.push({ projectId, userId: ownerId, memberRole: "Owner", billRate: 0 });
    for (const file of files) rememberFile(store, user, projectId, "requirement", file);
    audit(store, user, "project.intake", "project", projectId, `Submitted intake ${input.name.trim()}.`);
  });
  return projectId;
}

export function saveSow(user: SessionUser, input: Project) {
  return mutate((store) => {
    const existing = requireProject(store, input.id);
    if (!projectVisible(user, existing, store.members)) throw new PortalError("That project is outside your access.");
    if (!canManageProject(user, existing) && !can(user, "projects.view_all")) throw new PortalError("You cannot finalise this SOW.");
    Object.assign(existing, {
      name: input.name,
      clientId: input.clientId,
      description: input.description,
      budgetAmount: input.budgetAmount,
      billingTerms: input.billingTerms,
      billingModel: billingModelFor(input.billingTerms),
      startDate: input.startDate,
      endDate: input.endDate,
      approvalStatus: input.approvalStatus,
      renewalDate: input.renewalDate,
      scope: input.scope,
      deliverables: input.deliverables,
      risks: input.risks,
      pendingActions: input.pendingActions,
      ownerId: input.ownerId || existing.ownerId,
      deliveryOwnerId: input.deliveryOwnerId,
      estimatedHours: input.estimatedHours,
      invoicingStatus: input.invoicingStatus || "Not invoiced",
      paymentStatus: input.paymentStatus,
    });
    audit(store, user, "project.sow", "project", existing.id, `Updated the SOW for ${input.name}.`);
  });
}

export function setDeliveryStatus(user: SessionUser, projectId: string, deliveryStatus: Project["deliveryStatus"]) {
  return mutate((store) => {
    const project = requireProject(store, projectId);
    if (!projectVisible(user, project, store.members)) throw new PortalError("That project is outside your access.");
    if (!canManageProject(user, project) && !can(user, "projects.view_all")) throw new PortalError("You cannot change this project status.");
    project.deliveryStatus = deliveryStatus;
    project.status = statusForDelivery(deliveryStatus, project.activated);
    audit(store, user, "project.status", "project", projectId, `Set ${project.name} to ${deliveryStatus.replaceAll("_", " ")}.`);
  });
}

export async function uploadSowFile(user: SessionUser, projectId: string, file: File) {
  if (!(file instanceof File) || file.size === 0) throw new PortalError("Choose a SOW PDF.");
  if (!file.name.toLowerCase().endsWith(".pdf")) throw new PortalError("The SOW file must be a PDF.");
  return mutate((store) => {
    const project = requireProject(store, projectId);
    if (!projectVisible(user, project, store.members)) throw new PortalError("That project is outside your access.");
    rememberFile(store, user, projectId, "sow", file);
    project.sowFileName = file.name;
    audit(store, user, "project.sow_file", "project", projectId, `Attached the SOW for ${project.name}.`);
  });
}

export function finaliseSow(user: SessionUser, projectId: string) {
  return mutate((store) => {
    const project = requireProject(store, projectId);
    if (!projectVisible(user, project, store.members)) throw new PortalError("That project is outside your access.");
    if (!canManageProject(user, project) && !can(user, "projects.view_all")) throw new PortalError("You cannot finalise this SOW.");
    project.sowStage = "finalised";
    audit(store, user, "project.finalise", "project", projectId, `Finalised the SOW for ${project.name}.`);
    notify(store, project.ownerId, "SOW finalised", `${project.name} can now be staffed.`, "/resources");
  });
}

export function activateProject(user: SessionUser, projectId: string) {
  return mutate((store) => {
    const project = requireProject(store, projectId);
    if (project.sowStage !== "finalised") throw new PortalError("Finalise the SOW before activating the project.");
    if (!canManageProject(user, project) && !can(user, "tasks.manage")) throw new PortalError("You cannot activate this project.");
    project.activated = true;
    project.status = "active";
    if (project.deliveryStatus !== "done") project.deliveryStatus = "in_progress";
    audit(store, user, "project.activate", "project", projectId, `Activated ${project.name} for delivery.`);
  });
}

export function saveDeliverySheet(
  user: SessionUser,
  projectId: string,
  rows: { id: string; title: string; assigneeId: string; startDate: string; dueDate: string; estimatedHours: number; actualHours: number }[],
) {
  return mutate((store) => {
    const project = requireProject(store, projectId);
    if (!project.activated) throw new PortalError("Activate the project before editing tasks.");
    if (!canEditDelivery(user, project)) throw new PortalError("Only the project owner can edit these tasks.");
    for (const row of rows) {
      const task = store.tasks.find((item) => item.id === row.id && item.projectId === projectId);
      if (!task || !row.title.trim()) continue;
      Object.assign(task, {
        title: row.title.trim(),
        assigneeId: row.assigneeId,
        startDate: row.startDate,
        dueDate: row.dueDate,
        estimatedHours: row.estimatedHours,
        actualHours: row.actualHours,
      });
    }
    audit(store, user, "task.sheet", "project", projectId, `Updated the task sheet for ${project.name}.`);
  });
}

export function raiseEscalation(
  user: SessionUser,
  input: { projectId: string; type: Escalation["type"]; description: string; ownerName: string; dueDate: string },
) {
  return mutate((store) => {
    const project = requireProject(store, input.projectId);
    if (!projectVisible(user, project, store.members)) throw new PortalError("That project is outside your access.");
    if (!input.description.trim()) throw new PortalError("Describe the issue and the support needed.");
    store.escalations.unshift({
      id: nid("esc"),
      projectId: project.id,
      type: input.type,
      description: input.description.trim(),
      ownerName: input.ownerName.trim() || user.fullName,
      dueDate: input.dueDate,
      status: "open",
      createdBy: user.id,
      createdAt: stamp(),
    });
    audit(store, user, "escalation.raise", "project", project.id, `Raised a ${input.type} on ${project.name}.`);
    notify(store, project.ownerId, "Escalation raised", `${user.fullName} raised a ${input.type} on ${project.name}.`, "/escalations");
  });
}

export function setEscalationStatus(user: SessionUser, id: string, status: Escalation["status"]) {
  return mutate((store) => {
    const item = store.escalations.find((entry) => entry.id === id);
    if (!item) throw new PortalError("That escalation was not found.");
    const project = requireProject(store, item.projectId);
    if (!projectVisible(user, project, store.members)) throw new PortalError("That project is outside your access.");
    if (!can(user, "projects.manage") && !can(user, "projects.view_all") && !can(user, "tasks.manage")) throw new PortalError("You cannot update that escalation.");
    item.status = status;
    audit(store, user, "escalation.status", "escalation", id, `Set escalation to ${status.replaceAll("_", " ")}.`);
  });
}

export function saveWorkstream(user: SessionUser, input: { id: string; ownerName: string; targetDate: string; status: Workstream["status"] }) {
  if (!can(user, "projects.manage") && !can(user, "projects.view_all")) throw new PortalError("You cannot update workstreams.");
  return mutate((store) => {
    const item = store.workstreams.find((entry) => entry.id === input.id);
    if (!item) throw new PortalError("That workstream was not found.");
    item.ownerName = input.ownerName;
    item.targetDate = input.targetDate;
    item.status = input.status;
  });
}

export async function projectFile(user: SessionUser, id: string): Promise<{ name: string; type: string; bytes: Uint8Array }> {
  const store = read();
  const file = store.files.find((item) => item.id === id);
  if (!file) throw new PortalError("That file was not found.");
  const project = requireProject(store, file.projectId);
  if (!projectVisible(user, project, store.members)) throw new PortalError("That project is outside your access.");
  throw new PortalError("Demo mode keeps the file name only. Connect Supabase to store the original.");
}

export function resetDemo(user: SessionUser) {
  if (!can(user, "settings.manage")) throw new PortalError("You cannot reset the workspace.");
  return mutate((store) => {
    const fresh = buildSeed();
    for (const key of Object.keys(store) as (keyof DemoStore)[]) delete store[key];
    Object.assign(store, fresh);
  });
}
