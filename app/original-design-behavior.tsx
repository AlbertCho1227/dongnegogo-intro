"use client";

import { useEffect } from "react";

export default function OriginalDesignBehavior() {
  useEffect(() => {
    const button = document.getElementById("to-top");
    if (!button) return;

    const update = () => {
      const visible = window.scrollY > 400;
      button.style.opacity = visible ? "1" : "0";
      button.style.visibility = visible ? "visible" : "hidden";
      button.style.transform = visible ? "translateY(0)" : "translateY(12px)";
    };

    window.addEventListener("scroll", update, { passive: true });
    update();
    return () => window.removeEventListener("scroll", update);
  }, []);

  return null;
}
