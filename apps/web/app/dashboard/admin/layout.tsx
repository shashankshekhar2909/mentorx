"use client";

import { ReactNode } from "react";

import { DashboardShell } from "@/components/dashboard-shell";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardShell role={["admin", "manager"]} title="Operations Console">
      <div>{children}</div>
    </DashboardShell>
  );
}
