"use client";

import { useLayoutEffect, useState } from "react";
import { PanelLeftClose } from "lucide-react";

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

  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => document.querySelector(".app")?.classList.add("sidebar-ready"));
    return () => cancelAnimationFrame(frame);
  }, []);

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
        <PanelLeftClose strokeWidth={1.75} aria-hidden />
      </button>
      {children}
    </aside>
  );
}
