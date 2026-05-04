"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useReveal } from "./use-reveal";

type Stat = {
  label: string;
  value: number;
  suffix: string;
  icon: string;
  color: string;
};

const STATS: Stat[] = [
  { label: "Students enrolled",  value: 12000, suffix: "+", icon: "fa-solid fa-user-graduate", color: "text-violet-400" },
  { label: "Expert mentors",     value: 500,   suffix: "+", icon: "fa-solid fa-chalkboard-user", color: "text-blue-400" },
  { label: "Exams covered",      value: 50,    suffix: "+", icon: "fa-solid fa-book-open",        color: "text-cyan-400" },
  { label: "Success rate",       value: 95,    suffix: "%", icon: "fa-solid fa-trophy",           color: "text-amber-400" },
];

function AnimatedCounter({ target, suffix, active }: { target: number; suffix: string; active: boolean }) {
  const [value, setValue] = useState(0);
  const raf = useRef<number>(0);

  useEffect(() => {
    if (!active) return;
    const start = performance.now();
    const duration = 1800;

    function step(now: number) {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setValue(Math.floor(ease * target));
      if (t < 1) raf.current = requestAnimationFrame(step);
    }

    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [active, target]);

  return (
    <span>
      {value.toLocaleString()}
      {suffix}
    </span>
  );
}

export function StatsBar() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);
  const revealRef = useReveal();

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.2 },
    );
    obs.observe(section);
    return () => obs.disconnect();
  }, []);

  return (
    <section
      ref={(el) => {
        sectionRef.current = el;
        (revealRef as React.MutableRefObject<HTMLElement | null>).current = el;
      }}
      className="relative w-full overflow-hidden py-16"
    >
      <div className="absolute inset-0 particles-bg opacity-40" />

      {/* Divider lines */}
      <div className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/30 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />

      <div className="relative mx-auto max-w-6xl px-6">
        {/* Label */}
        <p className="reveal mb-10 text-center text-xs font-semibold uppercase tracking-widest text-slate-600">
          Trusted by thousands of exam aspirants across India
        </p>

        <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
          {STATS.map((stat, i) => (
            <div
              key={stat.label}
              className={`reveal delay-${i * 100 + 100} glass rounded-[1.5rem] p-6 text-center hover-glow`}
            >
              <div className={`mb-3 text-3xl ${stat.color}`}>
                <i className={stat.icon} />
              </div>
              <div className="text-3xl font-black text-white md:text-4xl">
                <AnimatedCounter
                  target={stat.value}
                  suffix={stat.suffix}
                  active={visible}
                />
              </div>
              <p className="mt-2 text-xs font-medium uppercase tracking-widest text-slate-500">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
