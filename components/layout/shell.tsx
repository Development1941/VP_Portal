import { Menu as MenuIcon } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { AccountMenu } from "@/components/layout/account-menu";
import { CurrencySwitch } from "@/components/layout/currency-switch";
import { SideNav } from "@/components/layout/nav";
import { Sidebar } from "@/components/layout/sidebar";
import { Menu } from "@/components/layout/menu";
import { NoticeMenu } from "@/components/layout/notice-menu";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { NoticeToasts } from "@/components/toast";
import { can } from "@/lib/access";
import { showCommercials } from "@/lib/commercial";
import { currencyCode } from "@/lib/currency";
import type { NavLink } from "@/lib/nav";
import type { FxRate, Notification, SessionUser } from "@/lib/types";

export function Shell({
  user,
  links,
  notes,
  currency,
  fx,
  children,
}: {
  user: SessionUser;
  links: NavLink[];
  notes: Notification[];
  currency: string;
  fx?: FxRate;
  children: React.ReactNode;
}) {
  const firstName = user.fullName.trim().split(/\s+/)[0];
  return (
    <div className="app">
      <NoticeToasts notes={notes} />
      <Sidebar>
        <div className="brand">
          <Logo />
          <span>VP Portal</span>
        </div>
        <SideNav links={links} className="nav" />
      </Sidebar>
      <div className="workspace">
        <header className="topbar">
          <div className="topbar-start">
            <Menu className="nav-toggle">
              <summary className="btn ghost menu-btn">
                <MenuIcon strokeWidth={1.75} aria-hidden />
                Menu
              </summary>
              <div className="drawer">
                <SideNav links={links} className="mobile-nav" />
              </div>
            </Menu>
            <div className="topbar-brand">
              <Logo className="logo logo-sm" />
            </div>
            {firstName ? <p className="topbar-hello">Hi {firstName}</p> : null}
          </div>
          <div className="topbar-end">
            {showCommercials ? <CurrencySwitch currency={currencyCode(currency)} editable={can(user, "settings.manage")} fx={fx} /> : null}
            <ThemeToggle />
            {can(user, "notifications.view") ? <NoticeMenu notes={notes} /> : null}
            <AccountMenu user={user} settings={can(user, "settings.manage")} />
          </div>
        </header>
        <main className="main">{children}</main>
      </div>
    </div>
  );
}
