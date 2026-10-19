"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("vp-theme", theme);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const stored = localStorage.getItem("vp-theme");
    const next: Theme = stored === "dark" ? "dark" : "light";
    setTheme(next);
    document.documentElement.dataset.theme = next;
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      role="switch"
      aria-checked={theme === "dark"}
      aria-label={theme === "dark" ? "Dark theme on" : "Light theme on"}
      onClick={toggle}
    >
      <span className="theme-knob" />
      <Sun />
      <Moon />
    </button>
  );
}
