"use client";

import { useEffect, useState } from "react";

const SHOW_AFTER_PX = 480;

export function BlogScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const updateVisibility = () => setVisible(window.scrollY >= SHOW_AFTER_PX);
    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });
    return () => window.removeEventListener("scroll", updateVisibility);
  }, []);

  const scrollToTop = () => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  };

  return <button
    className={`blog-scroll-top${visible ? " is-visible" : ""}`}
    type="button"
    aria-label="페이지 맨 위로 이동"
    title="위로 가기"
    aria-hidden={!visible}
    tabIndex={visible ? 0 : -1}
    onClick={scrollToTop}
  ><span aria-hidden="true">↑</span></button>;
}
