"use client";

import type React from "react";
import Link from "next/link";
import { useReveal } from "./use-reveal";

function FloatBadge({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className: string;
  delay?: number;
}) {
  return (
    <div
      className={`pointer-events-none absolute hidden lg:block ${className} float-medium`}
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="glass rounded-2xl px-4 py-2.5 text-xs font-semibold text-slate-300 shadow-[0_8px_24px_rgba(0,0,0,0.3)]">
        {children}
      </div>
    </div>
  );
}

export function CTASection() {
  const ref = useReveal();

  return (
    <section
      ref={ref as React.RefObject<HTMLElement>}
      className="relative w-full overflow-hidden py-32"
    >
      {/* Radial glow only — no solid fill */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 70% at 50% 50%, rgba(124,58,237,0.20) 0%, rgba(59,130,246,0.12) 40%, transparent 70%)",
        }}
      />

      {/* Glowing orb */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full blur-[120px]"
        style={{
          width: 600, height: 400,
          background: "radial-gradient(ellipse, rgba(124,58,237,0.25) 0%, rgba(59,130,246,0.15) 50%, transparent 70%)",
        }}
      />

      {/* Animated grid pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-10"
        style={{
          backgroundImage: "linear-gradient(rgba(124,58,237,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.4) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Top/bottom dividers */}
      <div className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/30 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />

      {/* Floating badges */}
      <FloatBadge className="left-[8%] top-[20%]" delay={0}>
        <i className="fa-solid fa-video mr-2 text-violet-400" />
        Live 1:1 Sessions
      </FloatBadge>
      <FloatBadge className="left-[6%] bottom-[22%]" delay={1.2}>
        <i className="fa-solid fa-robot mr-2 text-blue-400" />
        AI Study Plans
      </FloatBadge>
      <FloatBadge className="right-[8%] top-[25%]" delay={0.8}>
        <i className="fa-solid fa-calendar mr-2 text-cyan-400" />
        Flexible Booking
      </FloatBadge>
      <FloatBadge className="right-[6%] bottom-[20%]" delay={2}>
        <i className="fa-solid fa-circle-play mr-2 text-emerald-400" />
        Session Recordings
      </FloatBadge>
      <FloatBadge className="left-[18%] top-[10%]" delay={1.6}>
        <span className="text-amber-400">✓</span> Verified mentors
      </FloatBadge>
      <FloatBadge className="right-[18%] bottom-[12%]" delay={0.4}>
        <i className="fa-solid fa-shield-halved mr-2 text-violet-400" />
        Secure payments
      </FloatBadge>

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-3xl px-6 text-center">
        {/* Icon */}
        <div className="reveal mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-gradient-to-br from-violet-600 to-blue-600 shadow-[0_8px_40px_rgba(124,58,237,0.5)]">
          <i className="fa-solid fa-rocket text-3xl text-white" />
        </div>

        {/* Headline */}
        <h2 className="reveal delay-100 text-5xl font-black leading-tight tracking-tight text-white md:text-6xl">
          Your exam is{" "}
          <span className="animated-gradient-text">waiting</span>
          <br />
          So is your mentor.
        </h2>

        <p className="reveal delay-200 mx-auto mt-6 max-w-xl text-base leading-relaxed text-slate-400">
          Join 12,000+ students who stopped guessing and started preparing with purpose. The mentor who knows your exact exam is one click away.
        </p>

        {/* CTA buttons */}
        <div className="reveal delay-300 mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/register?role=student"
            className="cta-pulse cta-shimmer relative inline-flex items-center gap-3 rounded-2xl bg-gradient-to-r from-violet-600 to-blue-600 px-9 py-4 text-base font-bold text-white shadow-[0_4px_32px_rgba(124,58,237,0.45)] transition hover:from-violet-500 hover:to-blue-500"
          >
            <i className="fa-solid fa-graduation-cap" />
            Start Free Today
          </Link>
          <Link
            href="/register?role=mentor"
            className="glass inline-flex items-center gap-3 rounded-2xl border border-white/20 px-9 py-4 text-base font-bold text-white transition hover:border-violet-400/60 hover:bg-white/10"
          >
            <i className="fa-solid fa-chalkboard-teacher" />
            Teach on MentorX
          </Link>
        </div>

        {/* Fine print */}
        <p className="reveal delay-400 mt-6 text-xs text-slate-600">
          No subscription. Pay only for sessions you book. Cancel anytime.
        </p>

        {/* Social proof bar */}
        <div className="reveal delay-500 mt-12 inline-flex items-center gap-3 rounded-2xl border border-white/8 bg-white/4 px-6 py-3 backdrop-blur-sm">
          <div className="flex -space-x-2">
            {["AK", "SP", "RM", "DP", "VN"].map((initials, i) => (
              <div
                key={initials}
                className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#05070f] bg-gradient-to-br text-[10px] font-bold text-white"
                style={{
                  background: ["#7c3aed", "#3b82f6", "#06b6d4", "#10b981", "#f59e0b"][i],
                }}
              >
                {initials}
              </div>
            ))}
          </div>
          <p className="text-sm text-slate-400">
            <span className="font-bold text-white">1,200+</span> students joined this month
          </p>
        </div>
      </div>
    </section>
  );
}
