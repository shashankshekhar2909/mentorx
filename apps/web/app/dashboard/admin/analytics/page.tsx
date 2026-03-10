"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { authedFetch, parseJsonSafe } from "@/lib/api";

type SessionRow = {
  id: string;
  status: string;
  title: string;
  starts_at?: string;
};

export default function AdminAnalyticsPage() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);

  useEffect(() => {
    authedFetch("/admin/sessions")
      .then((r) => parseJsonSafe(r))
      .then((data) => setSessions(Array.isArray(data) ? data : []))
      .catch(() => setSessions([]));
  }, []);

  const totals = sessions.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <section className="rounded-xl bg-card p-5 shadow-sm">
      <h2 className="text-lg font-semibold">Session Analytics Snapshot</h2>
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        {Object.entries(totals).map(([status, count]) => (
          <div key={status} className="rounded border px-3 py-2">{status}: {count}</div>
        ))}
        {Object.keys(totals).length === 0 && <p className="text-black/60">No sessions yet.</p>}
      </div>
      <div className="mt-4 space-y-2 text-sm">
        {sessions.map((row) => (
          <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2">
            <div>
              <div className="font-medium">{row.title}</div>
              <div className="text-black/70">{row.status}</div>
            </div>
            <Link className="rounded bg-accent px-3 py-1 text-white" href={`/dashboard/sessions/${row.id}`}>
              Jump Into Call Hub
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
