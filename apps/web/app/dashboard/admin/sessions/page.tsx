"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { authedFetch, parseJsonSafe } from "@/lib/api";
import { formatIstDateTime, formatSessionStatus, sessionStatusClasses, sessionStatusIcon } from "@/lib/presentation";

type SessionRow = {
  id: string;
  student_id: string;
  mentor_id: string;
  student_name: string;
  mentor_name: string;
  student_email: string;
  mentor_email: string;
  title: string;
  status: string;
  starts_at: string;
};

type RecordingState = {
  session_id: string;
  status: string;
  playback_url: string | null;
  visible_to_student?: boolean;
};

type PaginatedSessions = {
  items: SessionRow[];
  page: number;
  page_size: number;
  total: number;
};

type PaginatedRecordings = {
  items: Array<{
    session_id: string;
    status: string;
    playback_url: string | null;
    visible_to_student?: boolean;
  }>;
  page: number;
  page_size: number;
  total: number;
};

export default function AdminSessionsPage() {
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [recordings, setRecordings] = useState<Record<string, RecordingState>>({});
  const [message, setMessage] = useState("");
  const [studentFilter, setStudentFilter] = useState("all");
  const [mentorFilter, setMentorFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [total, setTotal] = useState(0);

  async function refresh() {
    const query = new URLSearchParams({
      page: String(page),
      page_size: String(pageSize),
    });
    if (studentFilter !== "all") query.set("student_id", studentFilter);
    if (mentorFilter !== "all") query.set("mentor_id", mentorFilter);
    if (statusFilter !== "all") query.set("status", statusFilter);

    Promise.all([
      authedFetch(`/admin/sessions/paginated?${query.toString()}`),
      authedFetch(`/admin/recordings?${query.toString()}`),
    ])
      .then(async ([sessionResp, recordingResp]) => {
        const [sessionData, recordingData] = await Promise.all([parseJsonSafe(sessionResp), parseJsonSafe(recordingResp)]);
        if (!sessionResp.ok) {
          setMessage(sessionData?.detail ?? "Unable to load sessions");
          setRows([]);
          setRecordings({});
          return;
        }
        const paginatedSessions = sessionData as PaginatedSessions;
        setRows(paginatedSessions.items ?? []);
        setTotal(Number(paginatedSessions.total ?? 0));
        setMessage("");

        if (!recordingResp.ok) {
          setRecordings({});
          return;
        }
        const paginatedRecordings = recordingData as PaginatedRecordings;
        setRecordings(
          Object.fromEntries(
            (paginatedRecordings.items ?? []).map((row) => [
              row.session_id,
              {
                session_id: row.session_id,
                status: String(row.status),
                playback_url: row.playback_url ? String(row.playback_url) : null,
                visible_to_student: row.visible_to_student,
              } satisfies RecordingState,
            ]),
          ),
        );
      })
      .catch(() => setMessage("Unable to load sessions"));
  }

  useEffect(() => {
    void refresh();
  }, [page, studentFilter, mentorFilter, statusFilter]);

  const studentOptions = useMemo(
    () => Array.from(new Map(rows.map((row) => [row.student_id, { id: row.student_id, label: row.student_name }])).values()),
    [rows],
  );
  const mentorOptions = useMemo(
    () => Array.from(new Map(rows.map((row) => [row.mentor_id, { id: row.mentor_id, label: row.mentor_name }])).values()),
    [rows],
  );
  const filteredRows = useMemo(() => rows, [rows]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pagedRows = filteredRows;

  async function toggleStudentVisibility(sessionId: string, nextVisible: boolean) {
    const resp = await authedFetch(`/sessions/${sessionId}/recording-visibility`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visible_to_student: nextVisible }),
    });
    if (resp.ok) {
      setRecordings((current) => ({
        ...current,
        [sessionId]: { ...(current[sessionId] ?? { session_id: sessionId, status: "unknown", playback_url: null }), visible_to_student: nextVisible },
      }));
    }
  }

  async function deleteRecording(sessionId: string) {
    if (!window.confirm("Delete this recording?")) return;
    const resp = await authedFetch(`/sessions/${sessionId}/recording`, { method: "DELETE" });
    if (resp.ok) {
      setRecordings((current) => ({
        ...current,
        [sessionId]: { ...(current[sessionId] ?? { session_id: sessionId, status: "unknown", playback_url: null }), status: "deleted", playback_url: null },
      }));
    }
  }

  useEffect(() => {
    setPage(1);
  }, [studentFilter, mentorFilter, statusFilter]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <section className="space-y-4">
      <header className="rounded-xl bg-card p-4 shadow-sm">
        <h1 className="text-xl font-semibold">Call Review Console</h1>
        <p className="text-sm text-black/70">Select a student and mentor pair to review meetings, recordings, and live support sessions.</p>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm" value={studentFilter} onChange={(e) => setStudentFilter(e.target.value)}>
            <option value="all">All students</option>
            {studentOptions.map((row) => (
              <option key={row.id} value={row.id}>{row.label}</option>
            ))}
          </select>
          <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm" value={mentorFilter} onChange={(e) => setMentorFilter(e.target.value)}>
            <option value="all">All mentors</option>
            {mentorOptions.map((row) => (
              <option key={row.id} value={row.id}>{row.label}</option>
            ))}
          </select>
          <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All call statuses</option>
            <option value="ready_to_join">Ready to Join</option>
            <option value="in_progress">Live Now</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </header>

      {message && <p className="text-sm text-red-600">{message}</p>}

      <div className="grid gap-3">
        {pagedRows.map((row) => (
          <article key={row.id} className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{row.title}</p>
                <p className="text-xs text-black/60">Session ID: {row.id}</p>
              </div>
              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold ${sessionStatusClasses(row.status)}`}>
                <i className={sessionStatusIcon(row.status)} />
                {formatSessionStatus(row.status)}
              </span>
            </div>
            <p className="mt-2 text-sm text-black/70">Starts: {formatIstDateTime(row.starts_at)}</p>
            <div className="mt-3 grid gap-2 text-xs md:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-slate-500">Student</p>
                <p className="font-semibold text-slate-900">{row.student_name}</p>
                <p className="text-slate-500">{row.student_email}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-slate-500">Mentor</p>
                <p className="font-semibold text-slate-900">{row.mentor_name}</p>
                <p className="text-slate-500">{row.mentor_email}</p>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <Link href={`/dashboard/sessions/${row.id}`} className="rounded bg-accent px-3 py-1.5 text-sm text-white">
                Open Meeting Review
              </Link>
            </div>
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">Recording Moderation</p>
                  <p className="text-xs text-slate-500">
                    Status: {recordings[row.id]?.status ? formatSessionStatus(recordings[row.id].status) : "Not available yet"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="rounded border px-3 py-1.5 text-xs"
                    onClick={() => void toggleStudentVisibility(row.id, !(recordings[row.id]?.visible_to_student ?? true))}
                  >
                    {recordings[row.id]?.visible_to_student === false ? "Unhide for Student" : "Hide from Student"}
                  </button>
                  <button className="rounded border border-rose-300 px-3 py-1.5 text-xs text-rose-700" onClick={() => void deleteRecording(row.id)}>
                    Delete Recording
                  </button>
                </div>
              </div>
            </div>
          </article>
        ))}
        {pagedRows.length === 0 && <p className="text-sm text-black/60">No sessions match the selected filters.</p>}
      </div>
      <div className="flex items-center justify-between rounded-xl bg-card p-4 shadow-sm">
        <p className="text-sm text-slate-600">Page {page} of {totalPages}</p>
        <div className="flex gap-2">
          <button className="rounded border px-3 py-1.5 text-sm disabled:opacity-50" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button>
          <button className="rounded border px-3 py-1.5 text-sm disabled:opacity-50" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>Next</button>
        </div>
      </div>
    </section>
  );
}
