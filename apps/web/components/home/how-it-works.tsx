"use client";

import type React from "react";

import { useReveal } from "./use-reveal";

const STEPS = [
  {
    number: "01",
    icon: "fa-solid fa-magnifying-glass",
    title: "Find Your Mentor",
    body: "Browse verified mentors filtered by exam, subject, and rating. Read reviews from students who cracked the same exam you are targeting.",
    color: "from-violet-600 to-purple-600",
    glow: "rgba(124,58,237,0.3)",
    tags: ["UPSC", "JEE", "NEET", "CAT"],
  },
  {
    number: "02",
    icon: "fa-solid fa-calendar-check",
    title: "Book a Session",
    body: "Schedule 1:1 live video sessions at a time that works for you. Pay securely via Razorpay. Instant confirmation, no back-and-forth.",
    color: "from-blue-600 to-cyan-600",
    glow: "rgba(59,130,246,0.3)",
    tags: ["Live Video", "Chat", "Recordings"],
  },
  {
    number: "03",
    icon: "fa-solid fa-rocket",
    title: "Ace Your Exam",
    body: "Get personalised AI study plans, doubt resolution, and mock strategy. Your mentor is invested in your success, not just the session.",
    color: "from-cyan-600 to-emerald-600",
    glow: "rgba(16,185,129,0.3)",
    tags: ["AI Plans", "Mock Tests", "Strategy"],
  },
];

export function HowItWorks() {
  const ref = useReveal();

  return (
    <section
      ref={ref as React.RefObject<HTMLElement>}
      className="relative w-full overflow-hidden py-24"
    >

      {/* Radial glow top center */}
      <div
        className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2"
        style={{
          width: 700, height: 400,
          background: "radial-gradient(ellipse at center top, rgba(124,58,237,0.12), transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-6xl px-6">
        {/* Section header */}
        <div className="mb-16 text-center">
          <p className="reveal text-xs font-semibold uppercase tracking-widest text-violet-400">
            How it works
          </p>
          <h2 className="reveal delay-100 mt-4 text-4xl font-black tracking-tight text-white md:text-5xl">
            Three steps to{" "}
            <span className="grad-text-purple-blue">exam success</span>
          </h2>
          <p className="reveal delay-200 mx-auto mt-4 max-w-2xl text-base text-slate-400">
            From finding the right mentor to celebrating your result — mentorXAI supports every step of your preparation journey.
          </p>
        </div>

        {/* Steps */}
        <div className="relative grid gap-8 md:grid-cols-3">
          {/* Connector lines (desktop) */}
          <div className="pointer-events-none absolute left-0 right-0 top-10 hidden md:block">
            <svg viewBox="0 0 900 2" fill="none" className="w-full" preserveAspectRatio="none">
              <line x1="16.66%" y1="1" x2="50%" y2="1"
                stroke="url(#line1)" strokeWidth="1" strokeDasharray="6 4" />
              <line x1="50%" y1="1" x2="83.33%" y2="1"
                stroke="url(#line2)" strokeWidth="1" strokeDasharray="6 4" />
              <defs>
                <linearGradient id="line1" x1="0" y1="0" x2="1" y2="0" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#7c3aed" stopOpacity="0.5" />
                  <stop offset="1" stopColor="#3b82f6" stopOpacity="0.3" />
                </linearGradient>
                <linearGradient id="line2" x1="0" y1="0" x2="1" y2="0" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#3b82f6" stopOpacity="0.3" />
                  <stop offset="1" stopColor="#06b6d4" stopOpacity="0.5" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {STEPS.map((step, i) => (
            <div
              key={step.number}
              className={`reveal delay-${i * 200 + 100} group relative`}
            >
              {/* Step card */}
              <div
                className="glass-strong rounded-[1.75rem] p-7 transition-all duration-300"
                style={{
                  boxShadow: `0 0 0 1px rgba(255,255,255,0.06), 0 24px 60px rgba(0,0,0,0.3)`,
                }}
              >
                {/* Number + Icon */}
                <div className="mb-6 flex items-center gap-4">
                  <div className="relative">
                    <div
                      className={`relative z-10 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${step.color} text-xl text-white shadow-lg`}
                      style={{ boxShadow: `0 8px 24px ${step.glow}` }}
                    >
                      <i className={step.icon} />
                    </div>
                    {/* Glow ring */}
                    <div
                      className="absolute inset-0 rounded-2xl blur-md opacity-40 transition-opacity duration-300 group-hover:opacity-70"
                      style={{ background: `linear-gradient(135deg, ${step.glow}, transparent)` }}
                    />
                  </div>
                  <span className="text-5xl font-black text-white/5">{step.number}</span>
                </div>

                <h3 className="text-xl font-black text-white">{step.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-400">{step.body}</p>

                {/* Tags */}
                <div className="mt-5 flex flex-wrap gap-2">
                  {step.tags.map((tag) => (
                    <span
                      key={tag}
                      className={`rounded-full bg-gradient-to-r ${step.color} px-3 py-1 text-[11px] font-semibold text-white opacity-80`}
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Hover glow overlay */}
                <div
                  className="pointer-events-none absolute inset-0 rounded-[1.75rem] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  style={{
                    background: `radial-gradient(circle at 50% 0%, ${step.glow.replace("0.3", "0.06")}, transparent 60%)`,
                  }}
                />
              </div>

              {/* Arrow (mobile) */}
              {i < STEPS.length - 1 && (
                <div className="flex justify-center py-4 md:hidden">
                  <i className="fa-solid fa-chevron-down text-slate-700" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
