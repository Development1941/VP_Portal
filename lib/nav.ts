import { canAny } from "@/lib/access";
import { showCommercials } from "@/lib/commercial";
import type { PermissionKey } from "@/lib/permissions";
import { canEditTab, canSeeLeadershipSections, LEADERSHIP_SECTIONS, type TabKey } from "@/lib/tab-access";
import type { SessionUser } from "@/lib/types";

export type NavItem = {
  href: string;
  label: string;
  icon: string;
  section: string;
  allow: (user: SessionUser) => boolean;
  tab?: TabKey;
};

export const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard", section: "Workspace", allow: (user) => canAny(user, ["dashboard.view"]) },
  { href: "/work", label: "My work", icon: "work", section: "Workspace", allow: () => true, tab: "myWork" },
  { href: "/timesheets", label: "DSR", icon: "time", section: "Workspace", allow: () => true, tab: "dsrIntake" },
  { href: "/project-status", label: "Project management", icon: "intake", section: "Operations", allow: () => true, tab: "projectIntake" },
  { href: "/sow", label: "SOW management", icon: "sow", section: "Operations", allow: () => true, tab: "sowManagement" },
  { href: "/delivery", label: "Task management", icon: "tasks", section: "Operations", allow: () => true, tab: "dsrHourlyTracker" },
  { href: "/utilization", label: "Resource management", icon: "resources", section: "Operations", allow: () => true, tab: "utilization" },
  { href: "/escalations", label: "Escalation management", icon: "alert", section: "Operations", allow: () => true, tab: "escalations" },
  { href: "/checklist", label: "Delivery checklist", icon: "checklist", section: "Operations", allow: () => true, tab: "deliveryChecklist" },
  { href: "/billing", label: "Billing", icon: "billing", section: "Commercial", allow: (user) => canAny(user, ["billing.features", "billing.rates"]) },
  { href: "/invoices", label: "Invoices", icon: "invoices", section: "Commercial", allow: (user) => canAny(user, ["invoices.view"]) },
  { href: "/payments", label: "Payments", icon: "payments", section: "Commercial", allow: (user) => canAny(user, ["payments.view"]) },
  { href: "/reports", label: "Reports", icon: "reports", section: "Commercial", allow: (user) => canAny(user, ["reports.project", "reports.financial"]) },
  { href: "/team", label: "Team", icon: "team", section: "Administration", allow: (user) => canAny(user, ["team.view", "team.manage"]) },
  { href: "/audit", label: "Audit log", icon: "audit", section: "Administration", allow: (user) => canAny(user, ["audit.view"]) },
  { href: "/settings", label: "Settings", icon: "settings", section: "Administration", allow: (user) => canAny(user, ["settings.manage"]) },
];

export function navigation(user: SessionUser) {
  const leadership = canSeeLeadershipSections(user);
  return NAV.filter(
    (item) =>
      item.allow(user) &&
      (showCommercials || item.section !== "Commercial") &&
      (!item.tab || canEditTab(user, item.tab)) &&
      (leadership || !LEADERSHIP_SECTIONS.includes(item.section)),
  ).map(({ href, label, icon, section }) => ({
    href,
    label,
    icon,
    section,
  }));
}

export type NavLink = ReturnType<typeof navigation>[number];

export function guard(user: SessionUser, permissions: PermissionKey[]) {
  return canAny(user, permissions);
}
