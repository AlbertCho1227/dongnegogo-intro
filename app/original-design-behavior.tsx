"use client";

import { useEffect } from "react";

export default function OriginalDesignBehavior() {
  useEffect(() => {
    const button = document.getElementById("to-top");
    const update = () => {
      const visible = window.scrollY > 400;
      if (button) {
        button.style.opacity = visible ? "1" : "0";
        button.style.visibility = visible ? "visible" : "hidden";
        button.style.transform = visible ? "translateY(0)" : "translateY(12px)";
      }
    };

    window.addEventListener("scroll", update, { passive: true });
    update();
    return () => window.removeEventListener("scroll", update);
  }, []);

  useEffect(() => {
    const carousel = document.querySelector<HTMLElement>('[data-r="route-carousel"]');
    const pager = document.querySelector<HTMLElement>('[data-r="route-pager"]');
    const status = document.querySelector<HTMLElement>('[data-r="route-status"]');
    if (!carousel || !pager || !status) return;

    const pageButtons = Array.from(pager.querySelectorAll<HTMLButtonElement>("button[data-route-page]"));
    let frame = 0;

    const updatePage = () => {
      frame = 0;
      const width = carousel.clientWidth || 1;
      const page = Math.max(0, Math.min(pageButtons.length - 1, Math.round(carousel.scrollLeft / width)));
      pageButtons.forEach((pageButton, index) => {
        pageButton.setAttribute("aria-current", index === page ? "true" : "false");
      });
      status.textContent = `${page + 1} / ${pageButtons.length}`;
    };
    const scheduleUpdate = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updatePage);
    };
    const goToPage = (page: number) => {
      carousel.scrollTo({ left: carousel.clientWidth * page, behavior: "smooth" });
    };
    const listeners = pageButtons.map((pageButton, index) => {
      const listener = () => goToPage(index);
      pageButton.addEventListener("click", listener);
      return [pageButton, listener] as const;
    });

    carousel.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate, { passive: true });
    updatePage();

    return () => {
      if (frame) cancelAnimationFrame(frame);
      carousel.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      listeners.forEach(([pageButton, listener]) => pageButton.removeEventListener("click", listener));
    };
  }, []);

  return null;
}
