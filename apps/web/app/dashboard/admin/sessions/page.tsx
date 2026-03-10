"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { authedFetch, parseJsonSafe } from "@/lib/api";

type SessionRow = {
  id: string;
  student_id: string;
  mentor_id: string;
  title: string;
  status: string;
  starts_at: string;
};

export default function AdminSessionsPage() {
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    authedFetch("/admin/sessions")
      .then((r) => parseJsonSafe(r))
      .then((data) => {
        setRows(Array.isArray(data) ? data : []);
        if (!Array.isArray(data)) setMessage(data?.detail ?? "Unable to load sessions");
      })
      .catch(() => setMessage("Unable to load sessions"));
  }, []);

  return (
    <section className="space-y-4">
      <header className="rounded-xl bg-card p-4 shadow-sm">
        <h1 className="text-xl font-semibold">All Calls & Chats</h1>
        <p className="text-sm text-black/70">Admin and manager can open any session hub to review chat and join live call.</p>
      </header>

      {message && <p className="text-sm text-red-600">{message}</p>}

      <div className="grid gap-3">
        {rows.map((row) => (
          <article key={row.id} className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{row.title}</p>
                <p className="text-xs text-black/60">Session ID: {row.id}</p>
              </div>
              <span className="rounded border px-2 py-1 text-xs">{row.status}</span>
            </div>
            <p className="mt-2 text-sm text-black/70">Starts: {new Date(row.starts_at).toLocaleString()}</p>
            <p className="text-xs text-black/60">Student: {row.student_id}</p>
            <p className="text-xs text-black/60">Mentor: {row.mentor_id}</p>
            <div className="mt-3 flex gap-2">
              <Link href={`/dashboard/sessions/${row.id}`} className="rounded bg-accent px-3 py-1.5 text-sm text-white">
                Open Call Hub
              </Link>
            </div>
          </article>
        ))}
        {rows.length === 0 && <p className="text-sm text-black/60">No sessions found.</p>}
      </div>
    </section>
  );
}
