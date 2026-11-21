import { canCreateCase, canUseIpoModel, canViewEmployeeDatabase, isFinanceClient, isFinanceTeam } from "@/lib/finance/access";
import type { FinanceNavItem } from "@/components/finance/side-nav";
import type { FinanceSessionUser } from "@/lib/finance/types";

export function financeNavigation(user: FinanceSessionUser): FinanceNavItem[] {
  if (isFinanceClient(user)) {
    return [{ href: "/finance/my-case", label: "My case", icon: "myCase" }];
  }
  if (!isFinanceTeam(user)) return [];
  const links: FinanceNavItem[] = [
    { href: "/finance/dashboard", label: "Dashboard", icon: "dashboard" },
    { href: "/finance/cases", label: "Cases", icon: "cases" },
  ];
  if (canCreateCase(user)) links.push({ href: "/finance/intake", label: "New case", icon: "intake" });
  if (canUseIpoModel(user)) links.push({ href: "/finance/ipo", label: "IPO model", icon: "ipo" });
  if (canViewEmployeeDatabase(user)) links.push({ href: "/finance/employees", label: "Employees", icon: "employees" });
  return links;
}
