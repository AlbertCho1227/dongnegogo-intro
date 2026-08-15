"use client";

import type { MouseEvent } from "react";

import styles from "./program-share.module.css";

export function OpenAppButton({ programID }: { programID: string }) {
  function openApp(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    const fallbackURL = new URL("/", window.location.origin);
    fallbackURL.hash = "top";
    let pageHidden = false;
    const cancelFallback = () => { pageHidden = true; };
    window.addEventListener("pagehide", cancelFallback, { once: true });
    window.location.href = `dongnegogo://program?id=${encodeURIComponent(programID)}`;
    window.setTimeout(() => {
      if (!pageHidden && document.visibilityState === "visible") {
        window.location.href = fallbackURL.href;
      }
    }, 1_100);
  }

  return (
    <a className={styles.appButton} href={`dongnegogo://program?id=${encodeURIComponent(programID)}`} onClick={openApp}>
      <span aria-hidden="true">●</span>
      앱에서 지도로 보기
    </a>
  );
}

