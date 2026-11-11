import { redirect } from "next/navigation";
import { canAny } from "@/lib/access";
import { loadWorkspace } from "@/lib/data";
import type { PermissionKey } from "@/lib/permissions";
import { getSession } from "@/lib/session";
import { canEditTab, type TabKey } from "@/lib/tab-access";
import type { Workspace } from "@/lib/types";

export async function requirePage(permissions: PermissionKey[]) {
  const user = await getSession();
  if (!user) redirect("/login");
  const data = await loadWorkspace(user.id);
  return { user, data, allowed: canAny(user, permissions) };
}

export async function requireTab(tab: TabKey) {
  const user = await getSession();
  if (!user) redirect("/login");
  const data = await loadWorkspace(user.id);
  return { user, data, allowed: canEditTab(user, tab) };
}

export function nameOf(data: Workspace, id: string) {
  return data.users.find((person) => person.id === id)?.fullName || "Unassigned";
}

export function clientOf(data: Workspace, id: string) {
  return data.clients.find((client) => client.id === id);
}

export function projectOf(data: Workspace, id: string) {
  return data.projects.find((project) => project.id === id);
}
