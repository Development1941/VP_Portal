"use client";

import { useLayoutEffect, useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

const STORAGE_KEY = "vp-sidebar";

export function Sidebar({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  useLayoutEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY) === "1";
    setCollapsed(saved);
  }, []);

  useLayoutEffect(() => {
    document.querySelector(".app")?.classList.toggle("sidebar-collapsed", collapsed);
  }, [collapsed]);

  function toggle() {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  return (
    <aside className="sidebar">
      <button
        type="button"
        className="sidebar-collapse"
        aria-expanded={!collapsed}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        onClick={toggle}
      >
        {collapsed ? <PanelLeftOpen strokeWidth={1.75} aria-hidden /> : <PanelLeftClose strokeWidth={1.75} aria-hidden />}
      </button>
      {children}
    </aside>
  );
}
