"use client";

import { useEffect, useState } from "react";

import { authedFetch, parseJsonSafe } from "@/lib/api";

type Overview = {
  total_users: number;
  total_sessions: number;
  pending_mentor_verifications: number;
  paid_payments: number;
};

export default function AdminOverviewPage() {
  const [overview, setOverview] = useState<Overview | null>(null);

  useEffect(() => {
    authedFetch("/admin/overview")
      .then((r) => parseJsonSafe(r))
      .then((data) => setOverview(data?.total_users !== undefined ? data : null))
      .catch(() => setOverview(null));
  }, []);

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <article className="rounded-xl bg-card p-4 shadow-sm"><p className="text-sm text-black/60">Users</p><p className="text-2xl font-bold">{overview?.total_users ?? "-"}</p></article>
      <article className="rounded-xl bg-card p-4 shadow-sm"><p className="text-sm text-black/60">Sessions</p><p className="text-2xl font-bold">{overview?.total_sessions ?? "-"}</p></article>
      <article className="rounded-xl bg-card p-4 shadow-sm"><p className="text-sm text-black/60">Pending Verifications</p><p className="text-2xl font-bold">{overview?.pending_mentor_verifications ?? "-"}</p></article>
      <article className="rounded-xl bg-card p-4 shadow-sm"><p className="text-sm text-black/60">Paid Payments</p><p className="text-2xl font-bold">{overview?.paid_payments ?? "-"}</p></article>
    </div>
  );
}
