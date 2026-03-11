"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { DashboardShell } from "@/components/dashboard-shell";
import { authedFetch, parseJsonSafe } from "@/lib/api";

type StudentRow = {
  student_id: string;
  student_email: string;
  subject: string;
  connection_status: string;
  connection_thread_id: string;
  upcoming_session_id: string | null;
  upcoming_session_starts_at: string | null;
};

export default function MentorStudentsPage() {
  const [rows, setRows] = useState<StudentRow[]>([]);

  useEffect(() => {
    async function load() {
      const resp = await authedFetch("/mentors/me/students");
      const data = await parseJsonSafe(resp);
      setRows(Array.isArray(data) ? (data as StudentRow[]) : []);
    }
    void load();
  }, []);

  return (
    <DashboardShell role="mentor" title="My Students">
      <section className="space-y-4">
        <article className="app-card p-5">
          <h2 className="text-lg font-semibold">Connected Students</h2>
          <p className="mt-1 text-sm text-slate-600">Review active and pending student connections, then continue chat or jump into the next call.</p>
        </article>

        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((row) => (
            <article key={row.connection_thread_id} className="app-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{row.student_email}</h3>
                  <p className="mt-1 text-sm text-slate-600">Subject: {row.subject}</p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${row.connection_status === "active" ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-amber-300 bg-amber-50 text-amber-800"}`}>
                  {row.connection_status}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/dashboard/mentor/chats?thread=${row.connection_thread_id}`}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700"
                >
                  Open Chat
                </Link>
                {row.upcoming_session_id && (
                  <Link
                    href={`/dashboard/sessions/${row.upcoming_session_id}`}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white"
                  >
                    Open Call
                  </Link>
                )}
              </div>

              {row.upcoming_session_starts_at && (
                <p className="mt-3 text-xs text-slate-500">Next session: {new Date(row.upcoming_session_starts_at).toLocaleString()}</p>
              )}
            </article>
          ))}
          {rows.length === 0 && <p className="text-sm text-slate-500">No students connected yet.</p>}
        </div>
      </section>
    </DashboardShell>
  );
}
