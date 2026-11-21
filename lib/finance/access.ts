import type { FinanceCase, FinanceSessionUser } from "@/lib/finance/types";

/** Access matrix: Admin = Director + Admin profiles. */
export function isFinanceAdmin(user: FinanceSessionUser) {
  return user.roleSlug === "director" || user.roleSlug === "admin";
}

/** Access matrix: Employee = Finance / Legal staff. */
export function isFinanceEmployee(user: FinanceSessionUser) {
  return user.roleSlug === "employee";
}

export function isFinanceClient(user: FinanceSessionUser) {
  return user.roleSlug === "client";
}

export function isFinanceTeam(user: FinanceSessionUser) {
  return isFinanceAdmin(user) || isFinanceEmployee(user);
}

export function isLegalEmployee(user: FinanceSessionUser) {
  return isFinanceEmployee(user) && user.team === "Legal";
}

export function isFinanceSideEmployee(user: FinanceSessionUser) {
  return isFinanceEmployee(user) && user.team === "Finance";
}

export function canAddClients(user: FinanceSessionUser) {
  return isFinanceAdmin(user);
}

export function canCreateCase(user: FinanceSessionUser) {
  return isFinanceAdmin(user);
}

export function canAllotCases(user: FinanceSessionUser) {
  return isFinanceAdmin(user);
}

export function canViewEmployeeDatabase(user: FinanceSessionUser) {
  return isFinanceAdmin(user);
}

export function canManageFunderDatabase(user: FinanceSessionUser) {
  return isFinanceAdmin(user) || Boolean(user.funderDbAccess);
}

export function canUploadFinanceSheet(user: FinanceSessionUser) {
  return isFinanceAdmin(user) || isFinanceSideEmployee(user);
}

export function canUseIpoModel(user: FinanceSessionUser) {
  return isFinanceAdmin(user) || isFinanceSideEmployee(user);
}

export function canViewCaseList(user: FinanceSessionUser) {
  return isFinanceTeam(user);
}

export function caseIsAllottedTo(user: FinanceSessionUser, financeCase: FinanceCase) {
  return financeCase.allottedEmployeeIds.includes(user.id) || financeCase.legalAssigneeId === user.id || financeCase.assignedAdminId === user.id;
}

export function canViewCase(user: FinanceSessionUser, financeCase: FinanceCase) {
  if (isFinanceAdmin(user)) return true;
  if (isFinanceClient(user)) return financeCase.clientUserId === user.id;
  if (isFinanceEmployee(user)) return caseIsAllottedTo(user, financeCase);
  return false;
}

export function canEditCaseData(user: FinanceSessionUser, financeCase: FinanceCase) {
  if (isFinanceAdmin(user)) return true;
  if (isFinanceClient(user)) return financeCase.clientUserId === user.id;
  if (isFinanceEmployee(user)) return caseIsAllottedTo(user, financeCase);
  return false;
}

/** Legacy helper used by older call sites — team-wide edit means admin or allotted employee. */
export function canEditAnyCase(user: FinanceSessionUser) {
  return isFinanceAdmin(user) || isFinanceEmployee(user);
}

export function canEditMandate(user: FinanceSessionUser, financeCase?: FinanceCase) {
  if (isFinanceAdmin(user)) return true;
  if (!financeCase) return false;
  return isLegalEmployee(user) && financeCase.legalAssigneeId === user.id;
}

export function canAddClientQuestions(user: FinanceSessionUser) {
  return isFinanceClient(user);
}

export function canApproveTwoPager(user: FinanceSessionUser, financeCase: FinanceCase) {
  if (isFinanceAdmin(user)) return true;
  if (isFinanceEmployee(user)) return caseIsAllottedTo(user, financeCase);
  return false;
}

export function canSeeFunderDetails(user: FinanceSessionUser, financeCase: FinanceCase) {
  return canApproveTwoPager(user, financeCase);
}

export function homePathFor(user: FinanceSessionUser) {
  if (isFinanceClient(user)) return "/finance/my-case";
  if (isFinanceEmployee(user) && !isFinanceAdmin(user)) return "/finance/cases";
  return "/finance/dashboard";
}
