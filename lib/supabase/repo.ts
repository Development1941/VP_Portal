import { can, canApproveProject, canEditDelivery, canEditTask, canFileIntake, canManageProject, canSeeMilestones, canSeeTeamDsr, canUploadMilestones, projectLeads, projectVisible } from "@/lib/access";
import { currencyCode, isCurrency } from "@/lib/currency";
import { convertMoney, crossRate, marketBoard } from "@/lib/fx";
import { addDays, stamp, todayIso } from "@/lib/dates";
import { prettyDate, roundMoney } from "@/lib/format";
import { assertIntake, billingModelFor, clientForProfile, isIntakeOwner, keepDelivery, sowDefaults, statusForDelivery, type IntakeRequest } from "@/lib/delivery";
import { packHours, unpackHours } from "@/lib/health";
import { canUseHourlyTracker, hourlyRowsForUser, isResourceAllocation, type HourlySheetRow } from "@/lib/hourly-sheet";
import { PortalError } from "@/lib/form";
import { canPublishStatus, presentStatus, visibleStatus } from "@/lib/status-board";
import { presentSow } from "@/lib/sow-board";
import { ALL_PERMISSIONS, type PermissionKey } from "@/lib/permissions";
import { nextInvoiceStatus, resolveBillRate } from "@/lib/metrics";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Client,
  DirectoryUser,
  Escalation,
  Feature,
  HourlyEntry,
  Invoice,
  Milestone,
  Payment,
  Project,
  ProjectFile,
  RateCard,
  Role,
  SessionUser,
  SowRecord,
  StatusUpdate,
  Task,
  Timesheet,
  Workspace,
  Workstream,
} from "@/lib/types";

type Row = Record<string, unknown>;

function oneOf<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  if (typeof value === "string" && (options as readonly string[]).includes(value)) return value as T;
  return fallback;
}

function raise(error: { message: string; code?: string } | null) {
  if (!error) return;
  if (error.code === "42P01" || error.code === "PGRST205" || error.code === "PGRST202" || error.code === "42883") {
    throw new PortalError("The Supabase schema is not installed yet. Run supabase/schema.sql in the SQL editor.");
  }
  if (error.code === "42501" || /row-level security/i.test(error.message)) {
    throw new PortalError("Your role does not allow that change.");
  }
  throw new PortalError(error.message);
}

function text(value: unknown) {
  return value == null ? "" : String(value);
}

function num(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function uuid(value: string) {
  return value || null;
}

async function client() {
  return createClient();
}

async function trail(user: SessionUser, action: string, entity: string, entityId: string, summary: string) {
  const supabase = await client();
  const { error } = await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action,
    entity,
    entity_id: entityId || null,
    summary,
  });
  raise(error);
}

async function ping(userId: string, title: string, body: string, href: string) {
  if (!userId) return;
  const supabase = await client();
  const { error } = await supabase.rpc("add_notification", { target: userId, title, body, href });
  raise(error);
}

function mapRole(row: Row): Role {
  return {
    id: text(row.id),
    name: text(row.name),
    slug: text(row.slug),
    description: text(row.description),
    isSystem: Boolean(row.is_system),
    locked: Boolean(row.locked),
  };
}

function mapClient(row: Row): Client {
  return {
    id: text(row.id),
    name: text(row.name),
    company: text(row.company),
    email: text(row.email),
    phone: text(row.phone),
    billingEmail: text(row.billing_email),
    address: text(row.address),
    taxId: text(row.tax_id),
    currency: text(row.currency) || "INR",
    status: oneOf(row.status, ["active", "inactive"] as const, "active"),
    notes: text(row.notes),
  };
}

function mapProject(row: Row): Project {
  return {
    id: text(row.id),
    clientId: text(row.client_id),
    name: text(row.name),
    code: text(row.code),
    description: text(row.description),
    status: oneOf(row.status, ["planning", "active", "on_hold", "completed"] as const, "planning"),
    billingModel: oneOf(row.billing_model, ["hourly", "fixed", "retainer"] as const, "hourly"),
    startDate: text(row.start_date),
    endDate: text(row.end_date),
    budgetAmount: num(row.budget_amount),
    currency: text(row.currency) || "INR",
    ownerId: text(row.owner_id),
    estimatedHours: num(row.estimated_hours),
    source: oneOf(row.source, ["requirement_document", "proposal", "meeting_transcript", "email_thread"] as const, "requirement_document"),
    sowStage: oneOf(row.sow_stage, ["draft", "finalised"] as const, "draft"),
    deliveryStatus: oneOf(row.delivery_status, ["in_progress", "done", "blocked"] as const, "in_progress"),
    billingTerms: oneOf(row.billing_terms, ["milestone", "monthly_tm", "fixed_fee"] as const, "milestone"),
    approvalStatus: oneOf(row.approval_status, ["signed", "pending", "rejected"] as const, "pending"),
    renewalDate: text(row.renewal_date),
    scope: text(row.scope),
    deliverables: text(row.deliverables),
    risks: text(row.risks),
    pendingActions: text(row.pending_actions),
    deliveryOwnerId: text(row.delivery_owner_id),
    invoicingStatus: text(row.invoicing_status) || "Not invoiced",
    paymentStatus: oneOf(row.payment_status, ["paid", "partially_paid", "overdue", "not_due"] as const, "not_due"),
    activated: Boolean(row.activated),
    sowFileName: text(row.sow_file_name),
    sowFilePath: text(row.sow_file_path),
    initiatedById: text(row.initiated_by),
    initiatedFor: text(row.initiated_for),
    initiatedFrom: text(row.initiated_from),
  };
}

function mapMilestone(row: Row): Milestone {
  const packed = unpackHours(text(row.description));
  return {
    id: text(row.id),
    projectId: text(row.project_id),
    name: text(row.name),
    description: packed.description,
    dueDate: text(row.due_date),
    status: oneOf(row.status, ["pending", "in_progress", "completed", "missed"] as const, "pending"),
    amount: num(row.amount),
    plannedHours: row.planned_hours == null ? packed.hours : num(row.planned_hours) || packed.hours,
  };
}

function mapFeature(row: Row): Feature {
  return {
    id: text(row.id),
    projectId: text(row.project_id),
    name: text(row.name),
    description: text(row.description),
    billingType: oneOf(row.billing_type, ["hourly", "fixed"] as const, "hourly"),
    hourlyRate: num(row.hourly_rate),
    fixedAmount: num(row.fixed_amount),
    budgetHours: num(row.budget_hours),
    status: oneOf(row.status, ["planned", "active", "done"] as const, "planned"),
  };
}

function mapTask(row: Row): Task {
  return {
    id: text(row.id),
    projectId: text(row.project_id),
    milestoneId: text(row.milestone_id),
    featureId: text(row.feature_id),
    title: text(row.title),
    description: text(row.description),
    assigneeId: text(row.assignee_id),
    status: oneOf(row.status, ["backlog", "in_progress", "review", "done"] as const, "backlog"),
    priority: oneOf(row.priority, ["low", "medium", "high", "urgent"] as const, "medium"),
    dueDate: text(row.due_date),
    startDate: text(row.start_date),
    estimatedHours: num(row.estimated_hours),
    actualHours: num(row.actual_hours),
  };
}

function mapTime(row: Row): Timesheet {
  return {
    id: text(row.id),
    userId: text(row.user_id),
    projectId: text(row.project_id),
    taskId: text(row.task_id),
    featureId: text(row.feature_id),
    workDate: text(row.work_date),
    hours: num(row.hours),
    billable: Boolean(row.billable),
    description: text(row.description),
    status: oneOf(row.status, ["draft", "submitted", "approved", "rejected"] as const, "draft"),
    approvedBy: text(row.approved_by),
    approvedAt: text(row.approved_at),
    rejectionNote: text(row.rejection_note),
    invoiceId: text(row.invoice_id),
  };
}

function mapRate(row: Row): RateCard {
  return {
    id: text(row.id),
    label: text(row.label),
    scope: oneOf(row.scope, ["company", "role", "user", "project", "feature"] as const, "company"),
    targetId: text(row.target_id),
    hourlyRate: num(row.hourly_rate),
    currency: text(row.currency) || "INR",
    effectiveFrom: text(row.effective_from),
  };
}

function mapInvoice(row: Row): Invoice {
  return {
    id: text(row.id),
    number: text(row.number),
    clientId: text(row.client_id),
    projectId: text(row.project_id),
    issueDate: text(row.issue_date),
    dueDate: text(row.due_date),
    status: oneOf(row.status, ["draft", "sent", "partial", "paid", "void"] as const, "draft"),
    taxRate: num(row.tax_rate),
    notes: text(row.notes),
    createdBy: text(row.created_by),
  };
}

function mapPayment(row: Row): Payment {
  return {
    id: text(row.id),
    direction: oneOf(row.direction, ["incoming", "outgoing"] as const, "incoming"),
    clientId: text(row.client_id),
    userId: text(row.user_id),
    invoiceId: text(row.invoice_id),
    projectId: text(row.project_id),
    amount: num(row.amount),
    currency: text(row.currency) || "INR",
    method: text(row.method),
    status: oneOf(row.status, ["draft", "initiated", "processing", "completed", "failed", "cancelled"] as const, "initiated"),
    reference: text(row.reference),
    notes: text(row.notes),
    createdBy: text(row.created_by),
    createdAt: text(row.created_at),
    paidAt: text(row.paid_at),
  };
}

function mapEscalation(row: Row): Escalation {
  return {
    id: text(row.id),
    projectId: text(row.project_id),
    type: oneOf(row.type, ["blocker", "concern", "dependency"] as const, "blocker"),
    description: text(row.description),
    ownerName: text(row.owner_name),
    dueDate: text(row.due_date),
    status: oneOf(row.status, ["open", "in_review", "resolved"] as const, "open"),
    createdBy: text(row.created_by),
    createdAt: text(row.created_at),
  };
}

function mapFile(row: Row): ProjectFile {
  return {
    id: text(row.id),
    projectId: text(row.project_id),
    kind: oneOf(row.kind, ["requirement", "sow"] as const, "requirement"),
    fileName: text(row.file_name),
    createdBy: text(row.created_by),
    createdAt: text(row.created_at),
  };
}

function mapWorkstream(row: Row): Workstream {
  return {
    id: text(row.id),
    name: text(row.name),
    ownerName: text(row.owner_name),
    targetDate: text(row.target_date),
    status: oneOf(row.status, ["in_progress", "blocked", "done"] as const, "in_progress"),
  };
}

async function loadProject(id: string) {
  const supabase = await client();
  const { data, error } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
  raise(error);
  if (!data) throw new PortalError("That project was not found.");
  return mapProject(data);
}

async function syncInvoice(invoiceId: string) {
  if (!invoiceId) return;
  const supabase = await client();
  const [{ data: invoice, error: invoiceError }, { data: lines, error: lineError }, { data: payments, error: paymentError }] = await Promise.all([
    supabase.from("invoices").select("*").eq("id", invoiceId).maybeSingle(),
    supabase.from("invoice_lines").select("*").eq("invoice_id", invoiceId),
    supabase.from("payments").select("*").eq("invoice_id", invoiceId),
  ]);
  raise(invoiceError);
  raise(lineError);
  raise(paymentError);
  if (!invoice || invoice.status === "void") return;
  const mapped = mapInvoice(invoice);
  const status = nextInvoiceStatus(
    mapped,
    (lines ?? []).map((line) => ({
      id: line.id,
      invoiceId: line.invoice_id,
      featureId: text(line.feature_id),
      description: text(line.description),
      hours: num(line.hours),
      rate: num(line.rate),
      amount: num(line.amount),
    })),
    (payments ?? []).map(mapPayment),
  );
  const { error } = await supabase.from("invoices").update({ status }).eq("id", invoiceId);
  raise(error);
}

function directoryUsers(user: SessionUser, users: DirectoryUser[], projects: Project[], members: Workspace["members"]) {
  if (can(user, "team.view") || can(user, "team.manage") || can(user, "tasks.manage")) return users;
  const visible = new Set<string>([user.id]);
  const projectIds = new Set(projects.map((project) => project.id));
  for (const project of projects) visible.add(project.ownerId);
  for (const member of members) if (projectIds.has(member.projectId)) visible.add(member.userId);
  return users.filter((person) => visible.has(person.id));
}

function skipped() {
  return Promise.resolve({ data: [] as Row[], error: null });
}

function rows(result: { data: unknown }) {
  return (result.data ?? []) as Row[];
}

async function loadPortal(user: SessionUser) {
  const supabase = await client();
  const seeGrants = can(user, "settings.manage");
  const seeRates = can(user, "billing.rates") || can(user, "reports.project") || can(user, "reports.financial");
  const seeMoney = can(user, "invoices.view") || can(user, "reports.project") || can(user, "reports.financial") || can(user, "payments.view");
  const seePayments = can(user, "payments.view") || seeMoney;
  const seeAudit = can(user, "audit.view");
  const showCost = can(user, "team.manage") || can(user, "reports.financial") || can(user, "payments.manage") || can(user, "reports.project");
  const bundled = await supabase.rpc("portal_bundle", {
    p_grants: seeGrants,
    p_rates: seeRates,
    p_money: seeMoney,
    p_payments: seePayments,
    p_audit: seeAudit,
    p_costs: showCost,
  });
  if (!bundled.error && bundled.data && typeof bundled.data === "object") {
    const raw = bundled.data as Record<string, unknown>;
    const studio = raw.studio;
    return {
      showCost,
      rolesRes: ok(asList(raw.roles)),
      grantRes: ok(asList(raw.grants)),
      profileRes: ok(asList(raw.profiles)),
      clientRes: ok(asList(raw.clients)),
      projectRes: ok(asList(raw.projects)),
      memberRes: ok(asList(raw.members)),
      milestoneRes: ok(asList(raw.milestones)),
      featureRes: ok(asList(raw.features)),
      taskRes: ok(asList(raw.tasks)),
      timeRes: ok(asList(raw.timesheets)),
      rateRes: ok(asList(raw.rates)),
      invoiceRes: ok(asList(raw.invoices)),
      lineRes: ok(asList(raw.lines)),
      paymentRes: ok(asList(raw.payments)),
      noteRes: ok(asList(raw.notifications)),
      auditRes: ok(asList(raw.audit)),
      costRes: ok(asList(raw.costs)),
      escalationRes: ok(asList(raw.escalations)),
      fileRes: ok(asList(raw.files)),
      workstreamRes: ok(asList(raw.workstreams)),
      studioRes: { data: studio && typeof studio === "object" && !Array.isArray(studio) ? studio as { currency?: string } : null, error: null as null },
      fxRates: presentFxRows(asList(raw.fx) as Row[]),
      statusUpdates: presentStatusRows(asList(raw.status) as Record<string, unknown>[]),
      sowRecords: presentSowRows(asList(raw.sow) as Record<string, unknown>[]),
      hourlyEntries: presentHourlyRows(asList(raw.hourly) as Record<string, unknown>[], user),
    };
  }
  const [rolesRes, grantRes, profileRes, clientRes, projectRes, memberRes, milestoneRes, featureRes, taskRes, timeRes, rateRes, invoiceRes, lineRes, paymentRes, noteRes, auditRes, costRes, escalationRes, fileRes, workstreamRes, studioRes, fxRates, statusUpdates, sowRecords, hourlyEntries] =
    await Promise.all([
      supabase.from("roles").select("id, name, slug, description, is_system, locked").order("name"),
      seeGrants ? supabase.from("role_permissions").select("role_id, permission_key") : skipped(),
      supabase.from("profiles").select("id, full_name, email, title, phone, role_id, status"),
      supabase.from("clients").select("id, name, company, email, phone, billing_email, address, tax_id, currency, status, notes").order("company"),
      supabase.from("projects").select("id, client_id, name, code, description, status, billing_model, start_date, end_date, budget_amount, currency, owner_id, estimated_hours, source, sow_stage, delivery_status, billing_terms, approval_status, renewal_date, scope, deliverables, risks, pending_actions, delivery_owner_id, invoicing_status, payment_status, activated, sow_file_name, sow_file_path, initiated_by, initiated_for, initiated_from").order("name"),
      supabase.from("project_members").select("project_id, user_id, member_role, bill_rate"),
      supabase.from("milestones").select("id, project_id, name, description, due_date, status, amount"),
      supabase.from("features").select("id, project_id, name, description, billing_type, hourly_rate, fixed_amount, budget_hours, status"),
      supabase.from("tasks").select("id, project_id, milestone_id, feature_id, title, description, assignee_id, status, priority, due_date, start_date, estimated_hours, actual_hours"),
      supabase.from("timesheets").select("id, user_id, project_id, task_id, feature_id, work_date, hours, billable, description, status, approved_by, approved_at, rejection_note, invoice_id"),
      seeRates ? supabase.from("rates").select("id, label, scope, target_id, hourly_rate, currency, effective_from") : skipped(),
      seeMoney ? supabase.from("invoices").select("id, number, client_id, project_id, issue_date, due_date, status, tax_rate, notes, created_by").order("issue_date", { ascending: false }) : skipped(),
      seeMoney ? supabase.from("invoice_lines").select("id, invoice_id, feature_id, description, hours, rate, amount") : skipped(),
      seePayments ? supabase.from("payments").select("id, direction, client_id, user_id, invoice_id, project_id, amount, currency, method, status, reference, notes, created_by, created_at, paid_at").order("created_at", { ascending: false }) : skipped(),
      supabase.from("notifications").select("id, user_id, title, body, href, read, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(40),
      seeAudit ? supabase.from("audit_logs").select("id, actor_id, action, entity, entity_id, summary, created_at").order("created_at", { ascending: false }).limit(80) : skipped(),
      showCost ? supabase.rpc("staff_costs") : skipped(),
      supabase.from("escalations").select("id, project_id, type, description, owner_name, due_date, status, created_by, created_at").order("created_at", { ascending: false }),
      supabase.from("project_files").select("id, project_id, kind, file_name, created_by, created_at").order("created_at", { ascending: false }),
      supabase.from("workstreams").select("id, name, owner_name, target_date, status").order("name"),
      supabase.from("studio_settings").select("currency").eq("id", 1).maybeSingle(),
      fxHistory(supabase),
      statusBoard(supabase),
      sowBoard(supabase),
      hourlyBoard(supabase, user),
    ]);
  for (const result of [rolesRes, grantRes, profileRes, clientRes, projectRes, memberRes, milestoneRes, featureRes, taskRes, timeRes, rateRes, invoiceRes, lineRes, paymentRes, noteRes, auditRes, escalationRes, fileRes, workstreamRes, studioRes]) {
    raise(result.error);
  }
  return { showCost, rolesRes, grantRes, profileRes, clientRes, projectRes, memberRes, milestoneRes, featureRes, taskRes, timeRes, rateRes, invoiceRes, lineRes, paymentRes, noteRes, auditRes, costRes, escalationRes, fileRes, workstreamRes, studioRes, fxRates, statusUpdates, sowRecords, hourlyEntries };
}

function asList(value: unknown) {
  return Array.isArray(value) ? value : [];
}

export async function workspace(user: SessionUser): Promise<Workspace> {
  const loaded: {
    showCost: boolean;
    rolesRes: { data: Row[] | null; error: { message: string } | null };
    grantRes: { data: Row[] | null; error: { message: string } | null };
    profileRes: { data: Row[] | null; error: { message: string } | null };
    clientRes: { data: Row[] | null; error: { message: string } | null };
    projectRes: { data: Row[] | null; error: { message: string } | null };
    memberRes: { data: Row[] | null; error: { message: string } | null };
    milestoneRes: { data: Row[] | null; error: { message: string } | null };
    featureRes: { data: Row[] | null; error: { message: string } | null };
    taskRes: { data: Row[] | null; error: { message: string } | null };
    timeRes: { data: Row[] | null; error: { message: string } | null };
    rateRes: { data: Row[] | null; error: { message: string } | null };
    invoiceRes: { data: Row[] | null; error: { message: string } | null };
    lineRes: { data: Row[] | null; error: { message: string } | null };
    paymentRes: { data: Row[] | null; error: { message: string } | null };
    noteRes: { data: Row[] | null; error: { message: string } | null };
    auditRes: { data: Row[] | null; error: { message: string } | null };
    costRes: { data: Row[] | null; error: { message: string } | null };
    escalationRes: { data: Row[] | null; error: { message: string } | null };
    fileRes: { data: Row[] | null; error: { message: string } | null };
    workstreamRes: { data: Row[] | null; error: { message: string } | null };
    studioRes: { data: { currency?: string } | null; error: { message: string } | null };
    fxRates: Workspace["fxRates"];
    statusUpdates: StatusUpdate[];
    sowRecords: SowRecord[];
    hourlyEntries: HourlyEntry[];
  } = await loadPortal(user);
  const { showCost, rolesRes, grantRes, profileRes, clientRes, projectRes, memberRes, milestoneRes, featureRes, taskRes, timeRes, rateRes, invoiceRes, lineRes, paymentRes, noteRes, auditRes, costRes, escalationRes, fileRes, workstreamRes, studioRes, fxRates, statusUpdates, sowRecords, hourlyEntries } = loaded;

  const roles = (rolesRes.data ?? []).map(mapRole);
  const roleById = new Map(roles.map((role) => [role.id, role]));
  const costs = new Map<string, number>(((costRes.data ?? []) as Row[]).map((row) => [String(row.id), num(row.hourly_cost)]));
  const users: DirectoryUser[] = (profileRes.data ?? []).map((row) => {
    const role = roleById.get(text(row.role_id));
    return {
      id: text(row.id),
      fullName: text(row.full_name),
      email: text(row.email),
      title: text(row.title),
      phone: text(row.phone),
      roleId: text(row.role_id),
      roleName: role?.name ?? "Unassigned",
      roleSlug: role?.slug ?? "",
      status: oneOf(row.status, ["active", "invited", "inactive"] as const, "active"),
      hourlyCost: showCost ? costs.get(text(row.id)) ?? 0 : 0,
    };
  });
  const members = (memberRes.data ?? []).map((row) => ({
    projectId: text(row.project_id),
    userId: text(row.user_id),
    memberRole: text(row.member_role),
    billRate: num(row.bill_rate),
  }));
  const projects = (projectRes.data ?? []).map(mapProject).filter((project) => projectVisible(user, project, members));
  const ids = new Set(projects.map((project) => project.id));
  let taskRows = taskRes.data ?? [];
  if (projects.length && !can(user, "tasks.manage") && !can(user, "projects.view_all")) {
    const admin = createServiceClient();
    if (admin) {
      const { data: extra } = await admin.from("tasks").select("*").in("project_id", projects.map((project) => project.id));
      const byId = new Map(taskRows.map((row) => [row.id, row]));
      for (const row of extra ?? []) byId.set(row.id, row);
      taskRows = [...byId.values()];
    }
  }

  return {
    currency: currencyCode(text(studioRes.data?.currency)),
    users: directoryUsers(user, users, projects, members),
    roles: can(user, "settings.manage") || can(user, "team.manage") ? roles : roles.filter((role) => role.id === user.roleId),
    grants: can(user, "settings.manage")
      ? rows(grantRes).map((grant) => ({ roleId: grant.role_id as string, permission: grant.permission_key as PermissionKey }))
      : [],
    clients: (clientRes.data ?? []).map(mapClient),
    projects,
    members: members.filter((member) => ids.has(member.projectId)),
    milestones: (milestoneRes.data ?? []).map(mapMilestone).filter((item) => {
      if (!ids.has(item.projectId)) return false;
      const project = projects.find((entry) => entry.id === item.projectId);
      return Boolean(project && canSeeMilestones(user, project, members));
    }),
    features: (featureRes.data ?? []).map(mapFeature).filter((item) => ids.has(item.projectId)),
    tasks: taskRows.map(mapTask).filter((item) => ids.has(item.projectId)),
    timesheets: (timeRes.data ?? []).map(mapTime).filter((item) => {
      const project = projects.find((entry) => entry.id === item.projectId);
      if (!project) return false;
      return item.userId === user.id || canSeeTeamDsr(user, project);
    }),
    rates: can(user, "billing.rates") ? rows(rateRes).map(mapRate) : [],
    invoices: rows(invoiceRes).map(mapInvoice).filter((item) => ids.has(item.projectId)),
    lines: rows(lineRes)
      .map((row) => ({
        id: row.id as string,
        invoiceId: text(row.invoice_id),
        featureId: text(row.feature_id),
        description: text(row.description),
        hours: num(row.hours),
        rate: num(row.rate),
        amount: num(row.amount),
      }))
      .filter((line) => rows(invoiceRes).some((invoice) => invoice.id === line.invoiceId && ids.has(text(invoice.project_id)))),
    payments: rows(paymentRes).map(mapPayment).filter((item) => !item.projectId || ids.has(item.projectId)),
    notifications: (noteRes.data ?? []).map((row) => ({
      id: text(row.id),
      userId: text(row.user_id),
      title: text(row.title),
      body: text(row.body),
      href: text(row.href),
      read: Boolean(row.read),
      createdAt: text(row.created_at),
    })),
    audit: rows(auditRes).map((row) => ({
      id: text(row.id),
      actorId: text(row.actor_id),
      action: text(row.action),
      entity: text(row.entity),
      entityId: text(row.entity_id),
      summary: text(row.summary),
      createdAt: text(row.created_at),
    })),
    escalations: rows(escalationRes).map(mapEscalation).filter((item) => ids.has(item.projectId)),
    files: rows(fileRes).map(mapFile).filter((item) => ids.has(item.projectId)),
    workstreams: rows(workstreamRes).map(mapWorkstream),
    fxRates,
    statusUpdates: visibleStatus(user, statusUpdates),
    sowRecords: visibleStatus(user, sowRecords),
    hourlyEntries,
  };
}

function statusFields(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const fields: Record<string, string> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (item == null || item === "") continue;
    fields[key] = String(item);
  }
  return fields;
}

function presentStatusRows(data: Record<string, unknown>[]) {
  return data.map((row) =>
    presentStatus({
      sheetNo: num(row.sheet_no),
      project: text(row.project_name),
      subItem: text(row.sub_item),
      status: text(row.status),
      remarks: text(row.remarks),
      statusDate: text(row.status_date).slice(0, 10),
      sheetLabel: text(row.sheet_label),
      company: text(row.company),
      fields: statusFields(row.fields),
    }),
  );
}

function presentSowRows(data: Record<string, unknown>[]) {
  return data.map((row) => presentSow({
    id: text(row.id),
    kind: text(row.kind) === "bid" ? "bid" as const : "status" as const,
    sheetNo: num(row.sheet_no),
    project: text(row.project_name),
    sprint: text(row.sprint),
    link: text(row.link),
    signature: text(row.signature),
    signedOn: text(row.signed_on),
    changeRequest: text(row.change_request),
    company: text(row.company),
  }));
}

function presentHourlyRows(data: Record<string, unknown>[], user: SessionUser): HourlyEntry[] {
  const mapped = data.map((row) => ({
    id: text(row.id),
    userId: text(row.user_id),
    roleName: text(row.role_name),
    sheetNo: num(row.sheet_no),
    project: text(row.project_name),
    sprint: text(row.sprint),
    resource: text(row.resource_name),
    task: text(row.task) || text(row.notes),
    workDate: text(row.work_date).slice(0, 10),
    hours: num(row.hours),
    status: text(row.status),
    company: text(row.company),
    estStart: text(row.est_start).slice(0, 10),
    estEnd: text(row.est_end).slice(0, 10),
    estimatedHours: row.estimated_hours == null || row.estimated_hours === "" ? null : num(row.estimated_hours),
    targetHours: row.target_hours == null || row.target_hours === "" ? null : num(row.target_hours),
    actualStart: text(row.actual_start).slice(0, 10),
    actualEnd: text(row.actual_end).slice(0, 10),
    actualHours: row.actual_hours == null || row.actual_hours === "" ? null : num(row.actual_hours),
    approval: text(row.approval),
    notes: text(row.notes),
  }));
  if (canUseHourlyTracker(user)) return mapped;
  if (can(user, "projects.view") || can(user, "projects.view_all") || can(user, "tasks.view") || can(user, "tasks.manage")) return mapped.filter(isResourceAllocation);
  return mapped.filter((row) => row.userId === user.id);
}

function presentFxRows(data: Row[]) {
  return data.map((row) => ({
    id: text(row.id),
    from: text(row.from_currency),
    to: text(row.to_currency),
    rate: num(row.rate),
    source: text(row.source),
    recordedAt: text(row.recorded_at),
  }));
}

function ok(data: unknown): { data: Row[] | null; error: null } {
  return { data: Array.isArray(data) ? data as Row[] : [], error: null };
}

async function statusBoard(supabase: SupabaseClient) {
  const full = await supabase
    .from("status_updates")
    .select("sheet_no, project_name, sub_item, status, remarks, status_date, sheet_label, company, fields")
    .order("status_date", { ascending: false })
    .order("sheet_no");
  const data = full.error
    ? (
        await supabase
          .from("status_updates")
          .select("sheet_no, project_name, sub_item, status, remarks, status_date")
          .order("status_date", { ascending: false })
          .order("sheet_no")
      ).data
    : full.data;
  return presentStatusRows((data ?? []) as Record<string, unknown>[]);
}

async function hourlyBoard(supabase: SupabaseClient, user: SessionUser): Promise<HourlyEntry[]> {
  const columns = "id, user_id, role_name, work_date, project_name, hours, notes, sheet_no, sprint, resource_name, task, status, company, est_start, est_end, estimated_hours, target_hours, actual_start, actual_end, actual_hours, approval";
  const shared = canUseHourlyTracker(user) || can(user, "projects.view") || can(user, "projects.view_all") || can(user, "tasks.view") || can(user, "tasks.manage");
  let query = supabase.from("hourly_entries").select(columns).order("sheet_no");
  if (!shared) query = query.eq("user_id", user.id);
  const chosen = await query;
  const data = chosen.error
    ? (await supabase.from("hourly_entries").select("id, user_id, role_name, work_date, project_name, hours, notes").eq("user_id", user.id).order("work_date", { ascending: false })).data
    : chosen.data;
  return presentHourlyRows((data ?? []) as Record<string, unknown>[], user);
}

async function sowBoard(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("sow_records").select("id, kind, sheet_no, project_name, sprint, link, signature, signed_on, change_request, company").order("sheet_no");
  if (error || !data) return [];
  return presentSowRows(data as Record<string, unknown>[]);
}

async function fxHistory(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("fx_rates").select("id, from_currency, to_currency, rate, source, recorded_at").order("recorded_at", { ascending: false }).limit(20);
  if (error) return [];
  return presentFxRows((data ?? []) as Row[]);
}

async function studioCurrency() {
  const supabase = await client();
  const { data } = await supabase.from("studio_settings").select("currency").eq("id", 1).maybeSingle();
  return currencyCode(text(data?.currency));
}

export async function saveStudioCurrency(user: SessionUser, currency: string) {
  if (!can(user, "settings.manage")) throw new PortalError("You cannot change the studio currency.");
  if (!isCurrency(currency)) throw new PortalError("Choose a supported currency.");
  const current = await studioCurrency();
  if (current === currency) return;
  const board = await marketBoard();
  const rate = crossRate(board.quotes, current, currency);
  const admin = createServiceClient();
  const supabase = admin ?? (await client());
  await scaleMoney(supabase, rate);
  const { error } = await supabase.from("studio_settings").update({ currency }).eq("id", 1);
  raise(error);
  for (const table of ["clients", "projects", "rates", "payments"] as const) {
    const { error: updateError } = await supabase.from(table).update({ currency }).not("id", "is", null);
    raise(updateError);
  }
  await supabase.from("fx_rates").insert({ from_currency: current, to_currency: currency, rate, source: board.source });
  await trail(user, "studio.currency", "studio", currency, `Converted ${current} to ${currency} at ${rate} (${board.source}, ${board.asOf}).`);
}

async function scaleMoney(supabase: SupabaseClient, rate: number) {
  const tables: { table: string; columns: string[]; keys: string[] }[] = [
    { table: "profiles", columns: ["hourly_cost"], keys: ["id"] },
    { table: "projects", columns: ["budget_amount"], keys: ["id"] },
    { table: "project_members", columns: ["bill_rate"], keys: ["project_id", "user_id"] },
    { table: "milestones", columns: ["amount"], keys: ["id"] },
    { table: "features", columns: ["hourly_rate", "fixed_amount"], keys: ["id"] },
    { table: "rates", columns: ["hourly_rate"], keys: ["id"] },
    { table: "invoice_lines", columns: ["rate", "amount"], keys: ["id"] },
    { table: "payments", columns: ["amount"], keys: ["id"] },
  ];
  for (const entry of tables) {
    const { data, error } = await supabase.from(entry.table).select([...entry.keys, ...entry.columns].join(", "));
    raise(error);
    for (const row of (data ?? []) as unknown as Record<string, unknown>[]) {
      const patch: Record<string, number> = {};
      for (const column of entry.columns) patch[column] = convertMoney(num(row[column]), rate);
      let query = supabase.from(entry.table).update(patch);
      for (const key of entry.keys) query = query.eq(key, row[key] as string);
      const { error: updateError } = await query;
      raise(updateError);
    }
  }
}

export async function saveClient(user: SessionUser, input: Client) {
  if (!can(user, "clients.manage")) throw new PortalError("You cannot edit clients.");
  if (!input.name || !input.company) throw new PortalError("Client name and company are required.");
  const supabase = await client();
  const payload = {
    name: input.name,
    company: input.company,
    email: input.email,
    phone: input.phone,
    billing_email: input.billingEmail,
    address: input.address,
    tax_id: input.taxId,
    currency: await studioCurrency(),
    status: input.status,
    notes: input.notes,
  };
  const query = input.id
    ? supabase.from("clients").update(payload).eq("id", input.id).select("id").single()
    : supabase.from("clients").insert(payload).select("id").single();
  const { data, error } = await query;
  raise(error);
  if (!data) throw new PortalError("That client could not be saved.");
  await trail(user, "client.save", "client", data.id, `Saved client ${input.company}.`);
}

export async function saveProject(user: SessionUser, input: Project) {
  if (!can(user, "projects.manage")) throw new PortalError("You cannot edit projects.");
  if (!input.name || !input.clientId) throw new PortalError("Project name and client are required.");
  if (!can(user, "projects.view_all")) input.ownerId = user.id;
  let saved = { ...sowDefaults(), ...input };
  if (input.id) {
    const existing = await loadProject(input.id);
    if (!canManageProject(user, existing)) throw new PortalError("You can edit only projects you own.");
    saved = keepDelivery(existing, input);
  }
  const supabase = await client();
  const payload = {
    client_id: saved.clientId,
    name: saved.name,
    code: saved.code,
    description: saved.description,
    status: saved.status,
    billing_model: saved.billingModel,
    start_date: uuid(saved.startDate),
    end_date: uuid(saved.endDate),
    budget_amount: saved.budgetAmount,
    currency: await studioCurrency(),
    owner_id: saved.ownerId,
    estimated_hours: saved.estimatedHours,
    source: saved.source,
    sow_stage: saved.sowStage,
    delivery_status: saved.deliveryStatus,
    billing_terms: saved.billingTerms,
    approval_status: saved.approvalStatus,
    renewal_date: uuid(saved.renewalDate),
    scope: saved.scope,
    deliverables: saved.deliverables,
    risks: saved.risks,
    pending_actions: saved.pendingActions,
    delivery_owner_id: uuid(saved.deliveryOwnerId),
    invoicing_status: saved.invoicingStatus || "Not invoiced",
    payment_status: saved.paymentStatus,
    activated: saved.activated,
    sow_file_name: saved.sowFileName,
    sow_file_path: saved.sowFilePath,
  };
  const query = input.id
    ? supabase.from("projects").update(payload).eq("id", input.id).select("id").single()
    : supabase.from("projects").insert(payload).select("id").single();
  const { data, error } = await query;
  raise(error);
  if (!data) throw new PortalError("That project could not be saved.");
  if (!input.id) {
    await supabase.from("project_members").insert({ project_id: data.id, user_id: input.ownerId, member_role: "Owner", bill_rate: 0 });
  }
  await trail(user, "project.save", "project", data.id, `Saved project ${input.name}.`);
}

export async function saveMember(user: SessionUser, input: { projectId: string; userId: string; memberRole: string; billRate: number }) {
  const project = await loadProject(input.projectId);
  if (!canManageProject(user, project)) throw new PortalError("You cannot change this project team.");
  if (!input.userId) throw new PortalError("Choose a team member.");
  const supabase = await client();
  const { error } = await supabase.from("project_members").upsert({
    project_id: input.projectId,
    user_id: input.userId,
    member_role: input.memberRole || "Contributor",
    bill_rate: input.billRate,
  });
  raise(error);
  await trail(user, "project.member", "project", input.projectId, "Updated project membership.");
}

export async function removeMember(user: SessionUser, projectId: string, memberId: string) {
  const project = await loadProject(projectId);
  if (!canManageProject(user, project)) throw new PortalError("You cannot change this project team.");
  if (memberId === project.ownerId) throw new PortalError("Assign another owner before removing the current owner.");
  const supabase = await client();
  const { error } = await supabase.from("project_members").delete().eq("project_id", projectId).eq("user_id", memberId);
  raise(error);
  await trail(user, "project.member.remove", "project", projectId, "Removed a project member.");
}

async function milestoneMembers(projectId: string) {
  const supabase = await client();
  const { data, error } = await supabase.from("project_members").select("user_id, member_role").eq("project_id", projectId);
  raise(error);
  return (data ?? []).map((row) => ({
    projectId,
    userId: text(row.user_id),
    memberRole: text(row.member_role),
    billRate: 0,
  }));
}

function missingHoursColumn(error: { message: string; code?: string } | null) {
  return Boolean(error && (error.code === "42703" || error.code === "PGRST204" || /planned_hours/i.test(error.message)));
}

function milestonePayload(input: { projectId: string; name: string; description: string; dueDate: string; status: string; amount: number; plannedHours: number }, withColumn: boolean) {
  const row: Record<string, unknown> = {
    project_id: input.projectId,
    name: input.name,
    description: packHours(input.plannedHours, input.description),
    due_date: uuid(input.dueDate),
    status: input.status,
    amount: input.amount,
  };
  if (withColumn) row.planned_hours = input.plannedHours;
  return row;
}

async function writeMilestones(user: SessionUser, rows: Record<string, unknown> | Record<string, unknown>[], id = "") {
  const supabase = await client();
  const write = (db: SupabaseClient, body: Record<string, unknown> | Record<string, unknown>[]) =>
    id ? db.from("milestones").update(body).eq("id", id) : db.from("milestones").insert(body);
  let { error } = await write(supabase, rows);
  if (missingHoursColumn(error)) ({ error } = await write(supabase, Array.isArray(rows) ? rows.map(dropHours) : dropHours(rows)));
  if (error && can(user, "milestones.manage") && (error.code === "42501" || /row-level security/i.test(error.message))) {
    const admin = createServiceClient();
    if (!admin) throw new PortalError("Your role does not allow that change.");
    ({ error } = await write(admin, rows));
    if (missingHoursColumn(error)) ({ error } = await write(admin, Array.isArray(rows) ? rows.map(dropHours) : dropHours(rows)));
  }
  raise(error);
}

function dropHours(row: Record<string, unknown>) {
  const next = { ...row };
  delete next.planned_hours;
  return next;
}

async function tellLeads(user: SessionUser, project: Project, members: Workspace["members"], title: string, body: string) {
  for (const lead of projectLeads(project, members)) {
    if (lead === user.id) continue;
    await ping(lead, title, body, `/projects/${project.id}`);
  }
}

export async function saveMilestone(user: SessionUser, input: Milestone) {
  const project = await loadProject(input.projectId);
  const members = await milestoneMembers(project.id);
  if (!canUploadMilestones(user, project, members)) throw new PortalError("You cannot edit milestones.");
  if (!input.name) throw new PortalError("Milestone name is required.");
  if (!(input.plannedHours > 0)) throw new PortalError("Allocate the expected hours for this sprint.");
  await writeMilestones(user, milestonePayload(input, true), input.id);
  if (!input.id) await tellLeads(user, project, members, "Sprint uploaded", `${user.fullName} uploaded “${input.name}” on ${project.name}.`);
  await trail(user, "milestone.save", "milestone", input.id, `Saved milestone ${input.name}.`);
}

export async function uploadMilestones(user: SessionUser, projectId: string, items: { name: string; dueDate: string; description: string; plannedHours: number }[]) {
  const project = await loadProject(projectId);
  const members = await milestoneMembers(project.id);
  if (!canUploadMilestones(user, project, members)) throw new PortalError("You cannot upload sprints.");
  const rows = items
    .map((item) => ({ name: item.name.trim(), dueDate: item.dueDate, description: item.description, plannedHours: item.plannedHours }))
    .filter((item) => item.name);
  if (!rows.length) throw new PortalError("Add at least one sprint or milestone.");
  if (rows.some((item) => !(item.plannedHours > 0))) throw new PortalError("Each sprint needs allocated hours.");
  await writeMilestones(
    user,
    rows.map((item) => milestonePayload({ projectId, name: item.name, description: item.description, dueDate: item.dueDate, status: "pending", amount: 0, plannedHours: item.plannedHours }, true)),
  );
  await tellLeads(user, project, members, "Sprints uploaded", `${user.fullName} uploaded ${rows.length} sprint${rows.length === 1 ? "" : "s"} on ${project.name}.`);
  await trail(user, "milestone.upload", "project", projectId, `Uploaded ${rows.length} sprints on ${project.name}.`);
}

export async function saveFeature(user: SessionUser, input: Feature) {
  const project = await loadProject(input.projectId);
  if (!canManageProject(user, project) || (!can(user, "billing.features") && !can(user, "tasks.manage"))) {
    throw new PortalError("You cannot edit feature cards.");
  }
  if (!input.name) throw new PortalError("Feature name is required.");
  const supabase = await client();
  const payload = {
    project_id: input.projectId,
    name: input.name,
    description: input.description,
    billing_type: input.billingType,
    hourly_rate: input.hourlyRate,
    fixed_amount: input.fixedAmount,
    budget_hours: input.budgetHours,
    status: input.status,
  };
  const query = input.id ? supabase.from("features").update(payload).eq("id", input.id) : supabase.from("features").insert(payload);
  const { error } = await query;
  raise(error);
  await trail(user, "feature.save", "feature", input.id, `Saved feature ${input.name}.`);
}

export async function saveTask(user: SessionUser, input: Task & { recordActual?: boolean }) {
  const project = await loadProject(input.projectId);
  const supabase = await client();
  const { data: membership, error: memberError } = await supabase
    .from("project_members")
    .select("user_id")
    .eq("project_id", project.id)
    .eq("user_id", user.id)
    .maybeSingle();
  raise(memberError);
  const memberRow = membership ? [{ projectId: project.id, userId: user.id, memberRole: "", billRate: 0 }] : [];
  const managing = can(user, "tasks.manage") && canManageProject(user, project);
    const selfServe =
      !input.id &&
      input.assigneeId === user.id &&
      (["backlog", "in_progress", "review", "done"] as const).includes(input.status) &&
      can(user, "tasks.view") &&
      projectVisible(user, project, memberRow);
  if (!managing && !selfServe) throw new PortalError("You cannot add that task.");
  if (!input.title) throw new PortalError("Task title is required.");
  const payload = {
    project_id: input.projectId,
    milestone_id: uuid(input.milestoneId),
    feature_id: uuid(input.featureId),
    title: input.title,
    description: input.description,
    assignee_id: uuid(input.assigneeId),
    status: input.status,
    priority: input.priority,
    due_date: uuid(input.dueDate),
    estimated_hours: input.estimatedHours,
    ...(input.recordActual ? { start_date: uuid(input.startDate), actual_hours: input.actualHours } : {}),
  };
  const query = input.id ? supabase.from("tasks").update(payload).eq("id", input.id) : supabase.from("tasks").insert(payload);
  let { error } = await query;
  if (error && selfServe && (error.code === "42501" || /row-level security/i.test(error.message))) {
    const admin = createServiceClient();
    if (!admin) throw new PortalError("Your role does not allow that change.");
    ({ error } = await admin.from("tasks").insert(payload));
  }
  raise(error);
  if (input.assigneeId && input.assigneeId !== user.id) {
    await ping(input.assigneeId, "Task assigned", `${input.title} on ${project.name}.`, `/projects/${project.id}`);
  }
  await trail(user, "task.save", "task", input.id, `Saved task ${input.title}.`);
}

export async function setTaskStatus(user: SessionUser, taskId: string, status: Task["status"]) {
  const supabase = await client();
  const { data, error } = await supabase.from("tasks").select("*").eq("id", taskId).maybeSingle();
  raise(error);
  if (!data) throw new PortalError("That task was not found.");
  const task = mapTask(data);
  const project = await loadProject(task.projectId);
  if (!canEditTask(user, task, project)) throw new PortalError("You cannot update this task.");
  const { error: updateError } = await supabase.from("tasks").update({ status }).eq("id", taskId);
  raise(updateError);
  if (status === "done" && task.status !== "done") {
    const { data: memberRows, error: memberError } = await supabase.from("project_members").select("user_id, member_role").eq("project_id", project.id);
    raise(memberError);
    const projectMembers = (memberRows ?? []).map((row) => ({
      projectId: project.id,
      userId: text(row.user_id),
      memberRole: text(row.member_role),
      billRate: 0,
    }));
    for (const lead of projectLeads(project, projectMembers)) {
      if (lead === user.id) continue;
      await ping(lead, "Task done", `${user.fullName} moved “${task.title}” to Done on ${project.name}.`, "/work");
    }
  }
  await trail(user, "task.status", "task", taskId, `Set “${task.title}” to ${status.replaceAll("_", " ")}.`);
}

function assertHours(input: Timesheet) {
  if (!input.projectId || !input.workDate) throw new PortalError("Project and date are required.");
  if (input.hours <= 0 || input.hours > 24) throw new PortalError("Hours must be greater than 0 and at most 24.");
}

export async function saveTimesheet(user: SessionUser, input: Timesheet) {
  if (user.roleSlug === "director") throw new PortalError("The director reads DSR. They do not file one.");
  if (!can(user, "timesheets.submit")) throw new PortalError("You cannot submit timesheets.");
  assertHours(input);
  const project = await loadProject(input.projectId);
  const supabase = await client();
  const { data: membership } = await supabase.from("project_members").select("user_id").eq("project_id", project.id).eq("user_id", user.id).maybeSingle();
  if (!projectVisible(user, project, membership ? [{ projectId: project.id, userId: user.id, memberRole: "", billRate: 0 }] : [])) {
    throw new PortalError("You are not on this project.");
  }
  const { data: sameDay, error: dayError } = await supabase.from("timesheets").select("id, status, invoice_id").eq("user_id", user.id).eq("work_date", input.workDate);
  raise(dayError);
  const rows = sameDay ?? [];
  if (rows.some((row) => row.invoice_id || row.status === "approved")) {
    throw new PortalError(`The DSR for ${prettyDate(input.workDate)} is already approved, so it cannot be replaced.`);
  }
  const payload = {
    user_id: user.id,
    project_id: input.projectId,
    task_id: uuid(input.taskId),
    feature_id: uuid(input.featureId),
    work_date: input.workDate,
    hours: input.hours,
    billable: input.billable,
    description: input.description,
    status: "draft",
    approved_by: null,
    approved_at: null,
    rejection_note: "",
    invoice_id: null,
  };
  const [keeper, ...extras] = rows;
  if (extras.length) {
    const { error: extraError } = await supabase.from("timesheets").delete().in("id", extras.map((row) => row.id));
    if (extraError) {
      const admin = createServiceClient();
      if (!admin) raise(extraError);
      else {
        const { error: adminError } = await admin.from("timesheets").delete().in("id", extras.map((row) => row.id));
        raise(adminError);
      }
    }
  }
  const query = keeper
    ? supabase.from("timesheets").update(payload).eq("id", keeper.id).eq("user_id", user.id)
    : supabase.from("timesheets").insert(payload);
  const { error } = await query;
  raise(error);
  const members = await milestoneMembers(project.id);
  for (const lead of projectLeads(project, members)) {
    if (lead === user.id) continue;
    await ping(lead, keeper ? "DSR updated" : "DSR filled", `${user.fullName} ${keeper ? "replaced" : "filled"} the DSR for ${prettyDate(input.workDate)} on ${project.name}.`, `/timesheets?project=${project.id}`);
  }
  await trail(user, "timesheet.save", "timesheet", text(keeper?.id), `${keeper ? "Replaced" : "Logged"} ${input.hours}h on ${project.name}.`);
  return { overwritten: Boolean(keeper) };
}

export async function deleteTimesheet(user: SessionUser, id: string) {
  const supabase = await client();
  const { data, error } = await supabase.from("timesheets").select("*").eq("id", id).maybeSingle();
  raise(error);
  if (!data) throw new PortalError("That log was not found.");
  if (data.user_id !== user.id || (data.status !== "draft" && data.status !== "rejected")) {
    throw new PortalError("Only a draft or returned log can be removed.");
  }
  const { error: deleteError } = await supabase.from("timesheets").delete().eq("id", id);
  raise(deleteError);
  await trail(user, "timesheet.delete", "timesheet", id, "Removed a draft timesheet.");
}

export async function submitTimesheets(user: SessionUser, ids: string[]) {
  if (!ids.length) throw new PortalError("Nothing in draft to submit.");
  const supabase = await client();
  const { data, error } = await supabase.from("timesheets").select("*").in("id", ids);
  raise(error);
  const rows = data ?? [];
  if (!rows.length) throw new PortalError("Nothing in draft to submit.");
  for (const row of rows) {
    if (row.user_id !== user.id || (row.status !== "draft" && row.status !== "rejected")) {
      throw new PortalError("You can submit only your draft or returned logs.");
    }
    const { error: updateError } = await supabase.from("timesheets").update({ status: "submitted", rejection_note: "" }).eq("id", row.id);
    raise(updateError);
    const project = await loadProject(row.project_id);
    await ping(project.ownerId, "Timesheet submitted", `${user.fullName} submitted ${row.hours}h on ${project.name}.`, "/timesheets");
  }
  await trail(user, "timesheet.submit", "timesheet", ids[0] ?? "", `Submitted ${rows.length} timesheet${rows.length === 1 ? "" : "s"}.`);
}

export async function decideTimesheet(user: SessionUser, id: string, status: "approved" | "rejected", note: string) {
  const supabase = await client();
  const { data, error } = await supabase.from("timesheets").select("*").eq("id", id).maybeSingle();
  raise(error);
  if (!data) throw new PortalError("That log was not found.");
  const project = await loadProject(data.project_id);
  if (!canApproveProject(user, project)) throw new PortalError("You cannot decide time on this project.");
  if (data.status !== "submitted") throw new PortalError("Only submitted time can be decided.");
  if (data.user_id === user.id) throw new PortalError("Ask another owner to decide your own time.");
  const { error: updateError } = await supabase
    .from("timesheets")
    .update({ status, approved_by: user.id, approved_at: stamp(), rejection_note: status === "rejected" ? note : "" })
    .eq("id", id);
  raise(updateError);
  await ping(
    data.user_id,
    status === "approved" ? "Timesheet approved" : "Timesheet returned",
    status === "approved" ? `${data.hours}h on ${project.name} was approved.` : note || `Hours on ${project.name} were returned.`,
    "/timesheets",
  );
  await trail(user, `timesheet.${status}`, "timesheet", id, `${status === "approved" ? "Approved" : "Returned"} a timesheet on ${project.name}.`);
}

export async function saveRate(user: SessionUser, input: RateCard) {
  if (!can(user, "billing.rates")) throw new PortalError("You cannot manage rates.");
  if (!input.label || input.hourlyRate < 0) throw new PortalError("A rate needs a label and an amount.");
  const supabase = await client();
  const payload = {
    label: input.label,
    scope: input.scope,
    target_id: input.targetId,
    hourly_rate: input.hourlyRate,
    currency: await studioCurrency(),
    effective_from: uuid(input.effectiveFrom),
  };
  const query = input.id ? supabase.from("rates").update(payload).eq("id", input.id) : supabase.from("rates").insert(payload);
  const { error } = await query;
  raise(error);
  await trail(user, "rate.save", "rate", input.id, `Saved rate ${input.label}.`);
}

export async function createInvoice(user: SessionUser, input: { projectId: string; from: string; to: string; taxRate: number; notes: string }) {
  if (!can(user, "invoices.manage")) throw new PortalError("You cannot generate invoices.");
  const project = await loadProject(input.projectId);
  const supabase = await client();
  const [{ data: times, error: timeError }, { data: features, error: featureError }, { data: members, error: memberError }, { data: rates, error: rateError }, { data: profiles, error: profileError }] =
    await Promise.all([
      supabase.from("timesheets").select("*").eq("project_id", project.id),
      supabase.from("features").select("*").eq("project_id", project.id),
      supabase.from("project_members").select("*").eq("project_id", project.id),
      supabase.from("rates").select("*"),
      supabase.from("profiles").select("id, role_id"),
    ]);
  raise(timeError);
  raise(featureError);
  raise(memberError);
  raise(rateError);
  raise(profileError);
  const mappedFeatures = (features ?? []).map(mapFeature);
  const mappedMembers = (members ?? []).map((row) => ({ projectId: text(row.project_id), userId: text(row.user_id), memberRole: text(row.member_role), billRate: num(row.bill_rate) }));
  const mappedRates = (rates ?? []).map(mapRate);
  const users = (profiles ?? []).map((row) => ({ id: row.id as string, roleId: text(row.role_id), fullName: "", email: "", title: "", phone: "", roleName: "", roleSlug: "", status: "active" as const, hourlyCost: 0 }));
  const entries = (times ?? [])
    .map(mapTime)
    .filter((item) => item.status === "approved" && item.billable && !item.invoiceId && item.workDate >= input.from && item.workDate <= input.to);
  if (!entries.length) throw new PortalError("No approved billable hours are waiting in that range.");
  const groups = new Map<string, Timesheet[]>();
  for (const entry of entries) groups.set(entry.featureId || "none", [...(groups.get(entry.featureId || "none") ?? []), entry]);
  const year = new Date().getFullYear();
  const { count } = await supabase.from("invoices").select("id", { count: "exact", head: true });
  const number = `INV-${year}-${String((count ?? 0) + 18).padStart(3, "0")}`;
  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({
      number,
      client_id: project.clientId,
      project_id: project.id,
      issue_date: todayIso(),
      due_date: addDays(todayIso(), 15),
      status: "draft",
      tax_rate: input.taxRate,
      notes: input.notes,
      created_by: user.id,
    })
    .select("id")
    .single();
  raise(error);
  if (!invoice) throw new PortalError("The invoice could not be drafted.");
  const lines = [...groups.entries()].map(([featureId, group]) => {
    const feature = mappedFeatures.find((item) => item.id === featureId);
    const logged = group.reduce((sum, entry) => sum + entry.hours, 0);
    const rate = feature?.billingType === "fixed" ? 0 : feature?.hourlyRate || resolveBillRate(group[0], mappedFeatures, mappedMembers, mappedRates, users);
    return {
      invoice_id: invoice.id,
      feature_id: uuid(featureId === "none" ? "" : featureId),
      description: feature?.name || "Unassigned work",
      hours: roundMoney(logged),
      rate,
      amount: feature?.billingType === "fixed" ? feature.fixedAmount : roundMoney(logged * rate),
    };
  });
  const { error: lineError } = await supabase.from("invoice_lines").insert(lines);
  raise(lineError);
  const { error: linkError } = await supabase.from("timesheets").update({ invoice_id: invoice.id }).in("id", entries.map((entry) => entry.id));
  raise(linkError);
  await ping(user.id, "Invoice drafted", `${number} was created for ${project.name}.`, `/invoices/${invoice.id}`);
  await trail(user, "invoice.create", "invoice", invoice.id, `Drafted ${number} from approved hours.`);
  return invoice.id as string;
}

export async function setInvoiceStatus(user: SessionUser, id: string, status: "sent" | "void") {
  if (!can(user, "invoices.manage")) throw new PortalError("You cannot update invoices.");
  const supabase = await client();
  const { data, error } = await supabase.from("invoices").select("*").eq("id", id).maybeSingle();
  raise(error);
  if (!data) throw new PortalError("That invoice was not found.");
  if (status === "void") {
    const { data: payments, error: paymentError } = await supabase.from("payments").select("id, status").eq("invoice_id", id);
    raise(paymentError);
    if ((payments ?? []).some((payment) => payment.status === "completed")) throw new PortalError("Void is blocked because a completed receipt is linked.");
    const { error: unlinkError } = await supabase.from("timesheets").update({ invoice_id: null }).eq("invoice_id", id);
    raise(unlinkError);
    const { error: updateError } = await supabase.from("invoices").update({ status: "void" }).eq("id", id);
    raise(updateError);
  } else {
    const { error: updateError } = await supabase.from("invoices").update({ status: "sent" }).eq("id", id);
    raise(updateError);
    await syncInvoice(id);
  }
  await trail(user, "invoice.status", "invoice", id, `Updated ${data.number}.`);
}

export async function savePayment(user: SessionUser, input: Payment) {
  if (!can(user, "payments.manage")) throw new PortalError("You cannot initiate payments.");
  if (input.amount <= 0) throw new PortalError("Amount must be greater than zero.");
  if (input.direction === "incoming" && !input.clientId) throw new PortalError("Choose the client who is paying.");
  if (input.direction === "outgoing" && !input.userId) throw new PortalError("Choose the team member being paid.");
  const supabase = await client();
  const { count } = await supabase.from("payments").select("id", { count: "exact", head: true });
  const { data, error } = await supabase
    .from("payments")
    .insert({
      direction: input.direction,
      client_id: uuid(input.clientId),
      user_id: uuid(input.userId),
      invoice_id: uuid(input.invoiceId),
      project_id: uuid(input.projectId),
      amount: input.amount,
      currency: await studioCurrency(),
      method: input.method,
      status: "initiated",
      reference: input.reference || `RCPT-${(count ?? 0) + 100}`,
      notes: input.notes,
      created_by: user.id,
    })
    .select("id, reference")
    .single();
  raise(error);
  if (!data) throw new PortalError("That payment could not be initiated.");
  if (input.invoiceId) await syncInvoice(input.invoiceId);
  await ping(user.id, "Payment initiated", `${data.reference} is an initiated ${input.direction === "incoming" ? "client receipt" : "team payout"}.`, "/payments");
  await trail(user, "payment.initiate", "payment", data.id, `Initiated ${data.reference} for ${input.amount}.`);
}

export async function setPaymentStatus(user: SessionUser, id: string, status: Payment["status"]) {
  if (!can(user, "payments.manage")) throw new PortalError("You cannot update payments.");
  const supabase = await client();
  const { data, error } = await supabase.from("payments").select("*").eq("id", id).maybeSingle();
  raise(error);
  if (!data) throw new PortalError("That payment was not found.");
  const { error: updateError } = await supabase.from("payments").update({ status, paid_at: status === "completed" ? todayIso() : null }).eq("id", id);
  raise(updateError);
  if (data.invoice_id) await syncInvoice(data.invoice_id);
  if (data.user_id) await ping(data.user_id, "Payout updated", `${data.reference} is now ${status}.`, "/notifications");
  await trail(user, "payment.status", "payment", id, `Set ${data.reference} to ${status}.`);
}

export async function saveRole(user: SessionUser, input: Role) {
  if (!can(user, "settings.manage")) throw new PortalError("You cannot manage roles.");
  if (!input.name) throw new PortalError("Role name is required.");
  const slug = (input.slug || input.name).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  const supabase = await client();
  if (input.id) {
    const { data: existing, error: readError } = await supabase.from("roles").select("locked").eq("id", input.id).maybeSingle();
    raise(readError);
    if (existing?.locked) throw new PortalError("The director role stays locked so the studio always has a super admin.");
    const { error } = await supabase.from("roles").update({ name: input.name, description: input.description }).eq("id", input.id);
    raise(error);
  } else {
    const { error } = await supabase.from("roles").insert({ name: input.name, slug, description: input.description, is_system: false, locked: false });
    raise(error);
  }
  await trail(user, "role.save", "role", input.id, `Saved role ${input.name}.`);
}

export async function setGrants(user: SessionUser, roleId: string, permissions: PermissionKey[]) {
  if (!can(user, "settings.manage")) throw new PortalError("You cannot change permissions.");
  const supabase = await client();
  const { data: role, error } = await supabase.from("roles").select("id, locked, name").eq("id", roleId).maybeSingle();
  raise(error);
  if (!role) throw new PortalError("That role was not found.");
  if (role.locked) throw new PortalError("Director permissions stay fully enabled.");
  const { error: deleteError } = await supabase.from("role_permissions").delete().eq("role_id", roleId);
  raise(deleteError);
  if (permissions.length) {
    const { error: insertError } = await supabase.from("role_permissions").insert(permissions.map((permission) => ({ role_id: roleId, permission_key: permission })));
    raise(insertError);
  }
  await trail(user, "role.grants", "role", roleId, `Updated permissions for ${role.name}.`);
}

export async function saveStaff(
  user: SessionUser,
  input: { id: string; fullName: string; email: string; password: string; title: string; phone: string; roleId: string; status: DirectoryUser["status"]; hourlyCost: number },
) {
  if (!can(user, "team.manage")) throw new PortalError("You cannot manage the team.");
  if (!input.fullName || !input.email) throw new PortalError("Name and email are required.");
  if (input.id === user.id && input.roleId !== user.roleId) throw new PortalError("You cannot change your own role.");
  const supabase = await client();
  const { data: role, error: roleError } = await supabase.from("roles").select("id, slug").eq("id", input.roleId).maybeSingle();
  raise(roleError);
  if (!role) throw new PortalError("Choose a role.");
  if (!input.id) {
    const admin = createServiceClient();
    if (!admin) throw new PortalError("Set SUPABASE_SERVICE_ROLE_KEY to create team members from the portal.");
    if (input.password.length < 6) throw new PortalError("A new member needs a password of at least 6 characters.");
    const { data, error } = await admin.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: { full_name: input.fullName, role_slug: role.slug, title: input.title },
    });
    if (error) throw new PortalError(error.message);
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ full_name: input.fullName, title: input.title, phone: input.phone, role_id: role.id, status: input.status, hourly_cost: input.hourlyCost })
      .eq("id", data.user.id);
    raise(profileError);
  } else {
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: input.fullName, email: input.email, title: input.title, phone: input.phone, role_id: role.id, status: input.status, hourly_cost: input.hourlyCost })
      .eq("id", input.id);
    raise(error);
    if (input.password) {
      const admin = createServiceClient();
      if (!admin) throw new PortalError("Set SUPABASE_SERVICE_ROLE_KEY to reset a password.");
      const { error: passwordError } = await admin.auth.admin.updateUserById(input.id, { password: input.password });
      if (passwordError) throw new PortalError(passwordError.message);
    }
  }
  await trail(user, "team.save", "user", input.id, `Saved team member ${input.fullName}.`);
}

export async function saveProfile(user: SessionUser, input: { fullName: string; title: string; phone: string; about: string; email: string; password: string }) {
  if (!can(user, "profile.edit")) throw new PortalError("You cannot update your profile.");
  if (!input.fullName.trim()) throw new PortalError("Name is required.");
  const email = input.email.trim().toLowerCase();
  if (!email.includes("@")) throw new PortalError("Enter a valid email.");
  if (input.password && input.password.length < 6) throw new PortalError("Use a password of at least 6 characters.");
  const supabase = await client();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: input.fullName.trim(), title: input.title.trim(), phone: input.phone.trim(), email, about: input.about.trim() })
    .eq("id", user.id);
  raise(error);
  const admin = createServiceClient();
  const emailChanged = email !== user.email.toLowerCase();
  if (input.password || emailChanged) {
    if (!admin) throw new PortalError("Set SUPABASE_SERVICE_ROLE_KEY to change the sign-in email or password.");
    const { error: authError } = await admin.auth.admin.updateUserById(user.id, {
      email: emailChanged ? email : undefined,
      password: input.password || undefined,
      user_metadata: { full_name: input.fullName.trim(), about: input.about.trim(), avatar_url: user.avatarUrl },
    });
    if (authError) throw new PortalError(authError.message);
  } else if (admin) {
    await admin.auth.admin.updateUserById(user.id, {
      user_metadata: { full_name: input.fullName.trim(), about: input.about.trim(), avatar_url: user.avatarUrl },
    });
  }
  await trail(user, "profile.save", "user", user.id, "Updated their profile.");
}

export async function saveAvatar(user: SessionUser, bytes: Uint8Array, contentType: string) {
  const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  const admin = createServiceClient();
  if (!admin) throw new PortalError("Set SUPABASE_SERVICE_ROLE_KEY to upload a profile picture.");
  const bucket = await admin.storage.getBucket("avatars");
  if (bucket.error) {
    const created = await admin.storage.createBucket("avatars", { public: true });
    if (created.error && !/already exists/i.test(created.error.message)) throw new PortalError(created.error.message);
  }
  const path = `${user.id}/avatar.${ext}`;
  const { error } = await admin.storage.from("avatars").upload(path, bytes, { upsert: true, contentType, cacheControl: "3600" });
  if (error) throw new PortalError(error.message);
  const { data } = admin.storage.from("avatars").getPublicUrl(path);
  const avatarUrl = `${data.publicUrl}?v=${Date.now()}`;
  const { error: metaError } = await admin.auth.admin.updateUserById(user.id, {
    user_metadata: { full_name: user.fullName, about: user.about, avatar_url: avatarUrl },
  });
  if (metaError) throw new PortalError(metaError.message);
  await trail(user, "profile.avatar", "user", user.id, "Updated their profile picture.");
}

export async function saveProjectNote(user: SessionUser, projectId: string, note: string) {
  const textNote = note.trim();
  if (textNote.length < 3) throw new PortalError("Write a short record of what changed.");
  if (textNote.length > 500) throw new PortalError("Keep the record under 500 characters.");
  const project = await loadProject(projectId);
  const members = await milestoneMembers(project.id);
  if (!projectVisible(user, project, members)) throw new PortalError("That project is outside your access.");
  await trail(user, "project.note", "project", projectId, textNote);
  await tellLeads(user, project, members, "Project record", `${user.fullName} recorded a note on ${project.name}.`);
}

export async function projectLog(user: SessionUser, projectId: string) {
  const project = await loadProject(projectId);
  const members = await milestoneMembers(project.id);
  if (!projectVisible(user, project, members)) throw new PortalError("That project is outside your access.");
  const supabase = await client();
  const [{ data: milestones }, { data: tasks }] = await Promise.all([
    supabase.from("milestones").select("id").eq("project_id", projectId),
    supabase.from("tasks").select("id").eq("project_id", projectId),
  ]);
  const ids = [projectId, ...(milestones ?? []).map((row) => row.id as string), ...(tasks ?? []).map((row) => row.id as string)];
  const admin = createServiceClient();
  const reader = admin ?? supabase;
  const { data, error } = await reader.from("audit_logs").select("id, actor_id, action, entity, entity_id, summary, created_at").in("entity_id", ids).order("created_at", { ascending: false }).limit(40);
  raise(error);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    actorId: text(row.actor_id),
    action: text(row.action),
    entity: text(row.entity),
    entityId: text(row.entity_id),
    summary: text(row.summary),
    createdAt: text(row.created_at),
  }));
}

export async function markNotifications(user: SessionUser, id: string) {
  const supabase = await client();
  const query = supabase.from("notifications").update({ read: true }).eq("user_id", user.id);
  const { error } = id === "all" ? await query : await query.eq("id", id);
  raise(error);
}

async function visibleProject(user: SessionUser, projectId: string) {
  const project = await loadProject(projectId);
  const members = await milestoneMembers(project.id);
  if (!projectVisible(user, project, members)) throw new PortalError("That project is outside your access.");
  return project;
}

async function ensureClient(user: SessionUser, name: string) {
  const company = name.trim();
  if (!company) throw new PortalError("Client name is required.");
  const supabase = await client();
  const { data, error } = await supabase.from("clients").select("id, name, company");
  raise(error);
  const found = (data ?? []).find((row) => text(row.company).toLowerCase() === company.toLowerCase() || text(row.name).toLowerCase() === company.toLowerCase());
  if (found) return text(found.id);
  const payload = { name: company, company, currency: await studioCurrency(), status: "active" };
  let inserted = await supabase.from("clients").insert(payload).select("id").single();
  if (inserted.error) {
    const admin = createServiceClient();
    if (!admin || !canFileIntake(user)) throw new PortalError(inserted.error.message);
    inserted = await admin.from("clients").insert(payload).select("id").single();
  }
  raise(inserted.error);
  if (!inserted.data) throw new PortalError("That client could not be created.");
  return text(inserted.data.id);
}

async function storeProjectFile(user: SessionUser, projectId: string, kind: "requirement" | "sow", file: File) {
  if (file.size > 8_000_000) throw new PortalError("Keep each file under 8 MB.");
  const allowed = ["pdf", "doc", "docx", "txt", "vtt"];
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  if (kind === "sow" && ext !== "pdf") throw new PortalError("The SOW file must be a PDF.");
  if (!allowed.includes(ext)) throw new PortalError("Upload a PDF, Word, text, or transcript file.");
  const admin = createServiceClient();
  if (!admin) throw new PortalError("Set SUPABASE_SERVICE_ROLE_KEY to upload project files.");
  const bucket = await admin.storage.getBucket("project-docs");
  if (bucket.error) {
    const created = await admin.storage.createBucket("project-docs", { public: false });
    if (created.error && !/already exists/i.test(created.error.message)) throw new PortalError(created.error.message);
  }
  const safe = file.name.replace(/[^\w.\- ]+/g, "").slice(0, 80) || `file.${ext}`;
  const path = `${projectId}/${kind}/${crypto.randomUUID()}-${safe}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error } = await admin.storage.from("project-docs").upload(path, bytes, { contentType: file.type || "application/octet-stream", upsert: false });
  if (error) throw new PortalError(error.message);
  const supabase = await client();
  const { error: rowError } = await supabase.from("project_files").insert({
    project_id: projectId,
    kind,
    file_name: file.name,
    storage_path: path,
    created_by: user.id,
  });
  if (rowError) {
    const { error: adminError } = await admin.from("project_files").insert({
      project_id: projectId,
      kind,
      file_name: file.name,
      storage_path: path,
      created_by: user.id,
    });
    raise(adminError);
  }
  if (kind === "sow") {
    const { error: sowError } = await supabase.from("projects").update({ sow_file_name: file.name, sow_file_path: path }).eq("id", projectId);
    if (sowError) {
      const { error: adminError } = await admin.from("projects").update({ sow_file_name: file.name, sow_file_path: path }).eq("id", projectId);
      raise(adminError);
    }
  }
}

export async function clientDirectory(user: SessionUser) {
  if (!canFileIntake(user)) throw new PortalError("You cannot view client profiles.");
  const supabase = await client();
  const { data, error } = await supabase.from("clients").select("id, name, company, email, phone, billing_email, address, tax_id, currency, status, notes").order("name");
  raise(error);
  return (data ?? []).map(mapClient).filter((item) => item.status === "active");
}

export async function organizations(user: SessionUser) {
  if (!canFileIntake(user)) throw new PortalError("You cannot view organizations.");
  const supabase = await client();
  const { data, error } = await supabase.from("organizations").select("name, status").eq("status", "active").order("name");
  raise(error);
  return (data ?? []).map((row) => text(row.name)).filter(Boolean);
}

export async function intakeOwners(user: SessionUser) {
  if (!canFileIntake(user)) throw new PortalError("You cannot view intake owners.");
  const supabase = await client();
  const { data, error } = await supabase.from("profiles").select("id, full_name, status, roles(name, slug)").eq("status", "active");
  raise(error);
  return (data ?? [])
    .flatMap((row) => {
      const role = Array.isArray(row.roles) ? row.roles[0] : row.roles;
      const slug = text(role?.slug);
      if (!isIntakeOwner(slug)) return [];
      return [{ id: text(row.id), fullName: text(row.full_name), roleName: text(role?.name) }];
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}

export async function submitIntake(user: SessionUser, input: IntakeRequest, files: File[]) {
  if (!canFileIntake(user)) throw new PortalError("You cannot submit a project intake.");
  assertIntake(input, await organizations(user));
  const owners = await intakeOwners(user);
  const owner = owners.find((person) => person.id === input.ownerId);
  if (!owner) throw new PortalError("Choose an admin or a project owner.");
  const ownerId = owner.id;
  const clientId = await ensureClient(user, input.clientName);
  const matched = clientForProfile(await clientDirectory(user), user);
  const initiated = matched ?? { name: user.fullName, email: user.email, billingEmail: "" };
  const supabase = await client();
  const defaults = sowDefaults();
  const payload = {
    client_id: clientId,
    name: input.name.trim(),
    code: input.name.trim().replace(/\s+/g, "-").slice(0, 16).toUpperCase(),
    description: input.summary.trim(),
    status: "planning",
    billing_model: "hourly",
    start_date: uuid(input.startDate),
    end_date: uuid(input.dueDate),
    owner_id: ownerId,
    initiated_by: uuid(matched?.id || ""),
    initiated_for: input.clientName.trim(),
    initiated_from: input.initiatedFrom.trim(),
    currency: await studioCurrency(),
    estimated_hours: input.estimatedHours,
    source: input.source,
    sow_stage: defaults.sowStage,
    delivery_status: defaults.deliveryStatus,
    billing_terms: defaults.billingTerms,
    approval_status: defaults.approvalStatus,
    invoicing_status: defaults.invoicingStatus,
    payment_status: defaults.paymentStatus,
    activated: false,
  };
  let inserted = await supabase.from("projects").insert(payload).select("id").single();
  if (inserted.error) {
    const admin = createServiceClient();
    if (!admin) raise(inserted.error);
    else inserted = await admin.from("projects").insert(payload).select("id").single();
  }
  raise(inserted.error);
  const data = inserted.data;
  if (!data) throw new PortalError("That intake could not be saved.");
  const members = [{ project_id: data.id, user_id: ownerId, member_role: "Owner", bill_rate: 0 }];
  if (ownerId !== user.id) members.push({ project_id: data.id, user_id: user.id, member_role: user.roleName, bill_rate: 0 });
  const { error: memberError } = await supabase.from("project_members").insert(members);
  if (memberError) {
    const admin = createServiceClient();
    if (!admin) raise(memberError);
    else {
      const { error: adminError } = await admin.from("project_members").insert(members);
      raise(adminError);
    }
  }
  for (const file of files) {
    if (file.size > 0) await storeProjectFile(user, data.id, "requirement", file);
  }
  await trail(user, "project.intake", "project", data.id, `Submitted intake ${input.name.trim()}.`);
  await notifyIntake(user, ownerId, initiated, input.name.trim());
  return data.id as string;
}

async function notifyIntake(user: SessionUser, ownerId: string, initiated: { name: string; email: string; billingEmail: string }, projectName: string) {
  const supabase = await client();
  const { data: profiles, error } = await supabase.from("profiles").select("id, full_name, email, role_id, status");
  raise(error);
  const { data: roles, error: roleError } = await supabase.from("roles").select("id, slug");
  raise(roleError);
  const slugOf = new Map((roles ?? []).map((role) => [text(role.id), text(role.slug)]));
  const active = (profiles ?? []).filter((person) => person.status === "active");
  const targets = new Set<string>();
  if (ownerId) targets.add(ownerId);
  for (const person of active) {
    const slug = slugOf.get(text(person.role_id));
    if (slug === "client" || slug === "admin" || slug === "director") targets.add(text(person.id));
    const email = text(person.email).toLowerCase();
    const matchesProfile = (initiated.email && email === initiated.email.toLowerCase()) || (initiated.billingEmail && email === initiated.billingEmail.toLowerCase()) || text(person.full_name).toLowerCase() === initiated.name.toLowerCase();
    if (matchesProfile) targets.add(text(person.id));
  }
  const body = `${user.fullName} completed intake for ${projectName}. It is ready for SOW.`;
  for (const id of targets) await ping(id, "Project intake completed", body, "/sow");
}

export async function saveSow(user: SessionUser, input: Project) {
  const existing = await visibleProject(user, input.id);
  if (!canManageProject(user, existing) && !can(user, "projects.view_all")) throw new PortalError("You cannot finalise this SOW.");
  const supabase = await client();
  const { error } = await supabase
    .from("projects")
    .update({
      name: input.name,
      client_id: input.clientId,
      description: input.description,
      budget_amount: input.budgetAmount,
      currency: await studioCurrency(),
      billing_terms: input.billingTerms,
      billing_model: billingModelFor(input.billingTerms),
      start_date: uuid(input.startDate),
      end_date: uuid(input.endDate),
      approval_status: input.approvalStatus,
      renewal_date: uuid(input.renewalDate),
      scope: input.scope,
      deliverables: input.deliverables,
      risks: input.risks,
      pending_actions: input.pendingActions,
      owner_id: input.ownerId || existing.ownerId,
      delivery_owner_id: uuid(input.deliveryOwnerId),
      estimated_hours: input.estimatedHours,
      invoicing_status: input.invoicingStatus || "Not invoiced",
      payment_status: input.paymentStatus,
    })
    .eq("id", existing.id);
  raise(error);
  await trail(user, "project.sow", "project", existing.id, `Updated the SOW for ${input.name}.`);
}

export async function setDeliveryStatus(user: SessionUser, projectId: string, deliveryStatus: Project["deliveryStatus"]) {
  const project = await visibleProject(user, projectId);
  if (!canManageProject(user, project) && !can(user, "projects.view_all")) throw new PortalError("You cannot change this project status.");
  const supabase = await client();
  const { error } = await supabase
    .from("projects")
    .update({ delivery_status: deliveryStatus, status: statusForDelivery(deliveryStatus, project.activated) })
    .eq("id", projectId);
  raise(error);
  await trail(user, "project.status", "project", projectId, `Set ${project.name} to ${deliveryStatus.replaceAll("_", " ")}.`);
}

export async function uploadSowFile(user: SessionUser, projectId: string, file: File) {
  const project = await visibleProject(user, projectId);
  if (!canManageProject(user, project) && !can(user, "projects.view_all")) throw new PortalError("You cannot attach a SOW.");
  if (!(file instanceof File) || file.size === 0) throw new PortalError("Choose a SOW PDF.");
  await storeProjectFile(user, projectId, "sow", file);
  await trail(user, "project.sow_file", "project", projectId, `Attached the SOW for ${project.name}.`);
}

export async function finaliseSow(user: SessionUser, projectId: string) {
  const project = await visibleProject(user, projectId);
  if (!canManageProject(user, project) && !can(user, "projects.view_all")) throw new PortalError("You cannot finalise this SOW.");
  if (project.sowStage === "finalised") return;
  const supabase = await client();
  const { error } = await supabase.from("projects").update({ sow_stage: "finalised" }).eq("id", projectId);
  raise(error);
  await trail(user, "project.finalise", "project", projectId, `Finalised the SOW for ${project.name}.`);
  await ping(project.ownerId, "SOW finalised", `${project.name} can now be staffed.`, "/resources");
}

export async function activateProject(user: SessionUser, projectId: string) {
  const project = await visibleProject(user, projectId);
  if (project.sowStage !== "finalised") throw new PortalError("Finalise the SOW before activating the project.");
  if (!canManageProject(user, project) && !can(user, "tasks.manage")) throw new PortalError("You cannot activate this project.");
  const supabase = await client();
  const { error } = await supabase.from("projects").update({ activated: true, status: "active", delivery_status: project.deliveryStatus === "done" ? "done" : "in_progress" }).eq("id", projectId);
  raise(error);
  await trail(user, "project.activate", "project", projectId, `Activated ${project.name} for delivery.`);
}

export async function saveDeliverySheet(
  user: SessionUser,
  projectId: string,
  rows: { id: string; title: string; assigneeId: string; startDate: string; dueDate: string; estimatedHours: number; actualHours: number }[],
) {
  const project = await visibleProject(user, projectId);
  if (!project.activated) throw new PortalError("Activate the project before editing tasks.");
  if (!canEditDelivery(user, project)) throw new PortalError("Only the project owner can edit these tasks.");
  const supabase = await client();
  for (const row of rows) {
    if (!row.id || !row.title.trim()) continue;
    const { error } = await supabase
      .from("tasks")
      .update({
        title: row.title.trim(),
        assignee_id: uuid(row.assigneeId),
        start_date: uuid(row.startDate),
        due_date: uuid(row.dueDate),
        estimated_hours: row.estimatedHours,
        actual_hours: row.actualHours,
      })
      .eq("id", row.id)
      .eq("project_id", projectId);
    raise(error);
  }
  await trail(user, "task.sheet", "project", projectId, `Updated the task sheet for ${project.name}.`);
}

export async function raiseEscalation(
  user: SessionUser,
  input: { projectId: string; type: Escalation["type"]; description: string; ownerName: string; dueDate: string },
) {
  const project = await visibleProject(user, input.projectId);
  if (!input.description.trim()) throw new PortalError("Describe the issue and the support needed.");
  const supabase = await client();
  const { error } = await supabase.from("escalations").insert({
    project_id: project.id,
    type: input.type,
    description: input.description.trim(),
    owner_name: input.ownerName.trim() || user.fullName,
    due_date: uuid(input.dueDate),
    status: "open",
    created_by: user.id,
  });
  raise(error);
  await trail(user, "escalation.raise", "project", project.id, `Raised a ${input.type} on ${project.name}.`);
  await ping(project.ownerId, "Escalation raised", `${user.fullName} raised a ${input.type} on ${project.name}.`, "/escalations");
}

export async function setEscalationStatus(user: SessionUser, id: string, status: Escalation["status"]) {
  const supabase = await client();
  const { data, error } = await supabase.from("escalations").select("id, project_id").eq("id", id).maybeSingle();
  raise(error);
  if (!data) throw new PortalError("That escalation was not found.");
  await visibleProject(user, text(data.project_id));
  if (!can(user, "projects.manage") && !can(user, "projects.view_all") && !can(user, "tasks.manage")) {
    throw new PortalError("You cannot update that escalation.");
  }
  const { error: updateError } = await supabase.from("escalations").update({ status }).eq("id", id);
  raise(updateError);
  await trail(user, "escalation.status", "escalation", id, `Set escalation to ${status.replaceAll("_", " ")}.`);
}

export async function saveStatusSheet(user: SessionUser, rows: StatusUpdate[]) {
  if (!canPublishStatus(user)) throw new PortalError("Only GSVK SAI can upload the status sheet.");
  const supabase = await client();
  const payload = rows.map((row) => {
    const item = presentStatus(row);
    return {
      sheet_no: item.sheetNo,
      project_name: item.project,
      sub_item: item.subItem,
      status: item.status,
      remarks: item.remarks,
      status_date: item.statusDate,
      sheet_label: item.sheetLabel || "",
      company: item.company || "",
      fields: item.fields ?? {},
    };
  });
  const { error: clearError } = await supabase.from("status_updates").delete().gte("sheet_no", 0);
  raise(clearError);
  for (let index = 0; index < payload.length; index += 400) {
    const { error } = await supabase.from("status_updates").insert(payload.slice(index, index + 400));
    raise(error);
  }
  await trail(user, "status.upload", "status_sheet", "status", `Replaced the status history with ${rows.length} ${rows.length === 1 ? "row" : "rows"}.`);
  return rows.length;
}

function sowPayload(row: SowRecord) {
  const item = presentSow(row);
  return {
    id: item.id,
    kind: item.kind,
    sheet_no: item.sheetNo,
    project_name: item.project,
    sprint: item.sprint,
    link: item.link,
    signature: item.signature,
    signed_on: item.signedOn,
    change_request: item.changeRequest,
    company: item.company,
  };
}

export async function saveSowSheet(user: SessionUser, rows: SowRecord[]) {
  if (!canPublishStatus(user)) throw new PortalError("Only the admin can update the SOW status.");
  const supabase = await client();
  const incoming = rows.map(presentSow);
  const kinds = [...new Set(incoming.map((row) => row.kind))];
  if (kinds.length) {
    const { error } = await supabase.from("sow_records").delete().in("kind", kinds);
    raise(error);
  }
  for (let index = 0; index < incoming.length; index += 400) {
    const { error } = await supabase.from("sow_records").insert(incoming.slice(index, index + 400).map(sowPayload));
    raise(error);
  }
  await trail(user, "sow.upload", "sow", "status", `Updated ${incoming.length} SOW ${incoming.length === 1 ? "row" : "rows"}.`);
  return incoming.length;
}

export async function saveSowRecord(user: SessionUser, input: SowRecord) {
  if (!canPublishStatus(user)) throw new PortalError("Only the admin can update the SOW status.");
  const supabase = await client();
  const item = presentSow(input);
  const { error } = await supabase.from("sow_records").update({
    sprint: item.sprint,
    link: item.link,
    signature: item.signature,
    signed_on: item.signedOn,
    change_request: item.changeRequest,
  }).eq("id", item.id);
  raise(error);
  await trail(user, "sow.edit", "sow", item.id, `Updated the SOW for ${item.project}.`);
}

export async function saveWorkstream(user: SessionUser, input: { id: string; ownerName: string; targetDate: string; status: Workstream["status"] }) {
  if (!can(user, "projects.manage") && !can(user, "projects.view_all")) throw new PortalError("You cannot update workstreams.");
  const supabase = await client();
  const { error } = await supabase.from("workstreams").update({ owner_name: input.ownerName, target_date: uuid(input.targetDate), status: input.status }).eq("id", input.id);
  raise(error);
}

function hourlyRecord(user: SessionUser, row: HourlySheetRow) {
  if (row.hours < 0 || row.hours > 24) throw new PortalError("Hours Spent must be from 0 to 24.");
  if (!row.workDate && !row.task && !row.project) throw new PortalError("Each row needs a project or a task.");
  const day = (value: string) => value || null;
  return {
    user_id: user.id,
    role_name: user.roleName,
    sheet_no: row.sheetNo || 0,
    project_name: row.project.trim(),
    sprint: row.sprint.trim(),
    resource_name: row.resource.trim(),
    task: (row.task || row.notes).trim(),
    work_date: day(row.workDate),
    hours: row.hours,
    status: row.status.trim(),
    company: row.company.trim(),
    est_start: day(row.estStart),
    est_end: day(row.estEnd),
    estimated_hours: row.estimatedHours,
    target_hours: row.targetHours,
    actual_start: day(row.actualStart),
    actual_end: day(row.actualEnd),
    actual_hours: row.actualHours,
    approval: row.approval.trim(),
    notes: (row.task || row.notes).trim(),
  };
}

export async function saveHourlySheet(user: SessionUser, rows: HourlySheetRow[]) {
  if (!canUseHourlyTracker(user)) throw new PortalError("You cannot upload an hourly tracker.");
  const incoming = hourlyRowsForUser(rows, user).map((row) => hourlyRecord(user, row));
  const supabase = await client();
  const { error: clearError } = await supabase.from("hourly_entries").delete().eq("user_id", user.id);
  raise(clearError);
  if (incoming.length) {
    const { error } = await supabase.from("hourly_entries").insert(incoming);
    raise(error);
  }
  await trail(user, "hourly.upload", "hourly", user.id, `Uploaded ${incoming.length} hourly ${incoming.length === 1 ? "row" : "rows"} for ${user.roleName}.`);
  return incoming.length;
}

export async function saveHourlyEntry(user: SessionUser, input: HourlyEntry) {
  if (!canUseHourlyTracker(user)) throw new PortalError("You cannot update the hourly tracker.");
  const payload = hourlyRecord(user, {
    sheetNo: input.sheetNo,
    project: input.project,
    sprint: input.sprint,
    resource: input.resource,
    task: input.task || input.notes,
    workDate: input.workDate,
    hours: input.hours,
    status: input.status,
    company: input.company,
    estStart: input.estStart,
    estEnd: input.estEnd,
    estimatedHours: input.estimatedHours,
    targetHours: input.targetHours,
    actualStart: input.actualStart,
    actualEnd: input.actualEnd,
    actualHours: input.actualHours,
    approval: input.approval,
    notes: input.task || input.notes,
    role: "",
    person: input.resource,
  });
  const supabase = await client();
  if (input.id) {
    const { data, error } = await supabase.from("hourly_entries").update(payload).eq("id", input.id).eq("user_id", user.id).select("id");
    raise(error);
    if (!data?.length) throw new PortalError("That hourly row was not found.");
  } else {
    const { error } = await supabase.from("hourly_entries").insert(payload);
    raise(error);
  }
  await trail(user, "hourly.save", "hourly", input.id, `Saved ${payload.hours}h on ${payload.work_date}.`);
}

export async function deleteHourlyEntry(user: SessionUser, id: string) {
  if (!canUseHourlyTracker(user)) throw new PortalError("You cannot update the hourly tracker.");
  const supabase = await client();
  const { data, error } = await supabase.from("hourly_entries").delete().eq("id", id).eq("user_id", user.id).select("id");
  raise(error);
  if (!data?.length) throw new PortalError("That hourly row was not found.");
  await trail(user, "hourly.delete", "hourly", id, "Removed an hourly row.");
}

export async function projectFile(user: SessionUser, id: string): Promise<{ name: string; type: string; bytes: Uint8Array }> {
  const supabase = await client();
  const { data, error } = await supabase.from("project_files").select("id, project_id, file_name, storage_path").eq("id", id).maybeSingle();
  raise(error);
  if (!data) throw new PortalError("That file was not found.");
  await visibleProject(user, text(data.project_id));
  const path = text(data.storage_path);
  if (!path) throw new PortalError("That file has no stored copy.");
  const admin = createServiceClient();
  if (!admin) throw new PortalError("Set SUPABASE_SERVICE_ROLE_KEY to download project files.");
  const downloaded = await admin.storage.from("project-docs").download(path);
  if (downloaded.error || !downloaded.data) throw new PortalError(downloaded.error?.message || "The file could not be downloaded.");
  return { name: text(data.file_name), type: downloaded.data.type || "application/octet-stream", bytes: new Uint8Array(await downloaded.data.arrayBuffer()) };
}

export async function resetDemo(_user?: SessionUser) {
  void _user;
  throw new PortalError("Demo reset is available only before Supabase is connected.");
}

void ALL_PERMISSIONS;
