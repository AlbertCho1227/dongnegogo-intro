"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef } from "react";

type Props = {
  src: string;
  fallbackSrc: string;
  alt: string;
  className?: string;
  loading?: "eager" | "lazy";
};

export function ProgramMediaImage({ src, fallbackSrc, alt, className, loading }: Props) {
  const imageRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const image = imageRef.current;
    if (!image) return;
    const replaceBrokenImage = () => {
      if (image.complete && image.naturalWidth === 0 && image.dataset.fallback !== "true") {
        image.dataset.fallback = "true";
        image.classList.add("is-media-fallback");
        image.src = fallbackSrc;
      }
    };
    replaceBrokenImage();
    const timer = window.setTimeout(replaceBrokenImage, 800);
    return () => window.clearTimeout(timer);
  }, [fallbackSrc, src]);

  return <img
    ref={imageRef}
    src={src}
    alt={alt}
    className={className}
    loading={loading}
    onError={(event) => {
      if (event.currentTarget.dataset.fallback === "true") return;
      event.currentTarget.dataset.fallback = "true";
      event.currentTarget.classList.add("is-media-fallback");
      event.currentTarget.src = fallbackSrc;
    }}
  />;
}
