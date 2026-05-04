"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { useAuthStore } from "@/lib/auth-store";
import type { Role } from "@/lib/types";

type NavLink = { href: string; label: string; icon: string };

type Props = {
  role: Role | Role[];
  title: string;
  children: ReactNode;
};

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function getLinks(role: Role): NavLink[] {
  if (role === "student") {
    return [
      { href: "/dashboard/student",           label: "Home",        icon: "fa-solid fa-house" },
      { href: "/dashboard/student/mentors",    label: "Mentors",     icon: "fa-solid fa-chalkboard-user" },
      { href: "/dashboard/student/chats",      label: "Chats",       icon: "fa-solid fa-comments" },
      { href: "/dashboard/student/practice-tests", label: "Practice", icon: "fa-solid fa-file-circle-check" },
      { href: "/dashboard/calendar",           label: "Calendar",    icon: "fa-solid fa-calendar-days" },
      { href: "/dashboard/recordings",         label: "Recordings",  icon: "fa-solid fa-circle-play" },
      { href: "/dashboard/resources",          label: "Resources",   icon: "fa-solid fa-book-open" },
    ];
  }
  if (role === "mentor") {
    return [
      { href: "/dashboard/mentor",             label: "Home",        icon: "fa-solid fa-house" },
      { href: "/dashboard/mentor/students",    label: "Students",    icon: "fa-solid fa-user-graduate" },
      { href: "/dashboard/mentor/chats",       label: "Chats",       icon: "fa-solid fa-comments" },
      { href: "/dashboard/calendar",           label: "Calendar",    icon: "fa-solid fa-calendar-days" },
      { href: "/dashboard/recordings",         label: "Recordings",  icon: "fa-solid fa-circle-play" },
    ];
  }
  if (role === "manager") {
    return [
      { href: "/dashboard/manager",            label: "Home",        icon: "fa-solid fa-house" },
      { href: "/dashboard/admin/practice-tests", label: "Practice Tests", icon: "fa-solid fa-list-check" },
      { href: "/dashboard/admin/sessions",     label: "Sessions",    icon: "fa-solid fa-video" },
      { href: "/dashboard/admin/verifications",label: "Verifications",icon: "fa-solid fa-shield-halved" },
      { href: "/dashboard/admin/users",        label: "Users",       icon: "fa-solid fa-users" },
    ];
  }
  // admin
  return [
    { href: "/dashboard/admin",              label: "Home",        icon: "fa-solid fa-house" },
    { href: "/dashboard/admin/practice-tests", label: "Practice Tests", icon: "fa-solid fa-list-check" },
    { href: "/dashboard/admin/system",       label: "System",      icon: "fa-solid fa-gear" },
    { href: "/dashboard/admin/sessions",     label: "Sessions",    icon: "fa-solid fa-video" },
    { href: "/dashboard/admin/verifications",label: "Verifications",icon: "fa-solid fa-shield-halved" },
    { href: "/dashboard/admin/users",        label: "Users",       icon: "fa-solid fa-users" },
  ];
}

const ROLE_LABELS: Record<string, string> = {
  student: "Student",
  mentor: "Mentor",
  manager: "Manager",
  admin: "Admin",
};

const ROLE_COLORS: Record<string, string> = {
  student: "from-violet-600 to-blue-600",
  mentor: "from-blue-600 to-cyan-600",
  manager: "from-emerald-600 to-teal-600",
  admin: "from-rose-600 to-pink-600",
};

export function DashboardShell({ role, title, children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const session = useAuthStore((s) => s.session);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const clearSession = useAuthStore((s) => s.clearSession);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const allowedRoles = Array.isArray(role) ? role : [role];

  useEffect(() => {
    if (!hasHydrated) return;
    if (!session) { router.replace("/login"); return; }
    if (!allowedRoles.includes(session.role)) {
      router.replace(`/dashboard/${session.role}`);
    }
  }, [session, role, router, allowedRoles, hasHydrated]);

  if (!hasHydrated) {
    return (
      <div
        className="flex min-h-screen w-full items-center justify-center"
        style={{ background: "#05070f" }}
      >
        <p className="text-sm text-slate-500">Loading workspace...</p>
      </div>
    );
  }

  if (!session || !allowedRoles.includes(session.role)) {
    return (
      <div
        className="flex min-h-screen w-full items-center justify-center"
        style={{ background: "#05070f" }}
      >
        <p className="text-sm text-slate-500">Checking access...</p>
      </div>
    );
  }

  const links = getLinks(session.role);
  const roleLabel = ROLE_LABELS[session.role] ?? "User";
  const roleColorClass = ROLE_COLORS[session.role] ?? "from-violet-600 to-blue-600";
  const initials = (session.displayName ?? session.email ?? "U").slice(0, 2).toUpperCase();

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div
        className="flex h-16 shrink-0 items-center gap-2.5 border-b px-5"
        style={{ borderColor: "rgba(255,255,255,0.06)" }}
      >
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-black text-white"
          style={{
            background: "linear-gradient(135deg, #7c3aed, #3b82f6)",
            boxShadow: "0 2px 12px rgba(124,58,237,0.4)",
          }}
        >
          MX
        </div>
        <span
          className="text-base font-black"
          style={{
            background: "linear-gradient(135deg, #a78bfa 0%, #60a5fa 60%, #34d399 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          MentorX
        </span>
      </div>

      {/* Nav links */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {links.map((link) => {
          const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setSidebarOpen(false)}
              className={classNames(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "text-white shadow-[0_2px_12px_rgba(124,58,237,0.2)]"
                  : "text-slate-400 hover:bg-white/6 hover:text-white",
              )}
              style={
                isActive
                  ? {
                      background:
                        "linear-gradient(135deg, rgba(124,58,237,0.25), rgba(59,130,246,0.15))",
                      border: "1px solid rgba(124,58,237,0.3)",
                    }
                  : {}
              }
            >
              <i
                className={classNames(
                  link.icon,
                  "w-4 text-center text-sm",
                  isActive ? "text-violet-300" : "text-slate-600 group-hover:text-slate-300",
                )}
              />
              {link.label}
              {isActive && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-violet-400" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User card + sign out */}
      <div
        className="shrink-0 border-t p-3"
        style={{ borderColor: "rgba(255,255,255,0.06)" }}
      >
        <Link
          href="/dashboard/profile"
          className="flex items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-white/6"
        >
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${roleColorClass} text-[11px] font-black text-white`}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">
              {session.displayName ?? session.email}
            </p>
            <p className="text-[11px] text-slate-500">{roleLabel}</p>
          </div>
        </Link>
        <button
          type="button"
          onClick={() => { clearSession(); router.push("/login"); }}
          className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-400"
        >
          <i className="fa-solid fa-right-from-bracket text-sm" />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div
      className="flex min-h-screen w-full pt-16"
      style={{ background: "#05070f" }}
    >
      {/* ── Desktop sidebar ── */}
      <aside
        className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col"
        style={{
          top: "64px", // below the fixed TopNav
          background: "rgba(8,13,26,0.95)",
          borderRight: "1px solid rgba(255,255,255,0.06)",
          backdropFilter: "blur(24px)",
        }}
      >
        <SidebarContent />
      </aside>

      {/* ── Mobile sidebar overlay ── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          {/* Drawer */}
          <aside
            className="absolute inset-y-0 left-0 flex w-64 flex-col pt-16"
            style={{
              background: "rgba(8,13,26,0.98)",
              borderRight: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* ── Main content area ── */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        {/* Page header */}
        <header
          className="sticky top-16 z-30 flex h-14 items-center gap-4 border-b px-4 sm:px-6 lg:px-8"
          style={{
            background: "rgba(5,7,15,0.9)",
            borderColor: "rgba(255,255,255,0.06)",
            backdropFilter: "blur(16px)",
          }}
        >
          {/* Mobile sidebar toggle */}
          <button
            type="button"
            className="flex items-center justify-center rounded-lg p-1.5 text-slate-400 transition hover:bg-white/8 hover:text-white lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <i className="fa-solid fa-bars text-sm" />
          </button>

          {/* Breadcrumb / title */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">{roleLabel} Area</span>
            <span className="text-slate-700">/</span>
            <span className="font-semibold text-white">{title}</span>
          </div>

          {/* Right side of header — spacer */}
          <div className="flex-1" />

          {/* Role badge */}
          <span
            className={`hidden rounded-full bg-gradient-to-r ${roleColorClass} px-3 py-1 text-[11px] font-bold text-white sm:inline-flex`}
          >
            {roleLabel}
          </span>
        </header>

        {/* Page body */}
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
