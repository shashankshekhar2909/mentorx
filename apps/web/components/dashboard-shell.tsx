"use client";

import { ReactNode, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAuthStore } from "@/lib/auth-store";
import type { Role } from "@/lib/types";

type Props = {
  role: Role | Role[];
  title: string;
  children: ReactNode;
};

export function DashboardShell({ role, title, children }: Props) {
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  const allowedRoles = Array.isArray(role) ? role : [role];
  const workspaceLabel = Array.isArray(role) ? role.join(" / ") : role;

  useEffect(() => {
    if (!hasHydrated) return;
    if (!session) {
      router.replace("/login");
      return;
    }
    if (!allowedRoles.includes(session.role)) {
      router.replace(`/dashboard/${session.role}`);
    }
  }, [session, role, router, allowedRoles, hasHydrated]);

  if (!hasHydrated) {
    return <p className="text-sm text-black/70">Loading workspace...</p>;
  }

  if (!session || !allowedRoles.includes(session.role)) {
    return <p className="text-sm text-black/70">Checking access...</p>;
  }

  const links = (() => {
    if (session.role === "student") {
      return [
        { href: "/dashboard/student", label: "Student Home" },
        { href: "/dashboard/calendar", label: "Calendar" },
        { href: "/dashboard/recordings", label: "Recordings" },
        { href: "/dashboard/resources", label: "Resources" },
      ];
    }
    if (session.role === "mentor") {
      return [
        { href: "/dashboard/mentor", label: "Mentor Home" },
        { href: "/dashboard/calendar", label: "Calendar" },
        { href: "/dashboard/recordings", label: "Recordings" },
      ];
    }
    if (session.role === "manager") {
      return [
        { href: "/dashboard/manager", label: "Manager Home" },
        { href: "/dashboard/calendar", label: "Calendar" },
        { href: "/dashboard/recordings", label: "Recordings" },
        { href: "/dashboard/admin/sessions", label: "Sessions" },
        { href: "/dashboard/admin/users", label: "Users" },
        { href: "/dashboard/admin/verifications", label: "Verifications" },
        { href: "/dashboard/admin/disputes", label: "Disputes" },
        { href: "/dashboard/admin/analytics", label: "Analytics" },
      ];
    }
    return [
      { href: "/dashboard/admin", label: "Admin Home" },
      { href: "/dashboard/calendar", label: "Calendar" },
      { href: "/dashboard/recordings", label: "Recordings" },
      { href: "/dashboard/admin/sessions", label: "Sessions" },
      { href: "/dashboard/admin/verifications", label: "Verifications" },
      { href: "/dashboard/admin/users", label: "Users" },
      { href: "/dashboard/admin/disputes", label: "Disputes" },
      { href: "/dashboard/admin/analytics", label: "Analytics" },
    ];
  })();

  return (
    <section className="space-y-6">
      <header className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-r from-white to-slate-50 p-6 shadow-sm">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-teal-100/60 blur-2xl" />
        <p className="inline-flex app-chip px-3 py-1 text-xs font-semibold uppercase tracking-wider">{workspaceLabel} workspace</p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-600">Signed in as {session.email}</p>
        <nav className="mt-5 flex flex-wrap gap-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-teal-200 hover:text-teal-700"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </header>
      {children}
    </section>
  );
}
