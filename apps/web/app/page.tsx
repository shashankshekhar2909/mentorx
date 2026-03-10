import Link from "next/link";

const highlights = [
  { label: "Active Roles", value: "4", note: "Student, Mentor, Manager, Admin" },
  { label: "Core Workspace", value: "Calendar + Call Hub", note: "One flow for scheduling and live sessions" },
  { label: "Operations", value: "Scoped", note: "Manager category permissions + admin control" }
];

const cards = [
  {
    title: "Students",
    points: [
      "Pick subjects and discover matching mentors",
      "Request calls with approval workflow",
      "Join live hub with chat and recordings",
      "Buy and access learning resources"
    ]
  },
  {
    title: "Mentors",
    points: [
      "Manage incoming requests and availability",
      "Teach across multiple categories",
      "Run calls and publish resources",
      "Track outcomes and session history"
    ]
  },
  {
    title: "Managers & Admin",
    points: [
      "Review users, verifications, disputes",
      "Approve mentor/session workflows",
      "Jump into calls for support or review",
      "Monitor performance and operations"
    ]
  }
];

export default function HomePage() {
  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-900 p-8 text-white shadow-xl md:p-12">
        <div className="absolute -right-12 -top-12 h-52 w-52 rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="absolute -left-12 bottom-0 h-52 w-52 rounded-full bg-teal-300/20 blur-3xl" />
        <div className="relative">
          <p className="inline-flex rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
            MentorX Platform
          </p>
          <h1 className="mt-4 max-w-4xl text-4xl font-extrabold leading-tight md:text-6xl">
            Mentorship marketplace for serious exam preparation.
          </h1>
          <p className="mt-4 max-w-3xl text-base text-white/85 md:text-lg">
            MentorX connects students, mentors, managers, and admins in one product workflow for discovery,
            scheduling, live sessions, resources, and operations.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/register" className="rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-slate-900">Join MentorX</Link>
            <Link href="/login" className="rounded-xl border border-white/40 bg-white/10 px-5 py-2.5 text-sm font-bold text-white">Login</Link>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        {highlights.map((item) => (
          <article key={item.label} className="app-card p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{item.label}</p>
            <p className="mt-2 text-2xl font-extrabold text-slate-900">{item.value}</p>
            <p className="mt-1 text-sm text-slate-600">{item.note}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {cards.map((card) => (
          <article key={card.title} className="app-card p-6">
            <h2 className="text-xl font-bold text-slate-900">{card.title}</h2>
            <ul className="mt-4 space-y-2">
              {card.points.map((point) => (
                <li key={point} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {point}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    </div>
  );
}
