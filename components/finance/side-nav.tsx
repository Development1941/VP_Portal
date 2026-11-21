"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, FolderKanban, Inbox, LayoutDashboard, LineChart, UsersRound, type LucideIcon } from "lucide-react";

export type FinanceNavItem = {
  href: string;
  label: string;
  icon: "dashboard" | "cases" | "intake" | "myCase" | "employees" | "ipo";
};

const ICONS: Record<FinanceNavItem["icon"], LucideIcon> = {
  dashboard: LayoutDashboard,
  cases: FolderKanban,
  intake: Inbox,
  myCase: ClipboardList,
  employees: UsersRound,
  ipo: LineChart,
};

export function FinanceSideNav({ links }: { links: FinanceNavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="nav">
      <div>
        <p className="nav-label">Workspace</p>
        {links.map((link) => {
          const Icon = ICONS[link.icon];
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined} title={link.label}>
              <span className="nav-ico">
                <Icon strokeWidth={1.75} aria-hidden />
              </span>
              <span>{link.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
