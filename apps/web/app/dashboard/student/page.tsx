"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { DashboardShell } from "@/components/dashboard-shell";
import { authedFetch, parseJsonSafe } from "@/lib/api";
import { formatIstDateTime } from "@/lib/presentation";

type SessionRow = {
  id: string;
  title: string;
  status: string;
  starts_at: string;
  duration_minutes: number;
  mentor_id: string;
  mentor_name?: string;
};

type StudentRecording = {
  id?: string;
  session_id: string;
  attempt_number?: number;
  title: string;
  starts_at: string;
  status: string;
  playback_url: string | null;
  error_message?: string | null;
};

function statusLabel(status: string): string {
  if (status === "recording") return "Processing Recording";
  if (status === "queued") return "Preparing Recording";
  if (status === "uploaded") return "Ready to Watch";
  return status.replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function statusClass(status: string): string {
  if (status === "ready_to_join" || status === "in_progress") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (status === "pending_mentor_approval" || status === "pending_manager_approval") return "bg-amber-100 text-amber-800 border-amber-200";
  if (status === "pending_payment") return "bg-sky-100 text-sky-800 border-sky-200";
  if (status === "cancelled" || status === "no_show") return "bg-rose-100 text-rose-800 border-rose-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

export default function StudentDashboardPage() {
  const [categories, setCategories] = useState("");
  const [categoryOptions, setCategoryOptions] = useState<Array<{ slug: string; name: string }>>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [notifications, setNotifications] = useState<{ id: string; title: string; message: string }[]>([]);
  const [recordings, setRecordings] = useState<StudentRecording[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()),
    [sessions],
  );
  const categoryList = useMemo(
    () =>
      categories
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    [categories],
  );
  const availableSuggestions = categoryOptions.filter((item) => !categoryList.includes(item.slug));
  const categoryNameMap = useMemo(
    () => Object.fromEntries(categoryOptions.map((item) => [item.slug, item.name])),
    [categoryOptions],
  );
  const nextSession = sortedSessions.find((item) => ["ready_to_join", "in_progress", "confirmed", "pending_payment"].includes(item.status));
  const upcomingCount = sortedSessions.filter((item) => new Date(item.starts_at).getTime() >= Date.now()).length;
  const readyRecordingCount = recordings.filter((item) => item.status === "uploaded" && item.playback_url).length;

  async function refreshAll() {
    const categoryResp = await authedFetch("/categories");
    const categoryRows = await parseJsonSafe(categoryResp);
    setCategoryOptions(
      Array.isArray(categoryRows)
        ? categoryRows.map((row) => ({ slug: String(row.slug), name: String(row.name) }))
        : [],
    );

    const profileResp = await authedFetch("/users/me/profile");
    const profile = await parseJsonSafe(profileResp);
    const profileCategories = profile.target_exams || categories;
    setCategories(profileCategories);

    const [summaryResp, notificationsResp] = await Promise.all([
      authedFetch("/users/me/dashboard-summary?session_limit=8&recording_limit=8"),
      authedFetch("/notifications/mine"),
    ]);
    const [summary, n] = await Promise.all([parseJsonSafe(summaryResp), parseJsonSafe(notificationsResp)]);
    const sessionRows = Array.isArray(summary?.sessions) ? summary.sessions : [];
    setSessions(sessionRows);
    setNotifications(Array.isArray(n) ? n : []);
    const recordingRows = (Array.isArray(summary?.recordings) ? summary.recordings : []) as StudentRecording[];
    setRecordings(recordingRows);
  }

  async function savePreferences() {
    await authedFetch("/users/me/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_exams: categories }),
    });
  }

  function setCategoryList(next: string[]) {
    const unique = Array.from(new Set(next.map((item) => item.trim().toLowerCase()).filter(Boolean)));
    setCategories(unique.join(","));
  }

  function addCategory(value: string) {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return;
    if (categoryList.includes(trimmed)) return;
    setCategoryList([...categoryList, trimmed]);
    setNewCategory("");
  }

  function removeCategory(value: string) {
    setCategoryList(categoryList.filter((item) => item !== value));
  }

  useEffect(() => {
    void refreshAll();
  }, []);

  return (
    <DashboardShell role="student" title="Preparation Overview">
      <div className="grid gap-4 md:grid-cols-3">
        <article className="app-card p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Categories</p>
          <p className="mt-3 text-3xl font-extrabold text-slate-900">{categoryList.length}</p>
          <p className="mt-1 text-sm text-slate-600">Exam tracks selected for mentor matching.</p>
        </article>

        <article className="app-card p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Upcoming Calls</p>
          <p className="mt-3 text-3xl font-extrabold text-slate-900">{upcomingCount}</p>
          <p className="mt-1 text-sm text-slate-600">Sessions waiting in your calendar.</p>
        </article>

        <article className="app-card p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Ready Recordings</p>
          <p className="mt-3 text-3xl font-extrabold text-slate-900">{readyRecordingCount}</p>
          <p className="mt-1 text-sm text-slate-600">Revision-ready class recordings.</p>
        </article>

        <article className="app-card p-5 md:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Next Class</h2>
              <p className="mt-1 text-sm text-slate-600">Your next important session should be one click away.</p>
            </div>
            <Link href="/dashboard/calendar" className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700">
              Open Calendar
            </Link>
          </div>
          {nextSession ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-slate-900">{nextSession.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{formatIstDateTime(nextSession.starts_at)}</p>
                  <p className="mt-2 text-sm text-slate-600">Mentor: {nextSession.mentor_name ?? nextSession.mentor_id}</p>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusClass(nextSession.status)}`}>
                  {statusLabel(nextSession.status)}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={`/dashboard/sessions/${nextSession.id}`} className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white">
                  Open Session
                </Link>
                <Link href="/dashboard/student/chats" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">
                  Open Chats
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
              No class is lined up yet. Start by finding a mentor and sending a connection request.
            </div>
          )}
        </article>

        <article className="app-card p-5">
          <h2 className="text-lg font-semibold">Find Mentors</h2>
          <p className="mt-1 text-sm text-slate-600">Choose a mentor by exam category, connect, then unlock chat and calling.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/dashboard/student/mentors" className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white">
              Explore Mentors
            </Link>
            <Link href="/dashboard/profile" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">
              Edit Profile
            </Link>
          </div>
          {categoryList.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {categoryList.slice(0, 4).map((cat) => (
                <span key={cat} className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800">
                  {cat}
                </span>
              ))}
            </div>
          )}
        </article>

        <article className="app-card p-5 md:col-span-2">
          <div>
            <h2 className="text-lg font-semibold">Study Categories</h2>
            <p className="mt-1 text-sm text-slate-600">Pick the exam tracks you want mentor matching for. These categories drive mentor discovery.</p>
          </div>

          <div className="mt-4 flex gap-2">
            <select
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
            >
              <option value="">Select approved category</option>
              {availableSuggestions.map((item) => (
                <option key={item.slug} value={item.slug}>
                  {item.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white"
              onClick={() => addCategory(newCategory)}
              disabled={!newCategory}
            >
              Add
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {categoryList.length > 0 ? (
              categoryList.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800"
                  onClick={() => removeCategory(cat)}
                  title="Remove category"
                >
                  {categoryNameMap[cat] ?? cat} ×
                </button>
              ))
            ) : (
              <p className="text-sm text-slate-500">No study categories selected yet.</p>
            )}
          </div>

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
              onClick={() => void savePreferences()}
            >
              Save Categories
            </button>
          </div>
        </article>

        <article className="app-card p-5 md:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Latest Recordings</h2>
              <p className="mt-1 text-sm text-slate-600">Use recordings for revision instead of hunting through every old session.</p>
            </div>
            <Link href="/dashboard/recordings" className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700">
              View All
            </Link>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {recordings.slice(0, 2).map((item) => (
              <div key={item.id ?? `${item.session_id}-${item.attempt_number ?? 0}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="font-semibold text-slate-900">{item.title}</p>
                <p className="mt-1 text-xs text-slate-500">{formatIstDateTime(item.starts_at)} • {statusLabel(item.status)}</p>
                {item.status === "uploaded" && item.playback_url ? (
                  <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-black">
                    <video
                      src={item.playback_url}
                      controls
                      controlsList="nodownload noplaybackrate"
                      className="aspect-video w-full bg-black"
                      preload="metadata"
                      onContextMenu={(e) => e.preventDefault()}
                    />
                  </div>
                ) : (
                  <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white p-3 text-sm text-slate-600">
                    {item.status === "failed" ? item.error_message || "Recording failed for this session." : "Recording is being processed and will appear here automatically when ready."}
                  </div>
                )}
              </div>
            ))}
            {recordings.length === 0 && <p className="text-sm text-slate-500">No recordings available yet.</p>}
          </div>
        </article>

        {notifications.length > 0 && (
          <article className="app-card p-5 md:col-span-3">
            <h2 className="text-lg font-semibold">Recent Updates</h2>
            <div className="mt-3 space-y-2 text-sm">
              {notifications.slice(0, 3).map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="font-medium text-slate-900">{item.title}</div>
                  <div className="text-slate-600">{item.message}</div>
                </div>
              ))}
            </div>
          </article>
        )}
      </div>
    </DashboardShell>
  );
}
