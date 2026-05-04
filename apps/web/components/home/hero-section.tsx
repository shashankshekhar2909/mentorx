"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/* ── Typewriter ── */
const HEADLINES = [
  "Ace Your Dream Exam",
  "Crack UPSC, JEE, NEET",
  "Learn From Top Rankers",
  "Master Every Subject",
];

function TypewriterText() {
  const [index, setIndex] = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const full = HEADLINES[index];
    let t: ReturnType<typeof setTimeout>;
    if (!isDeleting && displayed.length < full.length) {
      t = setTimeout(() => setDisplayed(full.slice(0, displayed.length + 1)), 60);
    } else if (!isDeleting && displayed.length === full.length) {
      t = setTimeout(() => setIsDeleting(true), 2200);
    } else if (isDeleting && displayed.length > 0) {
      t = setTimeout(() => setDisplayed(displayed.slice(0, -1)), 32);
    } else {
      setIsDeleting(false);
      setIndex((i) => (i + 1) % HEADLINES.length);
    }
    return () => clearTimeout(t);
  }, [displayed, isDeleting, index]);

  return (
    <>
      <span className="animated-gradient-text">{displayed}</span>
      <span
        className="ml-0.5 inline-block align-middle"
        style={{
          width: "3px",
          height: "0.82em",
          background: "#a78bfa",
          borderRadius: "2px",
          animation: "ctaBlink 1s step-end infinite",
          verticalAlign: "middle",
        }}
      />
    </>
  );
}

/* ── Mouse-parallax tilt on card grid ── */
function TiltWrapper({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    function onMove(e: MouseEvent) {
      if (!el) return;
      const r = el.getBoundingClientRect();
      const rx = ((e.clientY - r.top - r.height / 2) / (r.height / 2)) * 3.5;
      const ry = ((e.clientX - r.left - r.width / 2) / (r.width / 2)) * -3.5;
      el.style.transform = `perspective(1200px) rotateX(${rx}deg) rotateY(${ry}deg)`;
    }
    function onLeave() {
      if (!el) return;
      el.style.transform = "perspective(1200px) rotateX(0deg) rotateY(0deg)";
    }
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <div
      ref={ref}
      className="relative mt-16 w-full max-w-5xl"
      style={{
        animation: "fadeInUp 0.8s 0.55s ease both",
        transition: "transform 0.14s ease-out",
        willChange: "transform",
      }}
    >
      {children}
    </div>
  );
}

/* ── Main Hero ── */
export function HeroSection() {
  return (
    <section className="relative w-full" style={{ minHeight: "100vh" }}>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center px-6 pb-16 pt-24 text-center lg:pt-32">

        {/* Badge */}
        <div
          className="glass mb-8 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-violet-300"
          style={{ animation: "fadeInUp 0.6s ease both" }}
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-500" />
          </span>
          India&apos;s #1 Exam-Prep Mentorship Platform
        </div>

        {/*
          Headline — two SEPARATE block elements so the typewriter line
          never shifts the static line. Each line occupies its own
          fixed single-line height; no layout jump on rewrite.
        */}
        <div style={{ animation: "fadeInUp 0.7s 0.15s ease both" }}>
          {/* Static line — always 1 line */}
          <h1 className="mx-auto max-w-4xl text-5xl font-black leading-tight tracking-tight text-white md:text-7xl lg:text-8xl">
            Get Mentored to
          </h1>
          {/* Typewriter line — fixed height = exactly 1 line, whitespace-nowrap prevents wrapping */}
          <div
            className="overflow-hidden whitespace-nowrap text-center text-4xl font-black leading-tight tracking-tight md:text-6xl lg:text-7xl"
            style={{ minHeight: "1.25em" }}
          >
            <TypewriterText />
          </div>
        </div>

        {/* Sub-headline */}
        <p
          className="mx-auto mt-8 max-w-2xl text-base leading-relaxed text-slate-400 md:text-lg"
          style={{ animation: "fadeInUp 0.7s 0.3s ease both" }}
        >
          Connect with top rankers and subject experts for UPSC, JEE, NEET, CAT, GATE and 50+ competitive exams.
          Live 1:1 sessions, AI study plans, and everything you need to crack the exam.
        </p>

        {/* CTA buttons */}
        <div
          className="mt-10 flex flex-wrap items-center justify-center gap-4"
          style={{ animation: "fadeInUp 0.7s 0.45s ease both" }}
        >
          <Link
            href="/register?role=student"
            className="cta-pulse cta-shimmer relative inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-blue-600 px-8 py-4 text-base font-bold text-white shadow-[0_4px_24px_rgba(124,58,237,0.4)] transition hover:from-violet-500 hover:to-blue-500"
          >
            <i className="fa-solid fa-magnifying-glass text-sm" />
            Find a Mentor
          </Link>
          <Link
            href="/register?role=mentor"
            className="glass inline-flex items-center gap-2 rounded-2xl border border-white/20 px-8 py-4 text-base font-bold text-white transition hover:border-violet-400/60 hover:bg-white/10"
          >
            <i className="fa-solid fa-chalkboard-teacher text-sm" />
            Become a Mentor
          </Link>
        </div>

        {/* Trust signals */}
        <div
          className="mt-10 flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500"
          style={{ animation: "fadeInUp 0.7s 0.6s ease both" }}
        >
          {[
            { icon: "fa-solid fa-shield-halved", text: "Verified mentors" },
            { icon: "fa-solid fa-star", text: "4.9/5 avg rating" },
            { icon: "fa-solid fa-bolt", text: "Book in 60 seconds" },
          ].map((item) => (
            <span key={item.text} className="flex items-center gap-2">
              <i className={`${item.icon} text-violet-400`} />
              {item.text}
            </span>
          ))}
        </div>

        {/* Hero cards with mouse-parallax tilt */}
        <TiltWrapper>
          <div className="grid gap-4 md:grid-cols-3">
            {/* Live session card */}
            <div className="glass-strong card-3d rounded-[1.6rem] p-5 text-left shadow-[0_20px_60px_rgba(124,58,237,0.15)]">
              <div className="mb-4 flex items-center justify-between">
                <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-400">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                  Live Now
                </span>
                <span className="text-xs text-slate-500">2 viewers</span>
              </div>
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-blue-500 text-sm font-bold text-white">
                  R
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Rahul Verma</p>
                  <p className="text-xs text-slate-400">IIT Delhi · JEE Expert</p>
                </div>
              </div>
              <p className="text-xs text-slate-400">Solving Integration Problems</p>
              <div className="mt-3 h-1 rounded-full bg-white/10">
                <div className="h-1 w-3/5 rounded-full bg-gradient-to-r from-violet-500 to-blue-500" />
              </div>
              <p className="mt-1 text-right text-[10px] text-slate-600">35 min remaining</p>
            </div>

            {/* Stats card */}
            <div className="glass-strong card-3d rounded-[1.6rem] p-5 text-left shadow-[0_20px_60px_rgba(59,130,246,0.12)]">
              <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-400">Your Progress</p>
              {[
                { label: "Sessions", value: "12", color: "from-violet-500 to-blue-500", pct: "75%" },
                { label: "Hours", value: "28", color: "from-blue-500 to-cyan-500", pct: "60%" },
                { label: "Topics", value: "47", color: "from-cyan-500 to-emerald-500", pct: "85%" },
              ].map((item) => (
                <div key={item.label} className="mb-3">
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-slate-400">{item.label}</span>
                    <span className="font-bold text-white">{item.value}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/10">
                    <div className={`h-1.5 rounded-full bg-gradient-to-r ${item.color}`} style={{ width: item.pct }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Upcoming session card */}
            <div className="glass-strong card-3d rounded-[1.6rem] p-5 text-left shadow-[0_20px_60px_rgba(6,182,212,0.10)]">
              <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-400">Next Session</p>
              <div className="mb-4 rounded-xl bg-gradient-to-br from-violet-500/20 to-blue-500/20 p-3">
                <p className="text-xs text-slate-400">Tomorrow, 10:00 AM</p>
                <p className="mt-1 text-sm font-bold text-white">UPSC Essay Writing</p>
                <p className="mt-0.5 text-xs text-violet-300">with Priya Sharma</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {["Current Affairs", "Answer Structuring", "Time Management"].map((tag) => (
                  <span key={tag} className="rounded-full bg-white/8 px-2.5 py-1 text-[10px] text-slate-400">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </TiltWrapper>
      </div>

      {/* Bottom fade */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#05070f] to-transparent" />
    </section>
  );
}
