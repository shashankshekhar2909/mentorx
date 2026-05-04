"use client";

import type React from "react";
import Link from "next/link";
import { useReveal } from "./use-reveal";

type Mentor = {
  name: string;
  title: string;
  exam: string;
  rating: number;
  reviews: number;
  pricePerHr: number;
  avatar: string;
  tags: string[];
  color: string;
  verified: boolean;
  sessions: number;
};

const MENTORS: Mentor[] = [
  {
    name: "Priya Sharma",
    title: "IAS 2019 Rank 14",
    exam: "UPSC CSE",
    rating: 4.9,
    reviews: 312,
    pricePerHr: 1200,
    avatar: "PS",
    tags: ["Essay", "GS Paper 2", "Ethics"],
    color: "from-amber-500 to-orange-500",
    verified: true,
    sessions: 680,
  },
  {
    name: "Arjun Mehta",
    title: "IIT Bombay, JEE AIR 47",
    exam: "JEE Advanced",
    rating: 4.8,
    reviews: 485,
    pricePerHr: 900,
    avatar: "AM",
    tags: ["Calculus", "Mechanics", "Optics"],
    color: "from-blue-500 to-violet-500",
    verified: true,
    sessions: 1240,
  },
  {
    name: "Dr. Sonal Gupta",
    title: "MBBS AIIMS, NEET AIR 28",
    exam: "NEET UG",
    rating: 4.9,
    reviews: 274,
    pricePerHr: 1100,
    avatar: "SG",
    tags: ["Biology", "Biochemistry", "Physiology"],
    color: "from-rose-500 to-pink-500",
    verified: true,
    sessions: 510,
  },
  {
    name: "Vikram Nair",
    title: "IIM Ahmedabad, CAT 99.8%ile",
    exam: "CAT",
    rating: 4.7,
    reviews: 196,
    pricePerHr: 1500,
    avatar: "VN",
    tags: ["VARC", "DILR", "Mock Analysis"],
    color: "from-emerald-500 to-teal-500",
    verified: true,
    sessions: 390,
  },
  {
    name: "Anita Rao",
    title: "IITM, GATE CS AIR 12",
    exam: "GATE",
    rating: 4.8,
    reviews: 143,
    pricePerHr: 800,
    avatar: "AR",
    tags: ["Algorithms", "OS", "DBMS"],
    color: "from-cyan-500 to-blue-500",
    verified: true,
    sessions: 295,
  },
  {
    name: "Rohit Singhania",
    title: "SBI PO 2021, Banker 8yr",
    exam: "Banking",
    rating: 4.6,
    reviews: 221,
    pricePerHr: 650,
    avatar: "RS",
    tags: ["Quant", "Reasoning", "Interview"],
    color: "from-indigo-500 to-purple-500",
    verified: false,
    sessions: 460,
  },
];

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <i
          key={n}
          className={`fa-solid fa-star text-[10px] ${n <= Math.round(rating) ? "text-amber-400" : "text-slate-700"}`}
        />
      ))}
    </span>
  );
}

function MentorCard({ mentor }: { mentor: Mentor }) {
  return (
    <div
      className="glass-strong group relative w-72 flex-shrink-0 cursor-pointer overflow-hidden rounded-[1.6rem] p-5 transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_24px_60px_rgba(124,58,237,0.2)]"
      style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.06)" }}
    >
      {/* Background gradient accent */}
      <div
        className={`pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-full blur-3xl opacity-10 bg-gradient-to-br ${mentor.color} transition-opacity duration-300 group-hover:opacity-25`}
      />

      {/* Avatar + verified */}
      <div className="mb-4 flex items-start justify-between">
        <div className="relative">
          <div
            className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${mentor.color} text-base font-black text-white shadow-lg`}
          >
            {mentor.avatar}
          </div>
          {mentor.verified && (
            <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 shadow-md">
              <i className="fa-solid fa-check text-[9px] text-white" />
            </div>
          )}
        </div>
        <span
          className={`rounded-full bg-gradient-to-r ${mentor.color} px-2.5 py-1 text-[11px] font-semibold text-white`}
        >
          {mentor.exam}
        </span>
      </div>

      {/* Name + title */}
      <h3 className="font-black text-white">{mentor.name}</h3>
      <p className="mt-0.5 text-xs text-slate-400">{mentor.title}</p>

      {/* Rating */}
      <div className="mt-3 flex items-center gap-2">
        <StarRating rating={mentor.rating} />
        <span className="text-xs font-semibold text-amber-400">{mentor.rating}</span>
        <span className="text-xs text-slate-600">({mentor.reviews} reviews)</span>
      </div>

      {/* Tags */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {mentor.tags.map((tag) => (
          <span key={tag} className="rounded-full bg-white/8 px-2 py-0.5 text-[11px] text-slate-400">
            {tag}
          </span>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-5 flex items-center justify-between border-t border-white/8 pt-4">
        <div>
          <p className="text-xs text-slate-500">
            <i className="fa-solid fa-video mr-1" />
            {mentor.sessions} sessions
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">from</p>
          <p className="font-black text-white">
            ₹{mentor.pricePerHr.toLocaleString()}
            <span className="text-xs font-normal text-slate-500">/hr</span>
          </p>
        </div>
      </div>

      {/* CTA button (appears on hover) */}
      <div className="mt-3 overflow-hidden transition-all duration-300 max-h-0 group-hover:max-h-12">
        <Link
          href="/register"
          className={`block w-full rounded-xl bg-gradient-to-r ${mentor.color} py-2 text-center text-xs font-bold text-white`}
        >
          Book a session
        </Link>
      </div>
    </div>
  );
}

export function FeaturedMentors() {
  const ref = useReveal();

  return (
    <section
      ref={ref as React.RefObject<HTMLElement>}
      className="relative w-full overflow-hidden py-24"
    >

      <div className="relative mx-auto max-w-6xl px-6">
        {/* Header */}
        <div className="mb-12 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="reveal text-xs font-semibold uppercase tracking-widest text-blue-400">
              Featured mentors
            </p>
            <h2 className="reveal delay-100 mt-4 text-4xl font-black tracking-tight text-white md:text-5xl">
              Learn from{" "}
              <span className="grad-text-cyan-purple">top rankers</span>
            </h2>
            <p className="reveal delay-200 mt-3 max-w-lg text-slate-400">
              Every mentor is a proven exam cracker. They have been where you are and know the exact path to the top.
            </p>
          </div>
          <div className="reveal delay-300 shrink-0">
            <Link
              href="/register"
              className="glass inline-flex items-center gap-2 rounded-2xl border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:border-blue-400/50"
            >
              See all mentors
              <i className="fa-solid fa-arrow-right text-xs" />
            </Link>
          </div>
        </div>
      </div>

      {/* Horizontal scroll track */}
      <div className="reveal relative px-6 lg:px-[calc((100vw-72rem)/2+1.5rem)]">
        <div className="scroll-track pb-4">
          {MENTORS.map((mentor) => (
            <MentorCard key={mentor.name} mentor={mentor} />
          ))}
          {/* View more card */}
          <div className="flex w-56 flex-shrink-0 items-center justify-center rounded-[1.6rem] border border-dashed border-white/12">
            <Link
              href="/register"
              className="flex flex-col items-center gap-3 p-8 text-center"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5">
                <i className="fa-solid fa-plus text-xl text-slate-400" />
              </div>
              <p className="text-sm font-semibold text-slate-400">
                500+ more<br />mentors
              </p>
            </Link>
          </div>
        </div>

        {/* Scroll fade edges */}
        <div className="pointer-events-none absolute left-0 top-0 h-full w-16 bg-gradient-to-r from-[#05070f] to-transparent" />
        <div className="pointer-events-none absolute right-0 top-0 h-full w-24 bg-gradient-to-l from-[#05070f] to-transparent" />
      </div>
    </section>
  );
}
