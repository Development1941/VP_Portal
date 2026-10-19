"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function Menu({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const menu = ref.current;
    if (!menu) return;
    const details = menu;

    function onToggle() {
      if (!details.open) return;
      document.querySelectorAll("details[open]").forEach((item) => {
        if (item !== details) item.removeAttribute("open");
      });
    }

    function onPointerDown(event: PointerEvent) {
      if (!details.open) return;
      if (event.target instanceof Node && details.contains(event.target)) return;
      details.open = false;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || !details.open) return;
      details.open = false;
      const summary = details.querySelector("summary");
      if (summary instanceof HTMLElement) summary.focus();
    }

    function onClick(event: MouseEvent) {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest("a")) details.open = false;
    }

    details.addEventListener("toggle", onToggle);
    details.addEventListener("click", onClick);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      details.removeEventListener("toggle", onToggle);
      details.removeEventListener("click", onClick);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <details ref={ref} className={className}>
      {children}
    </details>
  );
}
