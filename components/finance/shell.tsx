import { LogOut } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { FinanceSideNav } from "@/components/finance/side-nav";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { financeSignOutAction } from "@/app/finance/actions";
import { financeNavigation } from "@/lib/finance/nav";
import type { FinanceSessionUser } from "@/lib/finance/types";

export function FinanceShell({ user, children }: { user: FinanceSessionUser; children: React.ReactNode }) {
  const firstName = user.fullName.trim().split(/\s+/)[0];
  const links = financeNavigation(user);
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <Logo />
          <span>Embee Finance</span>
        </div>
        <FinanceSideNav links={links} />
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="topbar-start">
            <div className="topbar-brand">
              <Logo className="logo logo-sm" />
            </div>
            {firstName ? <p className="topbar-hello">Hi {firstName}</p> : null}
            <span className="muted">{user.roleName}</span>
          </div>
          <div className="topbar-end">
            <ThemeToggle />
            <form action={financeSignOutAction}>
              <button type="submit" className="btn ghost">
                <LogOut strokeWidth={1.75} aria-hidden />
                Sign out
              </button>
            </form>
          </div>
        </header>
        <main className="main">{children}</main>
      </div>
    </div>
  );
}
