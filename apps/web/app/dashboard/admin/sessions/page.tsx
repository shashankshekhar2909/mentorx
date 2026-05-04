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
  duration_minutes: number;
  actual_duration_seconds?: number;
  is_instant: boolean;
};

type RecordingState = {
  id: string;
  session_id: string;
  status: string;
  playback_url: string | null;
  visible_to_student?: boolean;
};

type RecordingApiRow = {
  id: string | number;
  session_id: string | number;
  status: string;
  playback_url?: string | null;
  visible_to_student?: boolean;
};

type StudentGroup = {
  student_id: string;
  student_name: string;
  student_email: string;
  sessions: SessionRow[];
};

function formatDurationLabel(session: SessionRow): string {
  const totalSeconds = Number(session.actual_duration_seconds ?? 0);
  if (totalSeconds > 0) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes <= 0) return `${seconds}s actual`;
    if (seconds === 0) return `${minutes}m actual`;
    return `${minutes}m ${seconds}s actual`;
  }
  return `${session.duration_minutes} min planned`;
}

export default function AdminSessionsPage() {
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [recordings, setRecordings] = useState<Record<string, RecordingState>>({});
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [studentFilter, setStudentFilter] = useState("all");
  const [mentorFilter, setMentorFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [busyKey, setBusyKey] = useState<string | null>(null);

  async function refresh() {
    const [sessionResp, recordingResp] = await Promise.all([
      authedFetch("/admin/sessions"),
      authedFetch("/admin/recordings?page=1&page_size=500"),
    ]);
    const [sessionData, recordingData] = await Promise.all([parseJsonSafe(sessionResp), parseJsonSafe(recordingResp)]);
    if (!sessionResp.ok) {
      setMessage(sessionData?.detail ?? "Unable to load call management workspace");
      setRows([]);
      setRecordings({});
      return;
    }
    const sessionRows = Array.isArray(sessionData) ? (sessionData as SessionRow[]) : [];
    setRows(sessionRows);
    setMessage("");

    if (!recordingResp.ok) {
      setRecordings({});
      return;
    }
    const recordingItems: RecordingApiRow[] = Array.isArray(recordingData?.items) ? (recordingData.items as RecordingApiRow[]) : [];
    setRecordings(
      Object.fromEntries(
        recordingItems.map((row) => [
          String(row.session_id),
          {
            id: String(row.id),
            session_id: String(row.session_id),
            status: String(row.status),
            playback_url: row.playback_url ? String(row.playback_url) : null,
            visible_to_student: row.visible_to_student !== false,
          } satisfies RecordingState,
        ]),
      ),
    );
  }

  useEffect(() => {
    void refresh();
  }, []);

  const studentOptions = useMemo(
    () => Array.from(new Map(rows.map((row) => [row.student_id, { id: row.student_id, label: row.student_name }])).values()),
    [rows],
  );
  const mentorOptions = useMemo(
    () => Array.from(new Map(rows.map((row) => [row.mentor_id, { id: row.mentor_id, label: row.mentor_name }])).values()),
    [rows],
  );

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (studentFilter !== "all" && row.student_id !== studentFilter) return false;
      if (mentorFilter !== "all" && row.mentor_id !== mentorFilter) return false;
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (typeFilter === "instant" && !row.is_instant) return false;
      if (typeFilter === "scheduled" && row.is_instant) return false;
      if (!needle) return true;
      return [
        row.student_name,
        row.student_email,
        row.mentor_name,
        row.mentor_email,
        row.title,
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [mentorFilter, rows, search, statusFilter, studentFilter, typeFilter]);

  const studentGroups = useMemo<StudentGroup[]>(() => {
    const grouped = new Map<string, StudentGroup>();
    for (const row of filteredRows) {
      const existing = grouped.get(row.student_id);
      if (existing) {
        existing.sessions.push(row);
        continue;
      }
      grouped.set(row.student_id, {
        student_id: row.student_id,
        student_name: row.student_name,
        student_email: row.student_email,
        sessions: [row],
      });
    }
    return Array.from(grouped.values()).sort((a, b) => a.student_name.localeCompare(b.student_name));
  }, [filteredRows]);

  async function toggleStudentVisibility(sessionId: string, nextVisible: boolean) {
    setBusyKey(`visibility-${sessionId}`);
    const resp = await authedFetch(`/sessions/${sessionId}/recording-visibility`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visible_to_student: nextVisible }),
    });
    setBusyKey(null);
    if (!resp.ok) return;
    setRecordings((current) => ({
      ...current,
      [sessionId]: { ...(current[sessionId] ?? { id: sessionId, session_id: sessionId, status: "unknown", playback_url: null }), visible_to_student: nextVisible },
    }));
  }

  async function deleteRecording(sessionId: string) {
    if (!window.confirm("Delete this recording?")) return;
    setBusyKey(`delete-${sessionId}`);
    const resp = await authedFetch(`/sessions/${sessionId}/recording`, { method: "DELETE" });
    setBusyKey(null);
    if (!resp.ok) return;
    setRecordings((current) => ({
      ...current,
      [sessionId]: { ...(current[sessionId] ?? { id: sessionId, session_id: sessionId, status: "unknown", playback_url: null }), status: "deleted", playback_url: null },
    }));
  }

  async function bulkModerate(studentId: string, action: "hide" | "unhide" | "delete") {
    const confirmed = window.confirm(
      action === "delete"
        ? "Delete all recordings for this filtered student group?"
        : `${action === "hide" ? "Hide" : "Unhide"} all recordings for this filtered student group?`,
    );
    if (!confirmed) return;
    setBusyKey(`${action}-${studentId}`);
    const query = new URLSearchParams({ action });
    if (mentorFilter !== "all") query.set("mentor_id", mentorFilter);
    if (statusFilter !== "all") query.set("status", statusFilter);
    const resp = await authedFetch(`/admin/students/${studentId}/recordings/moderate?${query.toString()}`, { method: "POST" });
    const data = await parseJsonSafe(resp);
    setBusyKey(null);
    setMessage(resp.ok ? `${action} applied to ${data?.processed_sessions ?? 0} sessions.` : (data?.detail ?? "Bulk action failed"));
    await refresh();
  }

  const totalSessions = filteredRows.length;
  const totalStudents = studentGroups.length;
  const visibleToStudentCount = filteredRows.filter((row) => recordings[row.id]?.visible_to_student !== false).length;
  const hiddenFromStudentCount = filteredRows.filter((row) => recordings[row.id]?.visible_to_student === false).length;

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-950">Call Management Grid</h1>
            <p className="mt-1 text-sm text-slate-600">
              Group calls by student, review mentor pairings, and bulk hide or delete recordings for a specific student.
            </p>
          </div>
          <button type="button" className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700" onClick={() => void refresh()}>
            Refresh
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Students</p>
            <p className="mt-2 text-3xl font-extrabold text-slate-900">{totalStudents}</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Calls</p>
            <p className="mt-2 text-3xl font-extrabold text-slate-900">{totalSessions}</p>
          </article>
          <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Visible</p>
            <p className="mt-2 text-3xl font-extrabold text-emerald-900">{visibleToStudentCount}</p>
          </article>
          <article className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Hidden</p>
            <p className="mt-2 text-3xl font-extrabold text-amber-900">{hiddenFromStudentCount}</p>
          </article>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <input
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            placeholder="Search student, mentor, title"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select className="rounded-xl border border-slate-300 px-3 py-2 text-sm" value={studentFilter} onChange={(event) => setStudentFilter(event.target.value)}>
            <option value="all">All students</option>
            {studentOptions.map((row) => (
              <option key={row.id} value={row.id}>{row.label}</option>
            ))}
          </select>
          <select className="rounded-xl border border-slate-300 px-3 py-2 text-sm" value={mentorFilter} onChange={(event) => setMentorFilter(event.target.value)}>
            <option value="all">All mentors</option>
            {mentorOptions.map((row) => (
              <option key={row.id} value={row.id}>{row.label}</option>
            ))}
          </select>
          <select className="rounded-xl border border-slate-300 px-3 py-2 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">All statuses</option>
            <option value="pending_mentor_approval">Pending Mentor Approval</option>
            <option value="confirmed">Confirmed</option>
            <option value="ready_to_join">Ready to Join</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select className="rounded-xl border border-slate-300 px-3 py-2 text-sm" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="all">All call types</option>
            <option value="instant">Instant Calls</option>
            <option value="scheduled">Scheduled Calls</option>
          </select>
        </div>
      </header>

      {message && <p className="text-sm text-slate-700">{message}</p>}

      <div className="grid gap-4 xl:grid-cols-2">
        {studentGroups.map((group) => (
          <article key={group.student_id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-slate-950">{group.student_name}</p>
                <p className="text-sm text-slate-500">{group.student_email}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {group.sessions.length} filtered calls
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800"
                  onClick={() => void bulkModerate(group.student_id, "hide")}
                  disabled={busyKey === `hide-${group.student_id}`}
                >
                  Hide All
                </button>
                <button
                  type="button"
                  className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800"
                  onClick={() => void bulkModerate(group.student_id, "unhide")}
                  disabled={busyKey === `unhide-${group.student_id}`}
                >
                  Unhide All
                </button>
                <button
                  type="button"
                  className="rounded-full border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700"
                  onClick={() => void bulkModerate(group.student_id, "delete")}
                  disabled={busyKey === `delete-${group.student_id}`}
                >
                  Delete All Recordings
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              {group.sessions.map((row) => {
                const recording = recordings[row.id];
                const isHidden = recording?.visible_to_student === false;
                return (
                  <div key={row.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{row.title}</p>
                        <p className="mt-1 text-xs text-slate-500">{formatIstDateTime(row.starts_at)}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Mentor: <span className="font-semibold text-slate-700">{row.mentor_name}</span>
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold ${sessionStatusClasses(row.status)}`}>
                          <i className={sessionStatusIcon(row.status)} />
                          {formatSessionStatus(row.status)}
                        </span>
                        <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold ${row.is_instant ? "border-sky-200 bg-sky-50 text-sky-800" : "border-slate-200 bg-white text-slate-700"}`}>
                          {row.is_instant ? "Instant" : "Scheduled"}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 md:grid-cols-3">
                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Duration</p>
                        <p className="mt-1 font-semibold text-slate-900">{formatDurationLabel(row)}</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Recording</p>
                        <p className="mt-1 font-semibold text-slate-900">{recording?.status ? formatSessionStatus(recording.status) : "Not available yet"}</p>
                      </div>
                      <div className={`rounded-xl border px-3 py-2 text-sm ${isHidden ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
                        <p className="text-xs uppercase tracking-[0.16em]">Student Access</p>
                        <p className="mt-1 font-semibold">{isHidden ? "Hidden from student" : "Visible to student"}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link href={`/dashboard/sessions/${row.id}`} className="rounded-xl bg-accent px-3 py-1.5 text-sm font-semibold text-white">
                        Open Review
                      </Link>
                      <button
                        type="button"
                        className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700"
                        onClick={() => void toggleStudentVisibility(row.id, !(recording?.visible_to_student ?? true))}
                        disabled={busyKey === `visibility-${row.id}`}
                      >
                        {isHidden ? "Unhide for Student" : "Hide from Student"}
                      </button>
                      <button
                        type="button"
                        className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-1.5 text-sm font-semibold text-rose-700"
                        onClick={() => void deleteRecording(row.id)}
                        disabled={busyKey === `delete-${row.id}`}
                      >
                        Delete Recording
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
        ))}
        {studentGroups.length === 0 && <p className="text-sm text-slate-500">No calls match the selected filters.</p>}
      </div>
    </section>
  );
}
