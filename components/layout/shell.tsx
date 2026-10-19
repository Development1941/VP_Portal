import { Logo } from "@/components/brand/logo";
import { AccountMenu } from "@/components/layout/account-menu";
import { CurrencySwitch } from "@/components/layout/currency-switch";
import { SideNav } from "@/components/layout/nav";
import { Menu } from "@/components/layout/menu";
import { NoticeMenu } from "@/components/layout/notice-menu";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { can } from "@/lib/access";
import { currencyCode } from "@/lib/currency";
import type { NavLink } from "@/lib/nav";
import type { Notification, SessionUser } from "@/lib/types";

export function Shell({
  user,
  links,
  notes,
  currency,
  children,
}: {
  user: SessionUser;
  links: NavLink[];
  notes: Notification[];
  currency: string;
  children: React.ReactNode;
}) {
  const firstName = user.fullName.trim().split(/\s+/)[0];
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <Logo />
          <span>VP Portal</span>
        </div>
        <SideNav links={links} className="nav" />
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="topbar-start">
            <Menu className="nav-toggle">
              <summary className="btn ghost menu-btn">Menu</summary>
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
            <CurrencySwitch currency={currencyCode(currency)} editable={can(user, "settings.manage")} />
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
