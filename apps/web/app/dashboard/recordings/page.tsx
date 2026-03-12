"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { DashboardShell } from "@/components/dashboard-shell";
import { authedFetch, parseJsonSafe } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { formatIstDateTime } from "@/lib/presentation";
import type { Role } from "@/lib/types";

type SessionRow = {
  id: string;
  title: string;
  status: string;
  starts_at: string;
  duration_minutes: number;
  actual_started_at?: string | null;
  actual_ended_at?: string | null;
  actual_duration_seconds?: number;
  call_overlap_started_at?: string | null;
  mentor_id: string;
  student_id: string;
};

type RecordingRow = {
  id: string;
  session_id: string;
  attempt_number: number;
  title: string;
  starts_at: string;
  status: string;
  duration_minutes: number;
  playback_url: string | null;
  created_at?: string;
  error_message?: string | null;
  actual_duration_label?: string | null;
};

type RecordingRowView = RecordingRow & {
  superseded: boolean;
};

function statusLabel(status: string): string {
  if (status === "recording") return "Processing Recording";
  if (status === "queued") return "Preparing Recording";
  if (status === "uploaded") return "Ready to Watch";
  if (status === "failed") return "Recording Failed";
  return status.replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function formatDurationFromSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) return `${seconds}s`;
  if (seconds === 0) return `${minutes} min`;
  return `${minutes}m ${seconds}s`;
}

function actualDurationLabel(session: SessionRow): string | null {
  let totalSeconds = Number(session.actual_duration_seconds ?? 0);
  if (session.call_overlap_started_at) {
    const overlapStart = new Date(session.call_overlap_started_at).getTime();
    if (Number.isFinite(overlapStart)) {
      totalSeconds += Math.max(1, Math.round((Date.now() - overlapStart) / 1000));
    }
  }
  if (totalSeconds <= 0) return null;
  return formatDurationFromSeconds(totalSeconds);
}

export default function RecordingsPage() {
  const role = useAuthStore((s) => s.session?.role);
  const [rows, setRows] = useState<RecordingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [dateFrom, dateTo] = useMemo(() => {
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1, 0, 0, 0));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 0, 23, 59, 59));
    return [start.toISOString(), end.toISOString()];
  }, []);

  const visibleRows = useMemo<RecordingRowView[]>(() => {
    const latestByObjectKey = new Map<string, number>();
    for (const row of rows) {
      if (!row.playback_url) continue;
      const current = latestByObjectKey.get(row.playback_url) ?? 0;
      latestByObjectKey.set(row.playback_url, Math.max(current, row.attempt_number ?? 0));
    }
    return rows.map((row) => ({
      ...row,
      superseded:
        Boolean(row.playback_url) &&
        (latestByObjectKey.get(row.playback_url as string) ?? row.attempt_number) > row.attempt_number,
    }));
  }, [rows]);

  async function refresh() {
    setLoading(true);
    setMessage("");
    try {
      const sessionsResp = await authedFetch(
        `/sessions/calendar/list?date_from=${encodeURIComponent(dateFrom)}&date_to=${encodeURIComponent(dateTo)}`,
      );
      const sessionsData = await parseJsonSafe(sessionsResp);
      const sessions = (Array.isArray(sessionsData) ? sessionsData : []) as SessionRow[];

      const recordings = (
        await Promise.all(
          sessions.map(async (item) => {
            const durationLabel = actualDurationLabel(item);
            const recResp = await authedFetch(`/sessions/${item.id}/recordings`);
            if (recResp.status === 404 && ["ready_to_join", "in_progress", "completed"].includes(item.status)) {
              return [
                {
                  id: `${item.id}-pending`,
                  session_id: item.id,
                  attempt_number: 0,
                  title: item.title || `Session ${item.id.slice(0, 8)}`,
                  starts_at: item.starts_at,
                  status: item.status === "completed" ? "queued" : "recording",
                  duration_minutes: item.duration_minutes ?? 60,
                  actual_duration_label: durationLabel,
                  playback_url: null,
                  created_at: item.starts_at,
                  error_message: null,
                } satisfies RecordingRow,
              ];
            }
            if (!recResp.ok) return [] as RecordingRow[];
            const rec = await parseJsonSafe(recResp);
            const attempts = Array.isArray(rec) ? rec : [];
            if (attempts.length === 0 && ["ready_to_join", "in_progress", "completed"].includes(item.status)) {
              return [
                {
                  id: `${item.id}-pending`,
                  session_id: item.id,
                  attempt_number: 0,
                  title: item.title || `Session ${item.id.slice(0, 8)}`,
                  starts_at: item.starts_at,
                  status: item.status === "completed" ? "queued" : "recording",
                  duration_minutes: item.duration_minutes ?? 60,
                  actual_duration_label: durationLabel,
                  playback_url: null,
                  created_at: item.starts_at,
                  error_message: null,
                } satisfies RecordingRow,
              ];
            }
            return attempts.map(
              (attempt) =>
                ({
                  id: String(attempt.id),
                  session_id: item.id,
                  attempt_number: Number(attempt.attempt_number ?? 1),
                  title: item.title || `Session ${item.id.slice(0, 8)}`,
                  starts_at: item.starts_at,
                  status: String(attempt.status ?? "uploaded"),
                  duration_minutes: item.duration_minutes ?? 60,
                  actual_duration_label: durationLabel,
                  playback_url: attempt?.playback_url ? String(attempt.playback_url) : null,
                  created_at: attempt?.created_at ? String(attempt.created_at) : item.starts_at,
                  error_message: attempt?.error_message ? String(attempt.error_message) : null,
                }) satisfies RecordingRow,
            );
          }),
        )
      ).flat();

      recordings.sort(
        (a, b) =>
          new Date(b.created_at ?? b.starts_at).getTime() - new Date(a.created_at ?? a.starts_at).getTime(),
      );
      setRows(recordings);
    } catch {
      setMessage("Unable to load recordings right now.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteRecording(sessionId: string) {
    if (role !== "admin" && role !== "manager") return;
    if (!window.confirm("Delete this recording?")) return;
    const resp = await authedFetch(`/sessions/${sessionId}/recording`, { method: "DELETE" });
    const data = await parseJsonSafe(resp);
    if (!resp.ok) {
      setMessage(data?.detail ?? "Unable to delete recording.");
      return;
    }
    setMessage("Recording deleted.");
    await refresh();
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
        {message && <p className="mt-3 text-sm text-slate-600">{message}</p>}

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {visibleRows.map((item) => (
            <article key={item.id} className="rounded-xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{item.title}</p>
                  <p className="text-xs text-slate-500">{formatIstDateTime(item.starts_at)}</p>
                </div>
                <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
                  {statusLabel(item.status)}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-500">
                <span>{item.actual_duration_label ?? `${item.duration_minutes} min planned`}</span>
                <span>Attempt {item.attempt_number || 1}</span>
              </div>
              {item.status === "uploaded" && item.playback_url && !item.superseded ? (
                <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-black">
                  <video
                    src={item.playback_url}
                    controls
                    controlsList="nodownload noplaybackrate"
                    className="h-52 w-full bg-black"
                    preload="metadata"
                    onContextMenu={(e) => e.preventDefault()}
                  />
                </div>
              ) : (
                <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                  <div className="flex items-center gap-2 font-semibold text-slate-800">
                    <i
                      className={`fa-solid ${
                        item.superseded
                          ? "fa-copy text-amber-600"
                          : item.status === "failed"
                            ? "fa-triangle-exclamation text-rose-600"
                            : "fa-gear fa-spin text-accent"
                      }`}
                    />
                    {item.superseded
                      ? "Playback moved to latest session"
                      : item.status === "failed"
                        ? "Recording needs attention"
                        : "Recording is being prepared"}
                  </div>
                  <p className="mt-2">
                    {item.superseded
                      ? "This legacy entry reused the same recording file as a later session, so playback is only available on the latest session."
                      : item.status === "failed"
                      ? item.error_message || "The recording process failed for this call."
                      : "The meeting has ended and the latest recording is still being processed. It will appear here automatically for both student and mentor."}
                  </p>
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={`/dashboard/sessions/${item.session_id}`}
                  className="inline-flex rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                >
                  Open Session Hub
                </Link>
                {(role === "admin" || role === "manager") && (
                  <button
                    type="button"
                    className="inline-flex rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700"
                    onClick={() => void deleteRecording(item.session_id)}
                  >
                    Delete Recording
                  </button>
                )}
              </div>
            </article>
          ))}
          {!loading && visibleRows.length === 0 && <p className="text-sm text-slate-500">No recordings available yet.</p>}
          {loading && <p className="text-sm text-slate-500">Loading recordings...</p>}
        </div>
      </article>
    </DashboardShell>
  );
}
