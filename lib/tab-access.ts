import { PortalError } from "./form.ts";

export type ProfileKey = "PMD_ADMIN" | "HARSHIT" | "MANAV" | "KAUSHIK" | "YUVRAJ" | "RAKHEE" | "DEVELOPER";

export type TabKey = "dashboard" | "myWork" | "dsrIntake" | "projectIntake" | "sowManagement" | "utilization" | "dsrHourlyTracker" | "escalations" | "deliveryChecklist";

export type ExportKey = "utilization" | "dsrHourlyTracker" | "deliveryChecklist";

export const TAB_KEYS: TabKey[] = ["dashboard", "myWork", "dsrIntake", "projectIntake", "sowManagement", "utilization", "dsrHourlyTracker", "escalations", "deliveryChecklist"];

export const TAB_LABELS: Record<TabKey, string> = {
  dashboard: "Dashboard",
  myWork: "My work",
  dsrIntake: "DSR",
  projectIntake: "Project management",
  sowManagement: "SOW management",
  utilization: "Resource management",
  dsrHourlyTracker: "Task management",
  escalations: "Escalations",
  deliveryChecklist: "Project delivery checklist",
};

export const TAB_PERMISSIONS: Record<TabKey, ProfileKey[]> = {
  dashboard: [],
  myWork: ["DEVELOPER", "KAUSHIK", "YUVRAJ"],
  dsrIntake: ["DEVELOPER", "KAUSHIK", "YUVRAJ"],
  projectIntake: ["PMD_ADMIN"],
  sowManagement: ["PMD_ADMIN", "RAKHEE"],
  utilization: ["PMD_ADMIN", "HARSHIT", "MANAV"],
  dsrHourlyTracker: ["PMD_ADMIN", "HARSHIT", "MANAV"],
  escalations: ["PMD_ADMIN", "MANAV", "KAUSHIK", "YUVRAJ", "HARSHIT", "RAKHEE", "DEVELOPER"],
  deliveryChecklist: ["PMD_ADMIN", "RAKHEE"],
};

export const EXPORT_CSV_PERMISSIONS: Record<ExportKey, ProfileKey[]> = {
  utilization: ["PMD_ADMIN", "HARSHIT"],
  dsrHourlyTracker: ["PMD_ADMIN"],
  deliveryChecklist: ["PMD_ADMIN", "RAKHEE"],
};

export type TabUser = { email: string; fullName: string; roleSlug: string; sheetEditor?: boolean };

export function profileKeys(user: TabUser): ProfileKey[] {
  const email = user.email.toLowerCase().trim();
  const name = user.fullName.toLowerCase().trim();
  const keys: ProfileKey[] = [];
  if (user.roleSlug === "admin" || user.sheetEditor || email === "owner@embee.local" || name.includes("gsvk")) keys.push("PMD_ADMIN");
  if (email === "director@embee.local" || name.includes("harshit")) keys.push("HARSHIT");
  if (email === "manav@embee.local" || name.includes("manav") || name.includes("maanav")) keys.push("MANAV");
  if (email === "sm@embee.local" || name.includes("kaushik")) keys.push("KAUSHIK");
  if (email === "yuvraj@embee.local" || name.includes("yuvraj")) keys.push("YUVRAJ");
  if (email === "rakhee@embee.local" || name === "rakhee" || name.startsWith("rakhee ")) keys.push("RAKHEE");
  if (user.roleSlug === "developer" || email === "ishaan@embee.local" || name.includes("bhuvin")) keys.push("DEVELOPER");
  return keys;
}

export function canEditTab(user: TabUser, tab: TabKey) {
  const allowed = TAB_PERMISSIONS[tab];
  return profileKeys(user).some((key) => allowed.includes(key));
}

export function canExportCsv(user: TabUser, kind: ExportKey) {
  const allowed = EXPORT_CSV_PERMISSIONS[kind];
  return profileKeys(user).some((key) => allowed.includes(key));
}

export function canWriteHourlyRow(user: TabUser & { id: string }, row: { plan: boolean; ownerId?: string }) {
  if (row.plan) return canEditTab(user, "utilization");
  if (canEditTab(user, "dsrHourlyTracker")) return true;
  return canEditTab(user, "dsrIntake") && (!row.ownerId || row.ownerId === user.id);
}

export function assertHourlyWrite(user: TabUser & { id: string }, row: { plan: boolean; ownerId?: string }) {
  if (!canWriteHourlyRow(user, row)) throw new PortalError("You do not have access to this entry.");
}

export function assertCanEdit(user: TabUser, tab: TabKey) {
  if (!canEditTab(user, tab)) throw new PortalError("You do not have access to this tab.");
}

export function assertCanExport(user: TabUser, kind: ExportKey) {
  if (!canExportCsv(user, kind)) throw new PortalError("You cannot export this sheet.");
}
