"use client";

import { useEffect, useRef } from "react";

/**
 * Attaches an IntersectionObserver to a container element and adds the
 * `visible` class to every child that carries a reveal-* class once it
 * enters the viewport. Threshold and rootMargin are tuned for a
 * scroll-driven "animate in" feel.
 */
export function useReveal(threshold = 0.12) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    const targets = container.querySelectorAll(
      ".reveal, .reveal-left, .reveal-right, .reveal-scale",
    );

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold, rootMargin: "0px 0px -40px 0px" },
    );

    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [threshold]);

  return ref;
}
