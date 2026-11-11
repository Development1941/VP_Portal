import type { PermissionKey } from "@/lib/permissions";

export type Role = {
  id: string;
  name: string;
  slug: string;
  description: string;
  isSystem: boolean;
  locked: boolean;
};

export type SessionUser = {
  id: string;
  fullName: string;
  email: string;
  title: string;
  phone: string;
  roleId: string;
  roleName: string;
  roleSlug: string;
  permissions: PermissionKey[];
  status: "active" | "invited" | "inactive";
  avatarUrl: string;
  about: string;
  companyScope?: string;
  sheetEditor?: boolean;
};

export type DirectoryUser = {
  id: string;
  fullName: string;
  email: string;
  title: string;
  phone: string;
  roleId: string;
  roleName: string;
  roleSlug: string;
  status: "active" | "invited" | "inactive";
  hourlyCost: number;
};

export type Client = {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  billingEmail: string;
  address: string;
  taxId: string;
  currency: string;
  status: "active" | "inactive";
  notes: string;
};

export type Project = {
  id: string;
  clientId: string;
  name: string;
  code: string;
  description: string;
  status: "planning" | "active" | "on_hold" | "completed";
  billingModel: "hourly" | "fixed" | "retainer";
  startDate: string;
  endDate: string;
  budgetAmount: number;
  currency: string;
  ownerId: string;
  estimatedHours: number;
  source: "requirement_document" | "proposal" | "meeting_transcript" | "email_thread";
  sowStage: "draft" | "finalised";
  deliveryStatus: "in_progress" | "done" | "blocked";
  billingTerms: "milestone" | "monthly_tm" | "fixed_fee";
  approvalStatus: "signed" | "pending" | "rejected";
  renewalDate: string;
  scope: string;
  deliverables: string;
  risks: string;
  pendingActions: string;
  deliveryOwnerId: string;
  invoicingStatus: string;
  paymentStatus: "paid" | "partially_paid" | "overdue" | "not_due";
  activated: boolean;
  sowFileName: string;
  sowFilePath: string;
  initiatedById: string;
  initiatedFor: string;
  initiatedFrom: string;
};

export type ProjectMember = {
  projectId: string;
  userId: string;
  memberRole: string;
  billRate: number;
};

export type Milestone = {
  id: string;
  projectId: string;
  name: string;
  description: string;
  dueDate: string;
  status: "pending" | "in_progress" | "completed" | "missed";
  amount: number;
  plannedHours: number;
};

export type Feature = {
  id: string;
  projectId: string;
  name: string;
  description: string;
  billingType: "hourly" | "fixed";
  hourlyRate: number;
  fixedAmount: number;
  budgetHours: number;
  status: "planned" | "active" | "done";
};

export type Task = {
  id: string;
  projectId: string;
  milestoneId: string;
  featureId: string;
  title: string;
  description: string;
  assigneeId: string;
  status: "backlog" | "in_progress" | "review" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  dueDate: string;
  startDate: string;
  estimatedHours: number;
  actualHours: number;
};

export type AuditStamp = {
  createdBy?: string;
  createdAt?: string;
  updatedBy?: string;
  updatedAt?: string;
};

export type Escalation = {
  id: string;
  projectId: string;
  type: "blocker" | "concern" | "dependency";
  description: string;
  ownerName: string;
  dueDate: string;
  status: "open" | "in_review" | "resolved";
  createdBy: string;
  createdAt: string;
  projectName?: string;
  sourceEntryId?: string;
  resolutionNote?: string;
  updatedBy?: string;
  updatedAt?: string;
};

export type ChecklistItem = AuditStamp & {
  id: string;
  sheetNo: number;
  project: string;
  sprint: string;
  task: string;
  resource: string;
  completedOn: string;
  status: string;
  clientApproval: string;
  source: "auto" | "manual" | "upload";
};

export type ActivityItem = {
  id: string;
  action: string;
  entity: string;
  summary: string;
  actorName: string;
  createdAt: string;
};

export type ProjectFile = {
  id: string;
  projectId: string;
  kind: "requirement" | "sow";
  fileName: string;
  createdBy: string;
  createdAt: string;
};

export type Workstream = {
  id: string;
  name: string;
  ownerName: string;
  targetDate: string;
  status: "in_progress" | "blocked" | "done";
};

export type TimesheetStatus = "draft" | "submitted" | "approved" | "rejected";

export type Timesheet = {
  id: string;
  userId: string;
  projectId: string;
  taskId: string;
  featureId: string;
  workDate: string;
  hours: number;
  billable: boolean;
  description: string;
  status: TimesheetStatus;
  approvedBy: string;
  approvedAt: string;
  rejectionNote: string;
  invoiceId: string;
};

export type RateCard = {
  id: string;
  label: string;
  scope: "company" | "role" | "user" | "project" | "feature";
  targetId: string;
  hourlyRate: number;
  currency: string;
  effectiveFrom: string;
};

export type InvoiceStatus = "draft" | "sent" | "partial" | "paid" | "void";

export type Invoice = {
  id: string;
  number: string;
  clientId: string;
  projectId: string;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  taxRate: number;
  notes: string;
  createdBy: string;
};

export type InvoiceLine = {
  id: string;
  invoiceId: string;
  featureId: string;
  description: string;
  hours: number;
  rate: number;
  amount: number;
};

export type PaymentStatus = "draft" | "initiated" | "processing" | "completed" | "failed" | "cancelled";

export type Payment = {
  id: string;
  direction: "incoming" | "outgoing";
  clientId: string;
  userId: string;
  invoiceId: string;
  projectId: string;
  amount: number;
  currency: string;
  method: string;
  status: PaymentStatus;
  reference: string;
  notes: string;
  createdBy: string;
  createdAt: string;
  paidAt: string;
};

export type Notification = {
  id: string;
  userId: string;
  title: string;
  body: string;
  href: string;
  read: boolean;
  createdAt: string;
};

export type AuditEntry = {
  id: string;
  actorId: string;
  action: string;
  entity: string;
  entityId: string;
  summary: string;
  createdAt: string;
};

export type FxRate = {
  id: string;
  from: string;
  to: string;
  rate: number;
  source: string;
  recordedAt: string;
};

export type StatusUpdate = AuditStamp & {
  id?: string;
  sheetNo: number;
  project: string;
  subItem: string;
  status: string;
  remarks: string;
  statusDate: string;
  sheetLabel?: string;
  company?: string;
  fields?: Record<string, string>;
};

export type HourlyEntry = AuditStamp & {
  id: string;
  userId: string;
  roleName: string;
  sheetNo: number;
  project: string;
  sprint: string;
  resource: string;
  task: string;
  workDate: string;
  hours: number;
  status: string;
  company: string;
  estStart: string;
  estEnd: string;
  estimatedHours: number | null;
  targetHours: number | null;
  actualStart: string;
  actualEnd: string;
  actualHours: number | null;
  approval: string;
  notes: string;
  blocker?: string;
};

export type SowRecord = AuditStamp & {
  id: string;
  kind: "status" | "bid";
  sheetNo: number;
  project: string;
  sprint: string;
  link: string;
  signature: string;
  signedOn: string;
  changeRequest: string;
  company: string;
};

export type Workspace = {
  currency: string;
  fxRates: FxRate[];
  users: DirectoryUser[];
  roles: Role[];
  grants: { roleId: string; permission: PermissionKey }[];
  clients: Client[];
  projects: Project[];
  members: ProjectMember[];
  milestones: Milestone[];
  features: Feature[];
  tasks: Task[];
  timesheets: Timesheet[];
  rates: RateCard[];
  invoices: Invoice[];
  lines: InvoiceLine[];
  payments: Payment[];
  notifications: Notification[];
  audit: AuditEntry[];
  escalations: Escalation[];
  files: ProjectFile[];
  workstreams: Workstream[];
  statusUpdates: StatusUpdate[];
  sowRecords: SowRecord[];
  hourlyEntries: HourlyEntry[];
  checklistItems: ChecklistItem[];
  activity: ActivityItem[];
};

export type Result = { error?: string };
