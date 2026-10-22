"use client";

import { useEffect, useState } from "react";
import { BrandLoader } from "@/components/brand/logo";

export function Intro() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("vp-intro")) return;
    setVisible(true);
    const timer = window.setTimeout(() => {
      sessionStorage.setItem("vp-intro", "1");
      setVisible(false);
    }, 450);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;
  return (
    <div className="intro">
      <BrandLoader label="Embee" />
    </div>
  );
}
