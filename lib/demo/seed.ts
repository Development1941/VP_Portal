import { defaultWorkstreams } from "@/lib/delivery";
import { ROLE_PRESETS } from "@/lib/permissions";
import type { Role, Workspace } from "@/lib/types";

export type DemoUser = Workspace["users"][number] & { password: string; avatarUrl?: string; about?: string; companyScope?: string; sheetEditor?: boolean };

export type DemoStore = Omit<Workspace, "users"> & {
  users: DemoUser[];
  organizations: { id: string; name: string; status: "active" | "inactive" }[];
  rosterApplied?: boolean;
  costsCleared?: boolean;
  statusSheetReady?: boolean;
  sowSheetReady?: boolean;
};

export function buildSeed(): DemoStore {
  const roles: Role[] = [
    {
      id: "role_director",
      name: "Director / Super admin",
      slug: "director",
      description: "Super admin with every client, project, rate, invoice, payout, and setting.",
      isSystem: true,
      locked: true,
    },
    {
      id: "role_admin",
      name: "Admin",
      slug: "admin",
      description: "Administers the studio. The director stays the locked super admin.",
      isSystem: true,
      locked: false,
    },
    {
      id: "role_owner",
      name: "Project Manager / PO",
      slug: "project_owner",
      description: "Runs projects, intake, tasks, milestones, and approvals.",
      isSystem: true,
      locked: false,
    },
    {
      id: "role_member",
      name: "Developer",
      slug: "developer",
      description: "Logs tasks and timesheets on assigned projects.",
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
    {
      id: "role_pm",
      name: "Project Manager",
      slug: "project_manager",
      description: "Files a new project request and hands it to the SOW team.",
      isSystem: true,
      locked: false,
    },
    {
      id: "role_client",
      name: "Client",
      slug: "client",
      description: "Submits a project request with the requirement documents.",
      isSystem: true,
      locked: false,
    },
  ];

  const grants = (["admin", "project_owner", "developer", "finance", "scrum_master", "project_manager", "client"] as const).flatMap((slug) => {
    const role = roles.find((item) => item.slug === slug)!;
    return ROLE_PRESETS[slug].map((permission) => ({ roleId: role.id, permission }));
  });

  const users: DemoUser[] = [
    {
      id: "usr_ananya",
      fullName: "Harshit Bansal",
      email: "director@embee.local",
      password: "demo123",
      title: "Super admin",
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
      title: "Admin",
      phone: "+91 98450 11014",
      roleId: "role_admin",
      roleName: "Admin",
      roleSlug: "admin",
      status: "active",
      hourlyCost: 0,
      sheetEditor: true,
    },
    {
      id: "usr_ishaan",
      fullName: "Bhuvin Singla",
      email: "ishaan@embee.local",
      password: "demo123",
      title: "Developer",
      phone: "+91 98450 11022",
      roleId: "role_member",
      roleName: "Developer",
      roleSlug: "developer",
      status: "active",
      hourlyCost: 0,
    },
    {
      id: "usr_manav",
      fullName: "Manav Singal",
      email: "manav@embee.local",
      password: "demo123",
      title: "Project Manager / PO",
      phone: "",
      roleId: "role_owner",
      roleName: "Project Manager / PO",
      roleSlug: "project_owner",
      status: "active",
      hourlyCost: 0,
    },
    {
      id: "usr_kaushik",
      fullName: "Kaushik",
      email: "sm@embee.local",
      password: "demo123",
      title: "Scrum Master",
      phone: "",
      roleId: "role_sm",
      roleName: "Scrum Master",
      roleSlug: "scrum_master",
      status: "active",
      hourlyCost: 0,
    },
    {
      id: "usr_rakhee",
      fullName: "Rakhee",
      email: "rakhee@embee.local",
      password: "demo123",
      title: "Client",
      phone: "",
      roleId: "role_client",
      roleName: "Client",
      roleSlug: "client",
      status: "active",
      hourlyCost: 0,
      companyScope: "assure",
    },
    {
      id: "usr_brian",
      fullName: "Brian",
      email: "brian@embee.local",
      password: "demo123",
      title: "Client",
      phone: "",
      roleId: "role_client",
      roleName: "Client",
      roleSlug: "client",
      status: "active",
      hourlyCost: 0,
      companyScope: "assure",
    },
  ];

  return {
    users,
    roles,
    grants,
    clients: [],
    projects: [],
    members: [],
    milestones: [],
    features: [],
    tasks: [],
    timesheets: [],
    rates: [],
    invoices: [],
    lines: [],
    payments: [],
    notifications: [],
    audit: [],
    escalations: [],
    rosterApplied: true,
    files: [],
    workstreams: defaultWorkstreams(),
    organizations: [
      { id: "org_embee", name: "EMBEE", status: "active" },
      { id: "org_hanu", name: "Hanu.AI", status: "active" },
    ],
    fxRates: [],
    statusUpdates: [],
    sowRecords: [],
    hourlyEntries: [],
    currency: "INR",
  };
}
