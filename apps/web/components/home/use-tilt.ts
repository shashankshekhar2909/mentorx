"use client";

import { useEffect, useRef } from "react";

/**
 * Applies a smooth CSS 3D tilt on mousemove and resets on mouseleave.
 * Attach the returned ref to any container whose direct children should tilt.
 * Pass `selector` to target specific elements inside the container.
 */
export function useTilt(
  maxDeg = 10,
  selector = ".tilt-target",
) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    const elements = selector
      ? Array.from(container.querySelectorAll<HTMLElement>(selector))
      : [container];

    function onMove(el: HTMLElement, e: MouseEvent) {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / (rect.width / 2);
      const dy = (e.clientY - cy) / (rect.height / 2);
      const rotX = -dy * maxDeg;
      const rotY = dx * maxDeg;
      el.style.transform = `perspective(800px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(1.03)`;
    }

    function onLeave(el: HTMLElement) {
      el.style.transform = "";
    }

    const handlers: Array<() => void> = [];

    elements.forEach((el) => {
      const moveHandler = (e: MouseEvent) => onMove(el, e);
      const leaveHandler = () => onLeave(el);
      el.addEventListener("mousemove", moveHandler);
      el.addEventListener("mouseleave", leaveHandler);
      handlers.push(() => {
        el.removeEventListener("mousemove", moveHandler);
        el.removeEventListener("mouseleave", leaveHandler);
      });
    });

    return () => handlers.forEach((fn) => fn());
  }, [maxDeg, selector]);

  return ref;
}
