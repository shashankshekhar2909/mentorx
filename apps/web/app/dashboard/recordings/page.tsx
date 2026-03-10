"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { DashboardShell } from "@/components/dashboard-shell";
import { authedFetch, parseJsonSafe } from "@/lib/api";
import type { Role } from "@/lib/types";

type SessionRow = {
  id: string;
  title: string;
  status: string;
  starts_at: string;
  duration_minutes: number;
  mentor_id: string;
  student_id: string;
};

type RecordingRow = {
  session_id: string;
  title: string;
  starts_at: string;
  status: string;
  duration_minutes: number;
  playback_url: string;
};

function statusLabel(status: string): string {
  return status.replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

export default function RecordingsPage() {
  const [rows, setRows] = useState<RecordingRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [dateFrom, dateTo] = useMemo(() => {
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1, 0, 0, 0));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 0, 23, 59, 59));
    return [start.toISOString(), end.toISOString()];
  }, []);

  async function refresh() {
    setLoading(true);
    try {
      const sessionsResp = await authedFetch(
        `/sessions/calendar/list?date_from=${encodeURIComponent(dateFrom)}&date_to=${encodeURIComponent(dateTo)}`,
      );
      const sessionsData = await parseJsonSafe(sessionsResp);
      const sessions = (Array.isArray(sessionsData) ? sessionsData : []) as SessionRow[];

      const recordings = (
        await Promise.all(
          sessions.map(async (item) => {
            const recResp = await authedFetch(`/sessions/${item.id}/recording`);
            if (!recResp.ok) return null;
            const rec = await parseJsonSafe(recResp);
            if (!rec?.playback_url) return null;
            return {
              session_id: item.id,
              title: item.title || `Session ${item.id.slice(0, 8)}`,
              starts_at: item.starts_at,
              status: String(rec.status ?? "uploaded"),
              duration_minutes: item.duration_minutes ?? 60,
              playback_url: String(rec.playback_url),
            } as RecordingRow;
          }),
        )
      ).filter(Boolean) as RecordingRow[];

      recordings.sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());
      setRows(recordings);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <DashboardShell role={["student", "mentor", "manager", "admin"] as Role[]} title="Recordings">
      <article className="app-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Session Recordings</h2>
          <button type="button" className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold" onClick={() => void refresh()}>
            Refresh
          </button>
        </div>
        <p className="mt-1 text-sm text-slate-600">
          Recording ready notifications can be opened from here anytime.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {rows.map((item) => (
            <article key={item.session_id} className="rounded-xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{item.title}</p>
                  <p className="text-xs text-slate-500">{new Date(item.starts_at).toLocaleString()}</p>
                </div>
                <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
                  {statusLabel(item.status)}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-500">{item.duration_minutes} min</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  className="inline-flex rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white"
                  href={item.playback_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Play Recording
                </a>
                <Link
                  href={`/dashboard/sessions/${item.session_id}`}
                  className="inline-flex rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                >
                  Open Session Hub
                </Link>
              </div>
            </article>
          ))}
          {!loading && rows.length === 0 && <p className="text-sm text-slate-500">No recordings available yet.</p>}
          {loading && <p className="text-sm text-slate-500">Loading recordings...</p>}
        </div>
      </article>
    </DashboardShell>
  );
}
