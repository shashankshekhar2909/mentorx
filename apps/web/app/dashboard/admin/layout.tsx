"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

import { DashboardShell } from "@/components/dashboard-shell";

const links = [
  { href: "/dashboard/admin", label: "Overview" },
  { href: "/dashboard/admin/sessions", label: "Sessions" },
  { href: "/dashboard/admin/verifications", label: "Verifications" },
  { href: "/dashboard/admin/users", label: "Users" },
  { href: "/dashboard/admin/categories", label: "Categories" },
  { href: "/dashboard/admin/disputes", label: "Disputes" },
  { href: "/dashboard/admin/analytics", label: "Analytics" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <DashboardShell role={["admin", "manager"]} title="Admin Workspace">
      <nav className="flex flex-wrap gap-2">
        {links.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-md px-3 py-1.5 text-sm ${active ? "bg-accent text-white" : "border bg-white"}`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
      <div className="pt-2">{children}</div>
    </DashboardShell>
  );
}
