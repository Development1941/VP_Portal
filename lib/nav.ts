import { canAny, canSeeIntake } from "@/lib/access";
import { showCommercials } from "@/lib/commercial";
import type { PermissionKey } from "@/lib/permissions";
import type { SessionUser } from "@/lib/types";

export type NavItem = {
  href: string;
  label: string;
  icon: string;
  section: string;
  allow: (user: SessionUser) => boolean;
};

export const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard", section: "Workspace", allow: (user) => canAny(user, ["dashboard.view"]) },
  { href: "/work", label: "My work", icon: "work", section: "Workspace", allow: (user) => canAny(user, ["tasks.view"]) },
  { href: "/timesheets", label: "DSR", icon: "time", section: "Workspace", allow: (user) => canAny(user, ["timesheets.submit", "timesheets.approve", "timesheets.view_all"]) },
  { href: "/intake", label: "Project intake", icon: "intake", section: "Operations", allow: (user) => canSeeIntake(user) },
  { href: "/sow", label: "SOW", icon: "sow", section: "Operations", allow: (user) => canSeeIntake(user) },
  { href: "/resources", label: "Resources", icon: "resources", section: "Operations", allow: (user) => canAny(user, ["projects.view", "projects.view_all", "tasks.view", "tasks.manage"]) },
  { href: "/delivery", label: "Tasks", icon: "tasks", section: "Operations", allow: (user) => canAny(user, ["tasks.view", "tasks.manage"]) },
  { href: "/utilization", label: "Utilization", icon: "utilization", section: "Operations", allow: (user) => canAny(user, ["timesheets.view_all", "billing.features", "reports.project", "reports.financial"]) },
  { href: "/escalations", label: "Escalations", icon: "alert", section: "Operations", allow: (user) => canAny(user, ["projects.view", "projects.view_all", "tasks.view"]) },
  { href: "/projects", label: "Projects", icon: "projects", section: "Delivery", allow: (user) => canAny(user, ["projects.view", "projects.view_all"]) },
  { href: "/health", label: "Project health", icon: "health", section: "Delivery", allow: (user) => user.roleSlug === "director" },
  { href: "/clients", label: "Clients", icon: "clients", section: "Delivery", allow: (user) => canAny(user, ["clients.view"]) },
  { href: "/billing", label: "Billing", icon: "billing", section: "Commercial", allow: (user) => canAny(user, ["billing.features", "billing.rates"]) },
  { href: "/invoices", label: "Invoices", icon: "invoices", section: "Commercial", allow: (user) => canAny(user, ["invoices.view"]) },
  { href: "/payments", label: "Payments", icon: "payments", section: "Commercial", allow: (user) => canAny(user, ["payments.view"]) },
  { href: "/reports", label: "Reports", icon: "reports", section: "Commercial", allow: (user) => canAny(user, ["reports.project", "reports.financial"]) },
  { href: "/team", label: "Team", icon: "team", section: "Administration", allow: (user) => canAny(user, ["team.view", "team.manage"]) },
  { href: "/audit", label: "Audit log", icon: "audit", section: "Administration", allow: (user) => canAny(user, ["audit.view"]) },
  { href: "/settings", label: "Settings", icon: "settings", section: "Administration", allow: (user) => canAny(user, ["settings.manage"]) },
];

export function navigation(user: SessionUser) {
  return NAV.filter((item) => item.allow(user) && (showCommercials || item.section !== "Commercial")).map(({ href, label, icon, section }) => ({ href, label, icon, section }));
}

export type NavLink = ReturnType<typeof navigation>[number];

export function guard(user: SessionUser, permissions: PermissionKey[]) {
  return canAny(user, permissions);
}
