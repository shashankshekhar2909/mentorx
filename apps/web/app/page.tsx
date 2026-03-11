import Link from "next/link";

const highlights = [
  { label: "Active Roles", value: "4", note: "Student, Mentor, Manager, Admin" },
  { label: "Live Sessions", value: "Instant + Scheduled", note: "One room system for planned classes and urgent mentor calls" },
  { label: "Session Review", value: "Recorded by Default", note: "Cloud recordings kept for learner review and moderation" }
];

const cards = [
  {
    title: "Students",
    icon: "fa-solid fa-user-graduate",
    accent: "from-sky-500/15 to-cyan-500/5",
    badge: "Learner Flow",
    points: [
      "Pick categories and discover approved mentors",
      "Send connection requests before chat or call access",
      "Use 1:1 chat, instant calling, and scheduled sessions",
      "Review recordings, resources, and learning history"
    ]
  },
  {
    title: "Mentors",
    icon: "fa-solid fa-chalkboard-user",
    accent: "from-emerald-500/15 to-teal-500/5",
    badge: "Teaching Flow",
    points: [
      "Accept students by subject expertise and connection flow",
      "Run live teaching sessions with room-based calling",
      "Publish paid or free resources for exam preparation",
      "Track students, recordings, and session outcomes"
    ]
  },
  {
    title: "Managers & Admin",
    icon: "fa-solid fa-shield-halved",
    accent: "from-amber-500/15 to-orange-500/5",
    badge: "Operations Flow",
    points: [
      "Moderate recordings, user activity, and disputes",
      "Approve mentor verification and session workflows",
      "Review calls with filters, pagination, and visibility control",
      "Operate category-scoped management at scale"
    ]
  }
];

const platformSections = [
  {
    title: "Mentor Discovery and Social Connection",
    icon: "fa-solid fa-user-group",
    description:
      "Students browse mentors by category, request connection, and unlock private chat or calling only after acceptance.",
  },
  {
    title: "Instant Calls and Scheduled Sessions",
    icon: "fa-solid fa-video",
    description:
      "mentorXAI supports both urgent instant calls and planned calendar sessions inside the same meeting architecture.",
  },
  {
    title: "Automatic Recording and Review",
    icon: "fa-solid fa-circle-play",
    description:
      "Meetings are recorded automatically, retained for learner review, and moderated by manager or admin when required.",
  },
  {
    title: "Role-Based Operations",
    icon: "fa-solid fa-shield-halved",
    description:
      "Managers and admins get approval, moderation, analytics, disputes, and scoped controls without exposing raw operational complexity.",
  },
  {
    title: "Profiles, Identity, and Presence",
    icon: "fa-solid fa-id-badge",
    description:
      "Every role has an editable profile, a visible identity label, and clearer participant naming across meeting rooms and navigation.",
  },
  {
    title: "Built for Scale",
    icon: "fa-solid fa-diagram-project",
    description:
      "Room-based calling, append-only recording history, paginated admin APIs, and backend-driven state updates support future growth.",
  },
];

export default function HomePage() {
  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-900 p-8 text-white shadow-xl md:p-12">
        <div className="absolute -right-12 -top-12 h-52 w-52 rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="absolute -left-12 bottom-0 h-52 w-52 rounded-full bg-teal-300/20 blur-3xl" />
        <div className="relative">
          <p className="inline-flex rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
            mentorXAI Platform
          </p>
          <h1 className="mt-4 max-w-4xl text-4xl font-extrabold leading-tight md:text-6xl">
            Mentorship marketplace for serious exam preparation.
          </h1>
          <p className="mt-4 max-w-3xl text-base text-white/85 md:text-lg">
            mentorXAI connects students, mentors, managers, and admins in one product workflow for discovery,
            scheduling, live sessions, resources, and operations.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/register" className="rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-slate-900">Join mentorXAI</Link>
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
          <article
            key={card.title}
            className={`relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br ${card.accent} p-6 shadow-sm`}
          >
            <div className="absolute right-0 top-0 h-28 w-28 rounded-full bg-white/40 blur-2xl" />
            <div className="relative">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="inline-flex rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                    {card.badge}
                  </p>
                  <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-900">{card.title}</h2>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/60 bg-white/80 text-slate-900 shadow-sm">
                  <i className={card.icon} />
                </div>
              </div>

              <ul className="mt-5 space-y-3">
                {card.points.map((point, index) => (
                  <li
                    key={point}
                    className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 text-sm text-slate-700 shadow-sm"
                  >
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
                      {index + 1}
                    </span>
                    <span className="leading-6">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Public Platform Features</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950">Everything students, mentors, and operations teams use in one platform.</h2>
          <p className="mt-3 text-sm text-slate-600">
            The public mentorXAI product includes mentor discovery, gated social connection, live sessions, recordings, moderation,
            dashboards, resources, and scalable role-based operations.
          </p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {platformSections.map((section) => (
            <article key={section.title} className="rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
                <i className={section.icon} />
              </div>
              <h3 className="mt-4 text-lg font-bold text-slate-900">{section.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{section.description}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
