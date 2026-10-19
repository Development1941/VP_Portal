import { ROLE_PRESETS } from "@/lib/permissions";
import type { Role, Workspace } from "@/lib/types";
import { addDays, isoDate, startOfWeek, stamp, todayIso } from "@/lib/dates";

export type DemoUser = Workspace["users"][number] & { password: string; avatarUrl?: string; about?: string };

export type DemoStore = Omit<Workspace, "users"> & {
  users: DemoUser[];
};

export function buildSeed(): DemoStore {
  const week = startOfWeek();
  const roles: Role[] = [
    {
      id: "role_director",
      name: "Director",
      slug: "director",
      description: "Super admin with every client, project, rate, invoice, payout, and setting.",
      isSystem: true,
      locked: true,
    },
    {
      id: "role_owner",
      name: "Project Owner",
      slug: "project_owner",
      description: "Runs assigned projects, tasks, milestones, approvals, and budgets.",
      isSystem: true,
      locked: false,
    },
    {
      id: "role_member",
      name: "Team Member",
      slug: "team_member",
      description: "Shared role for developers, designers, QA, and other delivery staff.",
      isSystem: true,
      locked: false,
    },
    {
      id: "role_finance",
      name: "Finance",
      slug: "finance",
      description: "Optional commercial role for invoices, payouts, rates, and profitability.",
      isSystem: false,
      locked: false,
    },
    {
      id: "role_sm",
      name: "Scrum Master",
      slug: "scrum_master",
      description: "SM. Uploads sprints and milestones for the project owner and project manager.",
      isSystem: true,
      locked: false,
    },
  ];

  const grants = (["project_owner", "team_member", "finance", "scrum_master"] as const).flatMap((slug) => {
    const role = roles.find((item) => item.slug === slug)!;
    return ROLE_PRESETS[slug].map((permission) => ({ roleId: role.id, permission }));
  });

  const users: DemoUser[] = [
    {
      id: "usr_ananya",
      fullName: "Harshit Bansal",
      email: "director@embee.local",
      password: "demo123",
      title: "Director",
      phone: "+91 98450 11001",
      roleId: "role_director",
      roleName: "Director",
      roleSlug: "director",
      status: "active",
      hourlyCost: 0,
    },
    {
      id: "usr_vikram",
      fullName: "GSVK SAI",
      email: "owner@embee.local",
      password: "demo123",
      title: "PO/PM",
      phone: "+91 98450 11014",
      roleId: "role_owner",
      roleName: "Project Owner",
      roleSlug: "project_owner",
      status: "active",
      hourlyCost: 1800,
    },
    {
      id: "usr_ishaan",
      fullName: "Bhuvin Singla",
      email: "ishaan@embee.local",
      password: "demo123",
      title: "Developer",
      phone: "+91 98450 11022",
      roleId: "role_member",
      roleName: "Team Member",
      roleSlug: "team_member",
      status: "active",
      hourlyCost: 900,
    },
    {
      id: "usr_sara",
      fullName: "Sara D'Souza",
      email: "sara@embee.local",
      password: "demo123",
      title: "Designer",
      phone: "+91 98450 11027",
      roleId: "role_member",
      roleName: "Team Member",
      roleSlug: "team_member",
      status: "active",
      hourlyCost: 1100,
    },
    {
      id: "usr_neel",
      fullName: "Neel Joshi",
      email: "neel@embee.local",
      password: "demo123",
      title: "QA",
      phone: "+91 98450 11031",
      roleId: "role_member",
      roleName: "Team Member",
      roleSlug: "team_member",
      status: "active",
      hourlyCost: 800,
    },
  ];

  const clients: DemoStore["clients"] = [
    {
      id: "cli_northwind",
      name: "Noble",
      company: "Noble",
      email: "meera@northwind.example",
      phone: "+91 80 4001 2200",
      billingEmail: "accounts@northwind.example",
      address: "12 Residency Road, Bengaluru",
      taxId: "29AABCU9603R1ZM",
      currency: "INR",
      status: "active",
      notes: "Product studio. Prefers feature-wise invoices with GST.",
    },
    {
      id: "cli_helios",
      name: "Arjun Patel",
      company: "Helios Retail",
      email: "arjun@helios.example",
      phone: "+91 22 4002 1180",
      billingEmail: "ap@helios.example",
      address: "Trade Centre, Bandra Kurla Complex, Mumbai",
      taxId: "27AADCH2218Q1Z5",
      currency: "INR",
      status: "active",
      notes: "Fixed-fee inventory API with a monthly support retainer.",
    },
    {
      id: "cli_sable",
      name: "Dr. Lata Menon",
      company: "Sable Health",
      email: "lata@sable.example",
      phone: "+91 484 4003 900",
      billingEmail: "finance@sable.example",
      address: "Marine Drive, Kochi",
      taxId: "32AAGCS7781P1Z8",
      currency: "INR",
      status: "active",
      notes: "Claims desk rollout. Director-owned, clinical review on Fridays.",
    },
  ];

  const projects: DemoStore["projects"] = [
    {
      id: "prj_portal",
      clientId: "cli_northwind",
      name: "Noble",
      code: "NOBLE",
      description: "Noble.",
      status: "active",
      billingModel: "hourly",
      startDate: addDays(todayIso(), -50),
      endDate: addDays(todayIso(), 40),
      budgetAmount: 1800000,
      currency: "INR",
      ownerId: "usr_vikram",
    },
    {
      id: "prj_inventory",
      clientId: "cli_helios",
      name: "Inventory API",
      code: "HX-API",
      description: "Stock, purchase, and store-sync services for Helios retail locations.",
      status: "active",
      billingModel: "fixed",
      startDate: addDays(todayIso(), -30),
      endDate: addDays(todayIso(), 25),
      budgetAmount: 950000,
      currency: "INR",
      ownerId: "usr_vikram",
    },
    {
      id: "prj_claims",
      clientId: "cli_sable",
      name: "Claims desk",
      code: "SB-CLAIMS",
      description: "Case intake, document checks, and adjuster workflow for Sable Health.",
      status: "planning",
      billingModel: "retainer",
      startDate: addDays(todayIso(), -7),
      endDate: addDays(todayIso(), 80),
      budgetAmount: 720000,
      currency: "INR",
      ownerId: "usr_ananya",
    },
  ];

  const members: DemoStore["members"] = [
    { projectId: "prj_portal", userId: "usr_vikram", memberRole: "PO/PM", billRate: 3500 },
    { projectId: "prj_portal", userId: "usr_ishaan", memberRole: "Developer", billRate: 2800 },
    { projectId: "prj_portal", userId: "usr_sara", memberRole: "Designer", billRate: 3000 },
    { projectId: "prj_inventory", userId: "usr_vikram", memberRole: "Owner", billRate: 3500 },
    { projectId: "prj_inventory", userId: "usr_ishaan", memberRole: "Developer", billRate: 2800 },
    { projectId: "prj_inventory", userId: "usr_neel", memberRole: "QA", billRate: 2200 },
    { projectId: "prj_claims", userId: "usr_ananya", memberRole: "Owner", billRate: 0 },
    { projectId: "prj_claims", userId: "usr_neel", memberRole: "QA", billRate: 2200 },
    { projectId: "prj_claims", userId: "usr_ishaan", memberRole: "Developer", billRate: 2800 },
  ];

  const milestones: DemoStore["milestones"] = [
    { id: "ms_auth", projectId: "prj_portal", name: "Sprint 1", description: "Planning.", dueDate: addDays(week, 4), status: "pending", amount: 0, plannedHours: 80 },
    { id: "ms_bill", projectId: "prj_portal", name: "Sprint 2", description: "Build.", dueDate: addDays(week, 18), status: "pending", amount: 0, plannedHours: 60 },
    { id: "ms_sync", projectId: "prj_inventory", name: "Store sync", description: "Nightly stock snapshot accepted by Helios.", dueDate: addDays(week, 11), status: "in_progress", amount: 500000, plannedHours: 48 },
    { id: "ms_intake", projectId: "prj_claims", name: "Intake prototype", description: "Adjuster walkthrough of the first five screens.", dueDate: addDays(week, 21), status: "pending", amount: 240000, plannedHours: 24 },
  ];

  const features: DemoStore["features"] = [
    { id: "ft_auth", projectId: "prj_portal", name: "Access & roles", description: "Sign-in, role matrix, and project membership.", billingType: "hourly", hourlyRate: 3200, fixedAmount: 0, budgetHours: 80, status: "active" },
    { id: "ft_time", projectId: "prj_portal", name: "Timesheet workspace", description: "Daily logs, billable flags, and approvals.", billingType: "hourly", hourlyRate: 3000, fixedAmount: 0, budgetHours: 60, status: "active" },
    { id: "ft_invoice", projectId: "prj_portal", name: "Billing cards", description: "Feature cards, GST invoice, and receipt matching.", billingType: "hourly", hourlyRate: 3400, fixedAmount: 0, budgetHours: 70, status: "planned" },
    { id: "ft_stock", projectId: "prj_inventory", name: "Stock service", description: "Fixed delivery for the inventory API.", billingType: "fixed", hourlyRate: 0, fixedAmount: 640000, budgetHours: 120, status: "active" },
    { id: "ft_qa", projectId: "prj_inventory", name: "Regression suite", description: "QA hours billed separately from the fixed build.", billingType: "hourly", hourlyRate: 2200, fixedAmount: 0, budgetHours: 40, status: "active" },
    { id: "ft_case", projectId: "prj_claims", name: "Case intake", description: "Retainer discovery for the claims desk.", billingType: "hourly", hourlyRate: 3000, fixedAmount: 0, budgetHours: 36, status: "planned" },
  ];

  const tasks: DemoStore["tasks"] = [
    { id: "tk_roles", projectId: "prj_portal", milestoneId: "ms_auth", featureId: "ft_auth", title: "Map director, owner, and member permissions", description: "Confirm which screens each role can open.", assigneeId: "usr_ishaan", status: "review", priority: "high", dueDate: addDays(week, 2), estimatedHours: 8 },
    { id: "tk_grid", projectId: "prj_portal", milestoneId: "ms_auth", featureId: "ft_time", title: "Weekly timesheet grid", description: "Let members log billable and non-billable hours.", assigneeId: "usr_ishaan", status: "in_progress", priority: "urgent", dueDate: addDays(week, 3), estimatedHours: 12 },
    { id: "tk_cards", projectId: "prj_portal", milestoneId: "ms_bill", featureId: "ft_invoice", title: "Feature billing cards", description: "Show budget, logged hours, and amount by feature.", assigneeId: "usr_sara", status: "in_progress", priority: "medium", dueDate: addDays(week, 6), estimatedHours: 10 },
    { id: "tk_empty", projectId: "prj_portal", milestoneId: "ms_bill", featureId: "ft_time", title: "Empty-state illustrations", description: "States for a week with no submitted time.", assigneeId: "usr_sara", status: "backlog", priority: "low", dueDate: addDays(week, 8), estimatedHours: 4 },
    { id: "tk_sync", projectId: "prj_inventory", milestoneId: "ms_sync", featureId: "ft_stock", title: "Nightly stock snapshot", description: "Write the store sync job and retry policy.", assigneeId: "usr_ishaan", status: "in_progress", priority: "high", dueDate: addDays(week, 5), estimatedHours: 16 },
    { id: "tk_cases", projectId: "prj_inventory", milestoneId: "ms_sync", featureId: "ft_qa", title: "Regression cases for stock adjustments", description: "Cover negative stock and partial receipts.", assigneeId: "usr_neel", status: "review", priority: "medium", dueDate: addDays(week, 4), estimatedHours: 8 },
    { id: "tk_intake", projectId: "prj_claims", milestoneId: "ms_intake", featureId: "ft_case", title: "Draft intake checklist", description: "List documents required before a claim is assigned.", assigneeId: "usr_neel", status: "backlog", priority: "medium", dueDate: addDays(week, 12), estimatedHours: 6 },
  ];

  const older = addDays(todayIso(), -24);
  const timesheets: DemoStore["timesheets"] = [
    { id: "ts_1", userId: "usr_ishaan", projectId: "prj_portal", taskId: "tk_roles", featureId: "ft_auth", workDate: older, hours: 6, billable: true, description: "Permission matrix and route notes.", status: "approved", approvedBy: "usr_vikram", approvedAt: stamp(), rejectionNote: "", invoiceId: "inv_nw" },
    { id: "ts_2", userId: "usr_ishaan", projectId: "prj_portal", taskId: "tk_grid", featureId: "ft_time", workDate: addDays(older, 1), hours: 7.5, billable: true, description: "Timesheet data model.", status: "approved", approvedBy: "usr_vikram", approvedAt: stamp(), rejectionNote: "", invoiceId: "inv_nw" },
    { id: "ts_3", userId: "usr_sara", projectId: "prj_portal", taskId: "tk_cards", featureId: "ft_invoice", workDate: addDays(older, 2), hours: 5, billable: true, description: "First pass of billing cards.", status: "approved", approvedBy: "usr_vikram", approvedAt: stamp(), rejectionNote: "", invoiceId: "inv_nw" },
    { id: "ts_4", userId: "usr_neel", projectId: "prj_inventory", taskId: "tk_cases", featureId: "ft_qa", workDate: addDays(older, 3), hours: 6, billable: true, description: "Stock adjustment cases.", status: "approved", approvedBy: "usr_vikram", approvedAt: stamp(), rejectionNote: "", invoiceId: "inv_hx" },
    { id: "ts_5", userId: "usr_ishaan", projectId: "prj_inventory", taskId: "tk_sync", featureId: "ft_stock", workDate: addDays(older, 4), hours: 8, billable: true, description: "Snapshot job skeleton.", status: "approved", approvedBy: "usr_vikram", approvedAt: stamp(), rejectionNote: "", invoiceId: "inv_hx" },
    { id: "ts_6", userId: "usr_ishaan", projectId: "prj_portal", taskId: "tk_grid", featureId: "ft_time", workDate: addDays(week, 0), hours: 6.5, billable: true, description: "Week grid and draft saving.", status: "approved", approvedBy: "usr_vikram", approvedAt: stamp(), rejectionNote: "", invoiceId: "" },
    { id: "ts_7", userId: "usr_ishaan", projectId: "prj_portal", taskId: "tk_grid", featureId: "ft_time", workDate: addDays(week, 1), hours: 4, billable: true, description: "Approval queue wiring.", status: "submitted", approvedBy: "", approvedAt: "", rejectionNote: "", invoiceId: "" },
    { id: "ts_8", userId: "usr_ishaan", projectId: "prj_inventory", taskId: "tk_sync", featureId: "ft_stock", workDate: addDays(week, 1), hours: 3, billable: false, description: "Internal design review.", status: "submitted", approvedBy: "", approvedAt: "", rejectionNote: "", invoiceId: "" },
    { id: "ts_9", userId: "usr_sara", projectId: "prj_portal", taskId: "tk_cards", featureId: "ft_invoice", workDate: addDays(week, 1), hours: 5.5, billable: true, description: "Card layout and budget bar.", status: "draft", approvedBy: "", approvedAt: "", rejectionNote: "", invoiceId: "" },
    { id: "ts_10", userId: "usr_sara", projectId: "prj_portal", taskId: "tk_cards", featureId: "ft_time", workDate: addDays(week, 2), hours: 2, billable: true, description: "Corrected hours after a missed standup.", status: "rejected", approvedBy: "usr_vikram", approvedAt: stamp(), rejectionNote: "Split the standup out as non-billable.", invoiceId: "" },
    { id: "ts_11", userId: "usr_neel", projectId: "prj_inventory", taskId: "tk_cases", featureId: "ft_qa", workDate: addDays(week, 2), hours: 4, billable: true, description: "Partial receipt cases.", status: "submitted", approvedBy: "", approvedAt: "", rejectionNote: "", invoiceId: "" },
    { id: "ts_12", userId: "usr_neel", projectId: "prj_claims", taskId: "tk_intake", featureId: "ft_case", workDate: addDays(week, 3), hours: 3, billable: true, description: "Checklist workshop notes.", status: "draft", approvedBy: "", approvedAt: "", rejectionNote: "", invoiceId: "" },
  ];

  const rates: DemoStore["rates"] = [
    { id: "rate_co", label: "Studio default", scope: "company", targetId: "", hourlyRate: 2500, currency: "INR", effectiveFrom: addDays(todayIso(), -90) },
    { id: "rate_owner", label: "Project owner", scope: "role", targetId: "role_owner", hourlyRate: 3500, currency: "INR", effectiveFrom: addDays(todayIso(), -90) },
    { id: "rate_member", label: "Team member", scope: "role", targetId: "role_member", hourlyRate: 2600, currency: "INR", effectiveFrom: addDays(todayIso(), -90) },
    { id: "rate_sara", label: "Sara D'Souza", scope: "user", targetId: "usr_sara", hourlyRate: 3000, currency: "INR", effectiveFrom: addDays(todayIso(), -40) },
  ];

  const invoices: DemoStore["invoices"] = [
    { id: "inv_nw", number: "INV-2026-018", clientId: "cli_northwind", projectId: "prj_portal", issueDate: addDays(todayIso(), -18), dueDate: addDays(todayIso(), -3), status: "paid", taxRate: 18, notes: "September portal sprint.", createdBy: "usr_ananya" },
    { id: "inv_hx", number: "INV-2026-021", clientId: "cli_helios", projectId: "prj_inventory", issueDate: addDays(todayIso(), -10), dueDate: addDays(todayIso(), 5), status: "partial", taxRate: 18, notes: "QA slice plus stock-service progress.", createdBy: "usr_ananya" },
  ];

  const lines: DemoStore["lines"] = [
    { id: "ln_1", invoiceId: "inv_nw", featureId: "ft_auth", description: "Access & roles", hours: 6, rate: 3200, amount: 19200 },
    { id: "ln_2", invoiceId: "inv_nw", featureId: "ft_time", description: "Timesheet workspace", hours: 7.5, rate: 3000, amount: 22500 },
    { id: "ln_3", invoiceId: "inv_nw", featureId: "ft_invoice", description: "Billing cards", hours: 5, rate: 3400, amount: 17000 },
    { id: "ln_4", invoiceId: "inv_hx", featureId: "ft_qa", description: "Regression suite", hours: 6, rate: 2200, amount: 13200 },
    { id: "ln_5", invoiceId: "inv_hx", featureId: "ft_stock", description: "Stock service — fixed progress", hours: 8, rate: 0, amount: 160000 },
  ];

  const payments: DemoStore["payments"] = [
    { id: "pay_nw", direction: "incoming", clientId: "cli_northwind", userId: "", invoiceId: "inv_nw", projectId: "prj_portal", amount: 69266, currency: "INR", method: "Bank transfer", status: "completed", reference: "NEFT-NW-018", notes: "Full receipt against INV-2026-018.", createdBy: "usr_ananya", createdAt: new Date(Date.now() - 86400000 * 2).toISOString(), paidAt: isoDate(new Date(Date.now() - 86400000 * 2)) },
    { id: "pay_hx", direction: "incoming", clientId: "cli_helios", userId: "", invoiceId: "inv_hx", projectId: "prj_inventory", amount: 80000, currency: "INR", method: "UPI", status: "completed", reference: "UPI-HX-221", notes: "Part payment.", createdBy: "usr_ananya", createdAt: new Date(Date.now() - 86400000).toISOString(), paidAt: isoDate(new Date(Date.now() - 86400000)) },
    { id: "pay_ishaan", direction: "outgoing", clientId: "", userId: "usr_ishaan", invoiceId: "", projectId: "prj_portal", amount: 20000, currency: "INR", method: "Bank transfer", status: "completed", reference: "PAY-ISH-09", notes: "September developer payout.", createdBy: "usr_ananya", createdAt: new Date(Date.now() - 86400000 * 6).toISOString(), paidAt: addDays(todayIso(), -6) },
    { id: "pay_sara", direction: "outgoing", clientId: "", userId: "usr_sara", invoiceId: "", projectId: "prj_portal", amount: 15000, currency: "INR", method: "Bank transfer", status: "initiated", reference: "PAY-SAR-10", notes: "Awaiting bank confirmation.", createdBy: "usr_ananya", createdAt: new Date().toISOString(), paidAt: "" },
  ];

  const notifications: DemoStore["notifications"] = [
    { id: "nt_1", userId: "usr_vikram", title: "Timesheets waiting", body: "Bhuvin Singla and Neel submitted hours for this week.", href: "/timesheets", read: false, createdAt: new Date().toISOString() },
    { id: "nt_2", userId: "usr_sara", title: "Timesheet returned", body: "GSVK SAI asked you to split the standup out as non-billable.", href: "/timesheets", read: false, createdAt: new Date().toISOString() },
    { id: "nt_3", userId: "usr_ananya", title: "Helios still owes a balance", body: "INV-2026-021 has a part payment and an open balance.", href: "/payments", read: false, createdAt: new Date().toISOString() },
    { id: "nt_4", userId: "usr_ishaan", title: "Monday hours approved", body: "Your Noble log was approved.", href: "/timesheets", read: true, createdAt: new Date(Date.now() - 3600000).toISOString() },
  ];

  const audit: DemoStore["audit"] = [
    { id: "au_1", actorId: "usr_ananya", action: "invoice.paid", entity: "invoice", entityId: "inv_nw", summary: "Recorded the Noble receipt for INV-2026-018.", createdAt: new Date(Date.now() - 86400000 * 2).toISOString() },
    { id: "au_2", actorId: "usr_vikram", action: "timesheet.rejected", entity: "timesheet", entityId: "ts_10", summary: "Returned Sara D'Souza's standup entry.", createdAt: new Date(Date.now() - 7200000).toISOString() },
    { id: "au_3", actorId: "usr_ishaan", action: "timesheet.submitted", entity: "timesheet", entityId: "ts_7", summary: "Submitted Tuesday hours on Noble.", createdAt: new Date(Date.now() - 3600000).toISOString() },
  ];

  return {
    users,
    roles,
    grants,
    clients,
    projects,
    members,
    milestones,
    features,
    tasks,
    timesheets,
    rates,
    invoices,
    lines,
    payments,
    notifications,
    audit,
  };
}
