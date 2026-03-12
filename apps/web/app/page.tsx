import Link from "next/link";

import { PublicCategories } from "@/components/public-categories";

const studentSignals = [
  { label: "Exam categories", value: "Find mentors by your exam" },
  { label: "1:1 guidance", value: "Chat and approved live calls" },
  { label: "Revision support", value: "Come back to recordings later" },
];

const preparationBenefits = [
  {
    title: "Right mentor, right exam",
    body: "Students begin with the exam they are preparing for and discover mentors who actually teach that track.",
    icon: "fa-solid fa-compass",
  },
  {
    title: "Doubt solving with structure",
    body: "Mentor approval keeps conversations focused, so students get a more serious preparation environment.",
    icon: "fa-solid fa-comments",
  },
  {
    title: "Learning that stays with you",
    body: "Important sessions can be revisited later during revision, mock preparation, and exam week.",
    icon: "fa-solid fa-circle-play",
  },
];

const preparationMoments = [
  {
    title: "When you feel stuck",
    body: "Ask doubts, discuss weak topics, and get a clearer path forward from someone who knows the exam.",
  },
  {
    title: "When you need direction",
    body: "Use mentor guidance for planning, strategy, prioritisation, and knowing what to work on next.",
  },
  {
    title: "When revision begins",
    body: "Return to past sessions and revise explanations without depending only on notes or memory.",
  },
];

const reassurancePoints = [
  "Students connect through approved mentor relationships instead of open random messaging.",
  "Calls can be requested from chat and approved before the session begins.",
  "Recordings help turn a good class into something useful during revision too.",
];

export default function HomePage() {
  return (
    <div className="space-y-10">
      <section className="relative isolate overflow-hidden rounded-[2rem] border border-[#eadfcf] bg-[linear-gradient(135deg,#fffaf4,#fff1e2_48%,#fde5d4)] px-6 py-8 shadow-[0_28px_80px_rgba(113,63,18,0.12)] md:px-10 md:py-12">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.18),transparent_28%),radial-gradient(circle_at_78%_18%,rgba(249,115,22,0.14),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.12),transparent_32%)]" />
        <div className="pointer-events-none absolute -left-12 top-10 h-44 w-44 rounded-full bg-amber-200/45 blur-3xl float-slow" />
        <div className="pointer-events-none absolute right-6 top-0 h-60 w-60 rounded-full bg-orange-200/30 blur-3xl float-medium" />

        <div className="relative grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="max-w-4xl">
            <p className="inline-flex rounded-full border border-amber-300/60 bg-white/75 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-900">
              For serious exam preparation
            </p>
            <h1 className="mt-5 max-w-4xl text-4xl font-black leading-tight tracking-[-0.045em] text-slate-950 md:text-6xl">
              Get the right mentor support for the exam you are actually preparing for.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-700 md:text-lg">
              mentorXAI helps students discover mentors by exam category, ask focused doubts, join guided sessions,
              and return to recordings later when revision becomes intense.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/register"
                className="cta-pulse cta-shimmer rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(15,23,42,0.18)]"
              >
                Start preparing
              </Link>
              <Link
                href="/login"
                className="rounded-2xl border border-amber-300/70 bg-white/80 px-5 py-3 text-sm font-bold text-slate-900 transition hover:border-amber-400 hover:bg-white"
              >
                Login
              </Link>
            </div>

            <div className="mt-8 grid gap-3 md:grid-cols-3">
              {studentSignals.map((item) => (
                <article key={item.label} className="rounded-2xl border border-white/80 bg-white/75 px-4 py-4 shadow-sm backdrop-blur-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                  <p className="mt-2 text-sm font-bold text-slate-900">{item.value}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="perspective-1200 relative mx-auto w-full max-w-xl">
            <div className="relative min-h-[460px]">
              <div className="tilt-panel absolute left-0 top-10 w-[74%] rounded-[1.9rem] border border-white/80 bg-white/82 p-5 shadow-[0_22px_70px_rgba(120,53,15,0.14)] backdrop-blur-xl">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-800">A better study rhythm</p>
                <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950">Ask doubts when they appear. Revisit answers when revision starts.</h2>
                <div className="mt-5 space-y-3">
                  <div className="rounded-2xl border border-amber-100 bg-[#fffaf4] p-4">
                    <p className="text-xs text-slate-500">Step 1</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">Choose your exam category and find a relevant mentor</p>
                  </div>
                  <div className="rounded-2xl border border-amber-100 bg-[#fffaf4] p-4">
                    <p className="text-xs text-slate-500">Step 2</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">Chat after approval, then request a live call when needed</p>
                  </div>
                  <div className="rounded-2xl bg-slate-950 px-4 py-4 text-white">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Step 3</p>
                    <p className="mt-1 text-sm font-semibold">Use recordings to revisit the same explanation during revision.</p>
                  </div>
                </div>
              </div>

              <div className="tilt-panel-reverse absolute bottom-6 right-0 w-[56%] rounded-[1.6rem] border border-[#eadfcf] bg-[#fffaf2] p-5 text-slate-900 shadow-[0_24px_70px_rgba(120,53,15,0.12)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Student view</p>
                <div className="mt-4 space-y-3">
                  <div className="rounded-2xl bg-white p-3 shadow-sm">
                    <p className="text-xs text-slate-500">Mentor chat</p>
                    <p className="mt-1 text-sm font-semibold">Focused conversation after acceptance</p>
                  </div>
                  <div className="rounded-2xl bg-white p-3 shadow-sm">
                    <p className="text-xs text-slate-500">Live session</p>
                    <p className="mt-1 text-sm font-semibold">Ask doubts face to face</p>
                  </div>
                  <div className="rounded-2xl bg-white p-3 shadow-sm">
                    <p className="text-xs text-slate-500">Revision</p>
                    <p className="mt-1 text-sm font-semibold">Replay key sessions later</p>
                  </div>
                </div>
              </div>

              <div className="absolute right-10 top-2 rounded-full border border-amber-200 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-900 orbit-chip">
                Student-first
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {preparationBenefits.map((item) => (
          <article
            key={item.title}
            className="group relative overflow-hidden rounded-[1.75rem] border border-[#eadfcf] bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(120,53,15,0.08)]"
          >
            <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-gradient-to-br from-amber-100 to-transparent blur-2xl transition duration-300 group-hover:scale-125" />
            <div className="relative">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff4e5] text-amber-800 shadow-sm">
                <i className={item.icon} />
              </span>
              <h2 className="mt-5 text-2xl font-black tracking-tight text-slate-950">{item.title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[1.8rem] border border-[#eadfcf] bg-[linear-gradient(180deg,#fffefb,#fff6ea)] p-6 shadow-sm md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Why students use it</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">Preparation needs change across the cycle. Good support should keep up.</h2>
          <div className="mt-6 space-y-4">
            {preparationMoments.map((item, index) => (
              <div key={item.title} className="flex gap-4 rounded-2xl border border-[#eadfcf] bg-white p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-sm font-bold text-white">
                  {index + 1}
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{item.title}</p>
                  <p className="mt-1 text-sm leading-7 text-slate-600">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4">
          <article className="rounded-[1.8rem] border border-[#eadfcf] bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-800">A more serious environment</p>
            <h3 className="mt-3 text-2xl font-black tracking-tight text-slate-950">Students need support that feels focused, not noisy.</h3>
            <div className="mt-5 space-y-3">
              {reassurancePoints.map((point) => (
                <div key={point} className="flex gap-3 rounded-2xl bg-[#fff8ee] px-4 py-3">
                  <span className="mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-200 text-[11px] font-bold text-amber-900">
                    ✓
                  </span>
                  <p className="text-sm leading-7 text-slate-700">{point}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[1.8rem] border border-[#eadfcf] bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-800">Built for revision too</p>
            <h3 className="mt-3 text-2xl font-black tracking-tight text-slate-950">A strong explanation should still help when exam week arrives.</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              mentorXAI is useful because the same mentor connection, the same session history, and the same recordings
              remain available when students come back to revise difficult topics.
            </p>
          </article>
        </div>
      </section>

      <PublicCategories />

      <section className="relative overflow-hidden rounded-[2rem] border border-[#eadfcf] bg-[linear-gradient(135deg,#fff7ed,#ffedd5)] px-6 py-8 shadow-[0_24px_70px_rgba(120,53,15,0.1)] md:px-8 md:py-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(251,191,36,0.18),transparent_20%),radial-gradient(circle_at_85%_30%,rgba(249,115,22,0.14),transparent_22%),radial-gradient(circle_at_50%_100%,rgba(245,158,11,0.12),transparent_26%)]" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Start with the exam you care about</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
              Find the right mentor, ask better doubts, and keep preparing with more confidence.
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-700">
              mentorXAI brings mentor discovery, approved guidance, live sessions, and revision support into one preparation journey built around serious exams.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/login" className="rounded-2xl border border-amber-300/70 bg-white/80 px-5 py-3 text-sm font-bold text-slate-900">
              Login
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
