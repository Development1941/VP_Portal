"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  CalendarClock,
  FileText,
  FolderKanban,
  Gauge,
  HeartPulse,
  History,
  Inbox,
  LayoutDashboard,
  ListTodo,
  PieChart,
  Receipt,
  ScrollText,
  Settings,
  SquareKanban,
  TriangleAlert,
  Users,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { NavLink } from "@/lib/nav";

const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  work: SquareKanban,
  intake: Inbox,
  sow: ScrollText,
  resources: UsersRound,
  alert: TriangleAlert,
  tasks: ListTodo,
  time: CalendarClock,
  utilization: Gauge,
  projects: FolderKanban,
  health: HeartPulse,
  clients: Building2,
  billing: Receipt,
  invoices: FileText,
  payments: Wallet,
  reports: PieChart,
  team: Users,
  audit: History,
  settings: Settings,
};

export function SideNav({ links, className }: { links: NavLink[]; className: string }) {
  const pathname = usePathname();
  const sections = [...new Set(links.map((link) => link.section))];
  return (
    <nav className={className}>
      {sections.map((section) => (
        <div key={section}>
          <p className="nav-label">{section}</p>
          {links
            .filter((link) => link.section === section)
            .map((link) => {
              const Icon = ICONS[link.icon] ?? LayoutDashboard;
              const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  onClick={(event) => event.currentTarget.closest("details")?.removeAttribute("open")}
                >
                  <span className="nav-ico">
                    <Icon strokeWidth={1.75} aria-hidden />
                  </span>
                  <span>{link.label}</span>
                </Link>
              );
            })}
        </div>
      ))}
    </nav>
  );
}
