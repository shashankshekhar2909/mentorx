"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import type { Role } from "@/lib/types";

type NavLink = { href: string; label: string; icon: string };

function getLinks(role: Role): NavLink[] {
  if (role === "student") return [
    { href: "/dashboard/student",            label: "Overview",      icon: "fa-solid fa-house" },
    { href: "/dashboard/student/mentors",    label: "Mentors",       icon: "fa-solid fa-chalkboard-user" },
    { href: "/dashboard/student/chats",      label: "Chats",         icon: "fa-solid fa-comments" },
    { href: "/dashboard/student/practice-tests", label: "Practice",  icon: "fa-solid fa-file-circle-check" },
    { href: "/dashboard/calendar",           label: "Calendar",      icon: "fa-solid fa-calendar-days" },
    { href: "/dashboard/recordings",         label: "Recordings",    icon: "fa-solid fa-circle-play" },
    { href: "/dashboard/resources",          label: "Resources",     icon: "fa-solid fa-book-open" },
    { href: "/dashboard/profile",            label: "Profile",       icon: "fa-solid fa-circle-user" },
  ];
  if (role === "mentor") return [
    { href: "/dashboard/mentor",             label: "Overview",      icon: "fa-solid fa-house" },
    { href: "/dashboard/mentor/students",    label: "Students",      icon: "fa-solid fa-user-graduate" },
    { href: "/dashboard/mentor/chats",       label: "Chats",         icon: "fa-solid fa-comments" },
    { href: "/dashboard/calendar",           label: "Calendar",      icon: "fa-solid fa-calendar-days" },
    { href: "/dashboard/recordings",         label: "Recordings",    icon: "fa-solid fa-circle-play" },
    { href: "/dashboard/profile",            label: "Profile",       icon: "fa-solid fa-circle-user" },
  ];
  if (role === "manager") return [
    { href: "/dashboard/manager",            label: "Overview",      icon: "fa-solid fa-house" },
    { href: "/dashboard/admin/practice-tests", label: "Practice Tests", icon: "fa-solid fa-list-check" },
    { href: "/dashboard/admin/sessions",     label: "Sessions",      icon: "fa-solid fa-video" },
    { href: "/dashboard/admin/verifications",label: "Verifications", icon: "fa-solid fa-shield-halved" },
    { href: "/dashboard/admin/users",        label: "Users",         icon: "fa-solid fa-users" },
    { href: "/dashboard/profile",            label: "Profile",       icon: "fa-solid fa-circle-user" },
  ];
  return [
    { href: "/dashboard/admin",              label: "Overview",      icon: "fa-solid fa-house" },
    { href: "/dashboard/admin/practice-tests", label: "Practice Tests", icon: "fa-solid fa-list-check" },
    { href: "/dashboard/admin/system",       label: "System",        icon: "fa-solid fa-gear" },
    { href: "/dashboard/admin/sessions",     label: "Sessions",      icon: "fa-solid fa-video" },
    { href: "/dashboard/admin/verifications",label: "Verifications", icon: "fa-solid fa-shield-halved" },
    { href: "/dashboard/admin/users",        label: "Users",         icon: "fa-solid fa-users" },
    { href: "/dashboard/profile",            label: "Profile",       icon: "fa-solid fa-circle-user" },
  ];
}

const ROLE_COLORS: Record<string, string> = {
  student: "from-violet-600 to-blue-600",
  mentor:  "from-blue-600 to-cyan-600",
  manager: "from-emerald-600 to-teal-600",
  admin:   "from-rose-600 to-pink-600",
};

function getPageTitle(pathname: string): string {
  const map: Record<string, string> = {
    "/dashboard/student":             "Overview",
    "/dashboard/student/mentors":     "Find Mentors",
    "/dashboard/student/chats":       "Chats",
    "/dashboard/student/practice-tests": "Practice Tests",
    "/dashboard/mentor":              "Overview",
    "/dashboard/mentor/students":     "My Students",
    "/dashboard/mentor/chats":        "Chats",
    "/dashboard/manager":             "Overview",
    "/dashboard/admin":               "Overview",
    "/dashboard/admin/practice-tests":"Practice Tests",
    "/dashboard/admin/system":        "System",
    "/dashboard/admin/sessions":      "Sessions",
    "/dashboard/admin/verifications": "Verifications",
    "/dashboard/admin/users":         "Users",
    "/dashboard/admin/categories":    "Categories",
    "/dashboard/admin/analytics":     "Analytics",
    "/dashboard/admin/disputes":      "Disputes",
    "/dashboard/calendar":            "Calendar",
    "/dashboard/recordings":          "Recordings",
    "/dashboard/resources":           "Resources",
    "/dashboard/profile":             "Profile",
  };
  if (map[pathname]) return map[pathname];
  if (pathname.startsWith("/dashboard/sessions/")) return "Live Session";
  return "Dashboard";
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const session     = useAuthStore((s) => s.session);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const clearSession = useAuthStore((s) => s.clearSession);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Live session page — full-screen, no sidebar chrome
  const isLiveSession = pathname.startsWith("/dashboard/sessions/");

  useEffect(() => {
    if (!hasHydrated) return;
    if (!session) router.replace("/login");
  }, [session, router, hasHydrated]);

  if (!hasHydrated || !session) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center" style={{ background: "#05070f" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
          <p className="text-sm text-slate-500">Loading workspace…</p>
        </div>
      </div>
    );
  }

  // Live session: render full-screen without sidebar
  if (isLiveSession) {
    return <div className="min-h-screen w-full" style={{ background: "#000" }}>{children}</div>;
  }

  const role          = session.role as Role;
  const links         = getLinks(role);
  const roleColor     = ROLE_COLORS[role] ?? "from-violet-600 to-blue-600";
  const initials      = (session.displayName ?? session.email ?? "U").slice(0, 2).toUpperCase();
  const roleLabel     = role.charAt(0).toUpperCase() + role.slice(1);
  const pageTitle     = getPageTitle(pathname);

  const SidebarInner = () => (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center gap-2.5 px-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-black text-white"
          style={{ background: "linear-gradient(135deg,#7c3aed,#3b82f6)", boxShadow: "0 2px 12px rgba(124,58,237,0.4)" }}
        >
          MX
        </div>
        <span
          className="text-base font-black"
          style={{ background: "linear-gradient(135deg,#a78bfa 0%,#60a5fa 60%,#34d399 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}
        >
          MentorX
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {links.map((link) => {
          const isActive = pathname === link.href || (link.href !== "/dashboard/student" && link.href !== "/dashboard/mentor" && link.href !== "/dashboard/manager" && link.href !== "/dashboard/admin" && pathname.startsWith(link.href + "/"));
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setSidebarOpen(false)}
              className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150"
              style={isActive
                ? { background: "linear-gradient(135deg,rgba(124,58,237,0.22),rgba(59,130,246,0.12))", border: "1px solid rgba(124,58,237,0.28)", color: "#fff" }
                : { color: "rgba(148,163,184,0.85)", border: "1px solid transparent" }
              }
            >
              <i className={`${link.icon} w-4 text-center text-sm ${isActive ? "text-violet-300" : "text-slate-600 group-hover:text-slate-300"}`} />
              <span>{link.label}</span>
              {isActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-violet-400" />}
            </Link>
          );
        })}
      </nav>

      {/* User card */}
      <div className="shrink-0 px-3 pb-3 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <Link href="/dashboard/profile" className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-white/5">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${roleColor} text-[11px] font-black text-white`}>
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{session.displayName ?? session.email}</p>
            <p className="text-[11px] text-slate-500">{roleLabel}</p>
          </div>
        </Link>
        <button
          type="button"
          onClick={() => { clearSession(); router.push("/login"); }}
          className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-400"
        >
          <i className="fa-solid fa-right-from-bracket w-4 text-center text-sm" />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen w-full" style={{ background: "#05070f" }}>
      {/* Desktop sidebar */}
      <aside
        className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col"
        style={{ top: 0, background: "rgba(8,13,26,0.97)", borderRight: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(24px)" }}
      >
        <SidebarInner />
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside
            className="absolute inset-y-0 left-0 flex w-64 flex-col"
            style={{ background: "rgba(8,13,26,0.99)", borderRight: "1px solid rgba(255,255,255,0.06)" }}
          >
            <SidebarInner />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        {/* Sub-header */}
        <header
          className="sticky top-0 z-30 flex h-14 items-center gap-4 px-4 sm:px-6"
          style={{ background: "rgba(5,7,15,0.92)", borderBottom: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(16px)" }}
        >
          <button
            type="button"
            className="flex items-center justify-center rounded-lg p-1.5 text-slate-400 transition hover:bg-white/8 hover:text-white lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <i className="fa-solid fa-bars text-sm" />
          </button>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">{roleLabel}</span>
            <span className="text-slate-700">/</span>
            <span className="font-semibold text-white">{pageTitle}</span>
          </div>
          <div className="flex-1" />
          <span className={`hidden rounded-full bg-gradient-to-r ${roleColor} px-3 py-1 text-[11px] font-bold text-white sm:inline-flex`}>
            {roleLabel}
          </span>
        </header>

        {/* Content */}
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
