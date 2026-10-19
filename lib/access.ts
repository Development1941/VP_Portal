import type { PermissionKey } from "@/lib/permissions";
import type { Project, ProjectMember, SessionUser, Task } from "@/lib/types";

export function can(user: SessionUser, permission: PermissionKey) {
  return user.permissions.includes(permission);
}

export function canAny(user: SessionUser, permissions: PermissionKey[]) {
  return permissions.some((permission) => can(user, permission));
}

export function projectVisible(user: SessionUser, project: Project, members: ProjectMember[]) {
  if (can(user, "projects.view_all")) return true;
  if (project.ownerId === user.id) return true;
  return members.some((member) => member.projectId === project.id && member.userId === user.id);
}

export function canManageProject(user: SessionUser, project: Project) {
  if (!can(user, "projects.manage") && !can(user, "tasks.manage")) return false;
  if (can(user, "projects.view_all")) return can(user, "projects.manage") || can(user, "tasks.manage");
  return project.ownerId === user.id;
}

export function canEditTask(user: SessionUser, task: Task, project: Project) {
  if (can(user, "tasks.manage") && canManageProject(user, project)) return true;
  return Boolean(task.assigneeId) && task.assigneeId === user.id && can(user, "tasks.view");
}

export function isProjectLead(role: string) {
  return /(\bowner\b|\bpm\b|project manager|\bmanager\b)/i.test(role);
}

export function canSeeMilestones(user: SessionUser, project: Project, members: ProjectMember[]) {
  if (can(user, "projects.view_all")) return true;
  if (can(user, "milestones.manage") && projectVisible(user, project, members)) return true;
  return leadsProject(user, project, members);
}

export function canUploadMilestones(user: SessionUser, project: Project, members: ProjectMember[]) {
  if (can(user, "tasks.manage") && canManageProject(user, project)) return true;
  if (!can(user, "milestones.manage")) return false;
  return projectVisible(user, project, members);
}

export function leadsProject(user: SessionUser, project: Project, members: ProjectMember[]) {
  if (project.ownerId === user.id) return true;
  return members.some((member) => member.projectId === project.id && member.userId === user.id && isProjectLead(member.memberRole));
}

export function projectLeads(project: Project, members: ProjectMember[]) {
  const ids = new Set<string>();
  if (project.ownerId) ids.add(project.ownerId);
  for (const member of members) {
    if (member.projectId === project.id && isProjectLead(member.memberRole)) ids.add(member.userId);
  }
  return [...ids];
}

export function taskOnBoard(user: SessionUser, task: Task, project: Project | undefined, members: ProjectMember[]) {
  if (task.assigneeId === user.id) return true;
  if (!project) return false;
  return leadsProject(user, project, members);
}

export function canApproveProject(user: SessionUser, project: Project) {
  if (!can(user, "timesheets.approve")) return false;
  if (can(user, "projects.view_all")) return true;
  return project.ownerId === user.id;
}

export function canSeeTeamDsr(user: SessionUser, project: Project) {
  if (project.ownerId === user.id) return true;
  return can(user, "projects.view_all");
}
