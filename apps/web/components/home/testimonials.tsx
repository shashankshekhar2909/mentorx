"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useReveal } from "./use-reveal";

type Testimonial = {
  name: string;
  avatar: string;
  exam: string;
  rank: string;
  color: string;
  quote: string;
  rating: number;
  year: string;
};

const TESTIMONIALS: Testimonial[] = [
  {
    name: "Aditya Kumar",
    avatar: "AK",
    exam: "UPSC CSE",
    rank: "IAS 2023 · AIR 41",
    color: "from-amber-500 to-orange-500",
    quote: "I had failed twice before finding my mentor on MentorX. The personalised essay feedback and mock interview sessions made all the difference. My rank jumped from 400 to 41 in one attempt.",
    rating: 5,
    year: "2023",
  },
  {
    name: "Sneha Patel",
    avatar: "SP",
    exam: "JEE Advanced",
    rank: "IIT Bombay · AIR 89",
    color: "from-blue-500 to-violet-500",
    quote: "The mentor matched me by my exact weak topics — rotational mechanics and organic chemistry. Three months of targeted sessions and I cleared JEE Advanced with a rank I never thought possible.",
    rating: 5,
    year: "2024",
  },
  {
    name: "Rohan Singh",
    avatar: "RS",
    exam: "CAT",
    rank: "IIM Calcutta · 99.4%ile",
    color: "from-emerald-500 to-teal-500",
    quote: "My VARC was stuck at 80%ile for two attempts. Weekly reading comprehension sessions with my mentor helped me crack the logic behind CAT passages. Scored 95%ile in VARC this time.",
    rating: 5,
    year: "2023",
  },
  {
    name: "Meera Iyer",
    avatar: "MI",
    exam: "NEET UG",
    rank: "AIIMS Delhi · AIR 156",
    color: "from-rose-500 to-pink-500",
    quote: "Dr. Sonal explained biochemistry pathways in a way that just clicked. I had been rote-learning for two years; she taught me to visualise and reason. AIIMS was a dream I thought was too far.",
    rating: 5,
    year: "2024",
  },
  {
    name: "Karthik Reddy",
    avatar: "KR",
    exam: "GATE CS",
    rank: "PSU Offer · AIR 27",
    color: "from-cyan-500 to-blue-500",
    quote: "The GATE-specific problem-solving approach my mentor gave me was incredibly systematic. I went from a 68 score to 87 in one year and got the PSU offer I wanted.",
    rating: 5,
    year: "2024",
  },
  {
    name: "Divya Nambiar",
    avatar: "DN",
    exam: "Banking",
    rank: "SBI PO 2023",
    color: "from-indigo-500 to-purple-500",
    quote: "I was struggling with DI and the interview round. My mentor had been through both and knew every trick. Cleared SBI PO in my second attempt with a very comfortable score.",
    rating: 4,
    year: "2023",
  },
];

function StarRow({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <i key={n} className={`fa-solid fa-star text-xs ${n <= count ? "text-amber-400" : "text-slate-700"}`} />
      ))}
    </div>
  );
}

function TestimonialCard({ t, active }: { t: Testimonial; active: boolean }) {
  return (
    <div
      className={`glass testimonial-card relative overflow-hidden rounded-[1.75rem] p-6 transition-all duration-500 ${
        active
          ? "opacity-100 scale-100"
          : "opacity-40 scale-95"
      }`}
      style={{
        boxShadow: active
          ? "0 24px 60px rgba(124,58,237,0.2), 0 0 0 1px rgba(255,255,255,0.10)"
          : "0 4px 24px rgba(0,0,0,0.2), 0 0 0 1px rgba(255,255,255,0.04)",
      }}
    >
      {/* Background accent */}
      <div
        className={`pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-full blur-3xl opacity-10 bg-gradient-to-br ${t.color}`}
      />

      {/* Quote mark */}
      <div className="mb-4 text-5xl font-black leading-none text-white/8">"</div>

      {/* Quote text */}
      <p className="relative z-10 text-sm leading-relaxed text-slate-300">{t.quote}</p>

      {/* Rating */}
      <div className="mt-5">
        <StarRow count={t.rating} />
      </div>

      {/* Author */}
      <div className="mt-5 flex items-center gap-3 border-t border-white/8 pt-5">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${t.color} text-xs font-black text-white shadow`}
        >
          {t.avatar}
        </div>
        <div>
          <p className="font-bold text-white">{t.name}</p>
          <p className="text-xs text-slate-400">{t.rank}</p>
        </div>
        <div className="ml-auto">
          <span
            className={`rounded-full bg-gradient-to-r ${t.color} px-2.5 py-1 text-[11px] font-semibold text-white`}
          >
            {t.exam}
          </span>
        </div>
      </div>
    </div>
  );
}

export function Testimonials() {
  const [active, setActive] = useState(0);
  const revealRef = useReveal();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setActive((i) => (i + 1) % TESTIMONIALS.length);
    }, 4000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  function goTo(i: number) {
    setActive(i);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setActive((idx) => (idx + 1) % TESTIMONIALS.length);
    }, 4000);
  }

  return (
    <section
      ref={revealRef as React.RefObject<HTMLElement>}
      className="relative w-full overflow-hidden py-24"
    >
      {/* Background */}

      {/* Dividers */}
      <div className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/20 to-transparent" />

      <div className="relative mx-auto max-w-6xl px-6">
        {/* Header */}
        <div className="mb-14 text-center">
          <p className="reveal text-xs font-semibold uppercase tracking-widest text-violet-400">
            Student success stories
          </p>
          <h2 className="reveal delay-100 mt-4 text-4xl font-black tracking-tight text-white md:text-5xl">
            Real results,{" "}
            <span className="grad-text-purple-blue">real ranks</span>
          </h2>
          <p className="reveal delay-200 mx-auto mt-4 max-w-xl text-slate-400">
            These are students who found the right mentor and followed through. Your rank could be next.
          </p>
        </div>

        {/* Featured (large) testimonial */}
        <div className="reveal delay-200 mb-8">
          <TestimonialCard t={TESTIMONIALS[active]} active />
        </div>

        {/* Pagination dots */}
        <div className="reveal delay-300 flex justify-center gap-2">
          {TESTIMONIALS.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              className={`rounded-full transition-all duration-300 ${
                i === active
                  ? "w-8 bg-violet-500 h-2"
                  : "w-2 bg-slate-700 h-2 hover:bg-slate-500"
              }`}
            />
          ))}
        </div>

        {/* Grid of other testimonials (desktop) */}
        <div className="mt-12 hidden grid-cols-3 gap-5 lg:grid">
          {TESTIMONIALS.filter((_, i) => i !== active).slice(0, 3).map((t) => (
            <div key={t.name} className="reveal">
              <TestimonialCard t={t} active={false} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
