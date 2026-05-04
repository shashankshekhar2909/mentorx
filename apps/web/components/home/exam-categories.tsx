"use client";

import type React from "react";
import Link from "next/link";
import { useRef } from "react";
import { useReveal } from "./use-reveal";

type Exam = {
  name: string;
  slug: string;
  emoji: string;
  mentors: number;
  color: string;
  glowColor: string;
  tag: string;
};

const EXAMS: Exam[] = [
  { name: "UPSC CSE", slug: "upsc-cse", emoji: "🏛️", mentors: 84, color: "from-amber-500 to-orange-600", glowColor: "rgba(245,158,11,0.25)", tag: "Civil Services" },
  { name: "JEE Main & Advanced", slug: "jee-main-advanced", emoji: "⚙️", mentors: 112, color: "from-blue-500 to-violet-600", glowColor: "rgba(59,130,246,0.25)", tag: "Engineering" },
  { name: "NEET UG", slug: "neet-ug", emoji: "🧬", mentors: 95, color: "from-rose-500 to-pink-600", glowColor: "rgba(244,63,94,0.25)", tag: "Medical" },
  { name: "CAT", slug: "cat", emoji: "📊", mentors: 67, color: "from-emerald-500 to-teal-600", glowColor: "rgba(16,185,129,0.25)", tag: "MBA" },
  { name: "GATE", slug: "gate", emoji: "🔧", mentors: 58, color: "from-cyan-500 to-blue-600", glowColor: "rgba(6,182,212,0.25)", tag: "M.Tech / PSU" },
  { name: "SSC CGL", slug: "ssc-cgl", emoji: "📋", mentors: 73, color: "from-violet-500 to-purple-600", glowColor: "rgba(124,58,237,0.25)", tag: "Govt. Jobs" },
  { name: "Banking (IBPS/SBI)", slug: "banking", emoji: "🏦", mentors: 61, color: "from-indigo-500 to-blue-600", glowColor: "rgba(99,102,241,0.25)", tag: "Banking" },
  { name: "GMAT / GRE", slug: "gmat-gre", emoji: "🌍", mentors: 42, color: "from-fuchsia-500 to-pink-600", glowColor: "rgba(217,70,239,0.25)", tag: "Abroad" },
];

function ExamCard({ exam }: { exam: Exam }) {
  const cardRef = useRef<HTMLDivElement | null>(null);

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (rect.width / 2);
    const dy = (e.clientY - cy) / (rect.height / 2);
    el.style.transform = `perspective(700px) rotateX(${-dy * 12}deg) rotateY(${dx * 12}deg) scale(1.04)`;
    el.style.boxShadow = `0 24px 60px ${exam.glowColor}, 0 0 0 1px rgba(255,255,255,0.12)`;
  }

  function onMouseLeave() {
    const el = cardRef.current;
    if (!el) return;
    el.style.transform = "";
    el.style.boxShadow = "";
  }

  return (
    <Link href={`/register?exam=${exam.slug}`}>
      <div
        ref={cardRef}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        className="exam-card glass relative cursor-pointer overflow-hidden rounded-[1.5rem] p-5"
        style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.06)" }}
      >
        {/* Background gradient accent */}
        <div
          className={`pointer-events-none absolute right-0 top-0 h-24 w-24 rounded-full blur-2xl opacity-20 bg-gradient-to-br ${exam.color}`}
        />

        {/* Emoji */}
        <div className="mb-4 text-4xl">{exam.emoji}</div>

        {/* Name */}
        <h3 className="font-black text-white">{exam.name}</h3>

        {/* Tag */}
        <span
          className={`mt-2 inline-block rounded-full bg-gradient-to-r ${exam.color} px-2.5 py-0.5 text-[11px] font-semibold text-white`}
        >
          {exam.tag}
        </span>

        {/* Mentor count */}
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            <i className="fa-solid fa-users mr-1 text-slate-600" />
            {exam.mentors} mentors
          </span>
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/8 text-xs text-slate-400 transition-colors group-hover:bg-white/15">
            <i className="fa-solid fa-arrow-right" />
          </span>
        </div>

        {/* Bottom grad line */}
        <div className={`absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r ${exam.color} opacity-0 transition-opacity duration-300 group-hover:opacity-100`} />
      </div>
    </Link>
  );
}

export function ExamCategories() {
  const ref = useReveal();

  return (
    <section
      id="exams"
      ref={ref as React.RefObject<HTMLElement>}
      className="relative w-full overflow-hidden py-24"
    >

      <div className="relative mx-auto max-w-6xl px-6">
        {/* Header */}
        <div className="mb-14 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="reveal text-xs font-semibold uppercase tracking-widest text-violet-400">
              Exam categories
            </p>
            <h2 className="reveal delay-100 mt-4 text-4xl font-black tracking-tight text-white md:text-5xl">
              Your exam,{" "}
              <span className="grad-text-amber-rose">your mentor</span>
            </h2>
            <p className="reveal delay-200 mt-3 max-w-lg text-slate-400">
              Every mentor on MentorX is listed under the specific exam they teach. No generalists, only specialists.
            </p>
          </div>
          <div className="reveal delay-300 shrink-0">
            <Link
              href="/register"
              className="glass inline-flex items-center gap-2 rounded-2xl border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:border-violet-400/50"
            >
              Browse all exams
              <i className="fa-solid fa-arrow-right text-xs" />
            </Link>
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {EXAMS.map((exam, i) => (
            <div key={exam.slug} className={`reveal delay-${(i % 4) * 100 + 100}`}>
              <ExamCard exam={exam} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
