"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bell,
  Building2,
  Clock3,
  CreditCard,
  FileText,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  PieChart,
  ScrollText,
  Settings,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { NavLink } from "@/lib/nav";

const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  tasks: ListChecks,
  time: Clock3,
  projects: FolderKanban,
  health: Activity,
  clients: Building2,
  billing: CreditCard,
  invoices: FileText,
  payments: Wallet,
  reports: PieChart,
  team: Users,
  bell: Bell,
  audit: ScrollText,
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
                  <Icon />
                  <span>{link.label}</span>
                </Link>
              );
            })}
        </div>
      ))}
    </nav>
  );
}
