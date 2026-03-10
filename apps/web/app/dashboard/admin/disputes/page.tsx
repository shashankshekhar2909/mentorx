"use client";

import { useEffect, useState } from "react";

import { authedFetch, parseJsonSafe } from "@/lib/api";

type Dispute = {
  id: string;
  session_id: string;
  status: string;
  reason: string;
};

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);

  async function refresh() {
    const resp = await authedFetch("/admin/disputes");
    const rows = await parseJsonSafe(resp);
    setDisputes(Array.isArray(rows) ? rows : []);
  }

  async function resolve(id: string) {
    await authedFetch(`/admin/disputes/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "resolved", admin_note: "Resolved from admin disputes page" }),
    });
    await refresh();
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <section className="rounded-xl bg-card p-5 shadow-sm">
      <h2 className="text-lg font-semibold">Disputes</h2>
      <div className="mt-3 space-y-2">
        {disputes.map((row) => (
          <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
            <div>
              <div className="font-medium">Session {row.session_id}</div>
              <div className="text-black/70">{row.reason}</div>
              <div className="text-black/70">Status: {row.status}</div>
            </div>
            <button className="rounded bg-accent px-3 py-1.5 text-white" onClick={() => resolve(row.id)}>Resolve</button>
          </div>
        ))}
        {disputes.length === 0 && <p className="text-sm text-black/60">No disputes raised.</p>}
      </div>
    </section>
  );
}
