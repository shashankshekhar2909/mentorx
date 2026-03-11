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
  if (status === "recording") return "Recording In Progress";
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
    <DashboardShell role="student" title="Student Dashboard">
      <div className="grid gap-4 md:grid-cols-2">
        <article className="app-card p-5">
          <h2 className="text-lg font-semibold">Study Preferences</h2>
          <p className="mt-1 text-sm text-slate-600">Set your enrolled categories/subjects and match with relevant mentors.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {categoryList.map((cat) => (
              <button
                key={cat}
                type="button"
                className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800"
                onClick={() => removeCategory(cat)}
                title="Remove"
              >
                {cat} ×
              </button>
            ))}
            {categoryList.length === 0 && <p className="text-xs text-slate-500">No categories selected</p>}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="Add category slug"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCategory(newCategory);
                }
              }}
            />
            <select
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value=""
              onChange={(e) => addCategory(e.target.value)}
            >
              <option value="">Select</option>
              {availableSuggestions.map((item) => (
                <option key={item.slug} value={item.slug}>
                  {item.name}
                </option>
              ))}
            </select>
            <button type="button" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold" onClick={() => addCategory(newCategory)}>
              Add
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {availableSuggestions.map((item) => (
              <button
                key={item.slug}
                type="button"
                className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700"
                onClick={() => addCategory(item.slug)}
              >
                + {item.name}
              </button>
            ))}
          </div>
          <button className="mt-3 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold" onClick={savePreferences}>Save Preferences</button>
        </article>

        <article className="app-card p-5">
          <h2 className="text-lg font-semibold">Mentor Network</h2>
          <p className="mt-1 text-sm text-slate-600">Browse mentors by category, send connection requests, and unlock chat/call after acceptance.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href="/dashboard/student/mentors" className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white">
              Open Mentor Directory
            </a>
          </div>
        </article>

        <article className="app-card p-5 md:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Your Calls</h2>
            <Link href="/dashboard/calendar" className="text-sm text-accent underline">Open Calendar</Link>
          </div>
          <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
            {sortedSessions.map((item) => (
              <article key={item.id} className="rounded-xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{item.title}</p>
                    <p className="text-xs text-slate-500">Session #{item.id.slice(0, 8)}</p>
                  </div>
                  <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${statusClass(item.status)}`}>
                    {statusLabel(item.status)}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border border-slate-200 bg-white px-2 py-1.5">
                    <p className="text-slate-500">Date</p>
                    <p className="font-semibold text-slate-800">{new Date(item.starts_at).toLocaleDateString()}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white px-2 py-1.5">
                    <p className="text-slate-500">Time</p>
                    <p className="font-semibold text-slate-800">{new Date(item.starts_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white px-2 py-1.5">
                    <p className="text-slate-500">With</p>
                    <p className="font-semibold text-slate-800">{item.mentor_name ?? `Mentor ${item.mentor_id.slice(0, 6)}`}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white px-2 py-1.5">
                    <p className="text-slate-500">Duration</p>
                    <p className="font-semibold text-slate-800">{item.duration_minutes} min</p>
                  </div>
                </div>
                <div className="mt-3">
                  <Link href={`/dashboard/sessions/${item.id}`} className="inline-flex rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white">
                    Open Call Hub
                  </Link>
                </div>
              </article>
            ))}
            {sessions.length === 0 && <p className="text-slate-500">No calls scheduled yet.</p>}
          </div>
        </article>

        <article className="app-card p-5 md:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Resources Marketplace</h2>
            <Link href="/dashboard/resources" className="text-sm text-accent underline">Browse & Purchase</Link>
          </div>
          <p className="mt-2 text-sm text-slate-600">Buy subject sheets and access purchased material anytime.</p>
        </article>

        <article className="app-card p-5 md:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Your Recordings</h2>
            <button className="text-sm text-accent underline" onClick={() => void refreshAll()}>Refresh</button>
          </div>
          <div className="mt-2 grid gap-2 text-sm md:grid-cols-2">
            {recordings.map((item) => (
              <div key={item.session_id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="font-semibold">{item.title}</p>
                <p className="text-xs text-slate-500">{formatIstDateTime(item.starts_at)} • {statusLabel(item.status)}</p>
                {item.playback_url ? (
                  <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-black">
                    <video
                      src={item.playback_url}
                      controls
                      controlsList="nodownload noplaybackrate"
                      className="h-44 w-full bg-black"
                      preload="metadata"
                      onContextMenu={(e) => e.preventDefault()}
                    />
                  </div>
                ) : (
                  <div className="mt-2 rounded-lg border border-dashed border-slate-300 bg-white p-3 text-xs text-slate-600">
                    {item.status === "failed"
                      ? item.error_message || "Recording failed for this session."
                      : "Recording is being prepared and will appear here automatically."}
                  </div>
                )}
              </div>
            ))}
            {recordings.length === 0 && <p className="text-slate-500">No recordings available yet.</p>}
          </div>
        </article>

        <article className="app-card p-5 md:col-span-2">
          <h2 className="text-lg font-semibold">Notifications</h2>
          <div className="mt-2 space-y-2 text-sm">
            {notifications.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                <div className="font-medium">{item.title}</div>
                <div className="text-slate-600">{item.message}</div>
              </div>
            ))}
            {notifications.length === 0 && <p className="text-slate-500">No notifications yet.</p>}
          </div>
        </article>
      </div>
    </DashboardShell>
  );
}
