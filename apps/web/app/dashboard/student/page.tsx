"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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

function statusStyle(status: string): { background: string; border: string; color: string } {
  if (status === "ready_to_join" || status === "in_progress")
    return {
      background: "rgba(16,185,129,0.12)",
      border: "1px solid rgba(16,185,129,0.3)",
      color: "#34d399",
    };
  if (
    status === "pending_mentor_approval" ||
    status === "pending_manager_approval"
  )
    return {
      background: "rgba(245,158,11,0.12)",
      border: "1px solid rgba(245,158,11,0.3)",
      color: "#fbbf24",
    };
  if (status === "pending_payment")
    return {
      background: "rgba(59,130,246,0.12)",
      border: "1px solid rgba(59,130,246,0.3)",
      color: "#60a5fa",
    };
  if (status === "cancelled" || status === "no_show")
    return {
      background: "rgba(244,63,94,0.12)",
      border: "1px solid rgba(244,63,94,0.3)",
      color: "#fb7185",
    };
  return {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "#94a3b8",
  };
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
  const nextSession = sortedSessions.find((item) =>
    ["ready_to_join", "in_progress", "confirmed", "pending_payment"].includes(item.status),
  );
  const upcomingCount = sortedSessions.filter(
    (item) => new Date(item.starts_at).getTime() >= Date.now(),
  ).length;
  const readyRecordingCount = recordings.filter(
    (item) => item.status === "uploaded" && item.playback_url,
  ).length;

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
    setCategories(profile.target_exams || categories);

    const [summaryResp, notificationsResp] = await Promise.all([
      authedFetch("/users/me/dashboard-summary?session_limit=8&recording_limit=8"),
      authedFetch("/notifications/mine"),
    ]);
    const [summary, n] = await Promise.all([
      parseJsonSafe(summaryResp),
      parseJsonSafe(notificationsResp),
    ]);
    setSessions(Array.isArray(summary?.sessions) ? summary.sessions : []);
    setNotifications(Array.isArray(n) ? n : []);
    setRecordings(
      (Array.isArray(summary?.recordings) ? summary.recordings : []) as StudentRecording[],
    );
  }

  async function savePreferences() {
    await authedFetch("/users/me/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_exams: categories }),
    });
  }

  function setCategoryList(next: string[]) {
    const unique = Array.from(
      new Set(next.map((item) => item.trim().toLowerCase()).filter(Boolean)),
    );
    setCategories(unique.join(","));
  }

  function addCategory(value: string) {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed || categoryList.includes(trimmed)) return;
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
    <>
      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            label: "Categories",
            value: categoryList.length,
            sub: "Exam tracks selected",
            icon: "fa-solid fa-book-open",
            color: "text-violet-400",
          },
          {
            label: "Upcoming Calls",
            value: upcomingCount,
            sub: "Sessions in calendar",
            icon: "fa-solid fa-calendar-days",
            color: "text-blue-400",
          },
          {
            label: "Ready Recordings",
            value: readyRecordingCount,
            sub: "Available to watch",
            icon: "fa-solid fa-circle-play",
            color: "text-cyan-400",
          },
        ].map((stat) => (
          <article key={stat.label} className="app-card p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                  {stat.label}
                </p>
                <p className="mt-3 text-4xl font-black text-white">{stat.value}</p>
                <p className="mt-1 text-sm text-slate-500">{stat.sub}</p>
              </div>
              <div
                className={`rounded-xl p-3 ${stat.color}`}
                style={{ background: "rgba(255,255,255,0.05)" }}
              >
                <i className={`${stat.icon} text-lg`} />
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* Next session + quick actions */}
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <article className="app-card p-5 md:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-white">Next Class</h2>
              <p className="mt-0.5 text-sm text-slate-500">Your next upcoming session</p>
            </div>
            <Link
              href="/dashboard/calendar"
              className="rounded-xl border border-white/10 px-3 py-1.5 text-sm font-semibold text-slate-400 transition hover:border-white/20 hover:text-white"
            >
              Open Calendar
            </Link>
          </div>
          {nextSession ? (
            <div
              className="mt-4 rounded-2xl p-4"
              style={{
                background: "rgba(124,58,237,0.08)",
                border: "1px solid rgba(124,58,237,0.2)",
              }}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-white">{nextSession.title}</p>
                  <p className="mt-1 text-sm text-slate-400">
                    {formatIstDateTime(nextSession.starts_at)}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Mentor: {nextSession.mentor_name ?? nextSession.mentor_id}
                  </p>
                </div>
                <span
                  className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                  style={statusStyle(nextSession.status)}
                >
                  {statusLabel(nextSession.status)}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/dashboard/sessions/${nextSession.id}`}
                  className="rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:from-violet-500 hover:to-blue-500"
                >
                  Open Session
                </Link>
                <Link
                  href="/dashboard/student/chats"
                  className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-white/20 hover:text-white"
                >
                  Open Chats
                </Link>
              </div>
            </div>
          ) : (
            <div
              className="mt-4 rounded-2xl p-4 text-sm text-slate-500"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px dashed rgba(255,255,255,0.08)",
              }}
            >
              No class lined up yet. Find a mentor and send a connection request to get started.
            </div>
          )}
        </article>

        <article className="app-card p-5">
          <h2 className="font-bold text-white">Find Mentors</h2>
          <p className="mt-1 text-sm text-slate-500">
            Choose by exam category, connect, then unlock chat and video sessions.
          </p>
          <div className="mt-4 flex flex-col gap-2">
            <Link
              href="/dashboard/student/mentors"
              className="block rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 py-2.5 text-center text-sm font-bold text-white transition hover:from-violet-500 hover:to-blue-500"
            >
              Explore Mentors
            </Link>
            <Link
              href="/dashboard/profile"
              className="block rounded-xl border border-white/10 py-2.5 text-center text-sm font-semibold text-slate-400 transition hover:border-white/20 hover:text-white"
            >
              Edit Profile
            </Link>
          </div>
          {categoryList.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {categoryList.slice(0, 4).map((cat) => (
                <span
                  key={cat}
                  className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-violet-300"
                  style={{
                    background: "rgba(124,58,237,0.12)",
                    border: "1px solid rgba(124,58,237,0.2)",
                  }}
                >
                  {categoryNameMap[cat] ?? cat}
                </span>
              ))}
            </div>
          )}
        </article>
      </div>

      {/* Study categories */}
      <article className="app-card mt-4 p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-white">Study Categories</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Exam tracks that drive mentor matching and discovery.
            </p>
          </div>
          <button
            type="button"
            className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-400 transition hover:border-white/20 hover:text-white"
            onClick={() => void savePreferences()}
          >
            Save
          </button>
        </div>

        <div className="flex gap-2">
          <select
            className="input-dark flex-1"
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
            className="rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:from-violet-500 hover:to-blue-500 disabled:opacity-40"
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
                className="rounded-full px-3 py-1 text-xs font-semibold text-violet-300 transition hover:bg-rose-500/10 hover:text-rose-400"
                style={{
                  background: "rgba(124,58,237,0.12)",
                  border: "1px solid rgba(124,58,237,0.2)",
                }}
                onClick={() => removeCategory(cat)}
                title="Click to remove"
              >
                {categoryNameMap[cat] ?? cat} &times;
              </button>
            ))
          ) : (
            <p className="text-sm text-slate-500">No study categories selected yet.</p>
          )}
        </div>
      </article>

      {/* Latest recordings */}
      <article className="app-card mt-4 p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-white">Latest Recordings</h2>
            <p className="mt-0.5 text-sm text-slate-500">Use recordings for revision between sessions.</p>
          </div>
          <Link
            href="/dashboard/recordings"
            className="rounded-xl border border-white/10 px-3 py-1.5 text-sm font-semibold text-slate-400 transition hover:border-white/20 hover:text-white"
          >
            View All
          </Link>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {recordings.slice(0, 2).map((item) => (
            <div
              key={item.id ?? `${item.session_id}-${item.attempt_number ?? 0}`}
              className="rounded-2xl p-4"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <p className="font-semibold text-white">{item.title}</p>
              <p className="mt-1 text-xs text-slate-500">
                {formatIstDateTime(item.starts_at)} &bull; {statusLabel(item.status)}
              </p>
              {item.status === "uploaded" && item.playback_url ? (
                <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-black">
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
                <div
                  className="mt-3 rounded-xl p-3 text-sm text-slate-500"
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px dashed rgba(255,255,255,0.08)",
                  }}
                >
                  {item.status === "failed"
                    ? item.error_message || "Recording failed for this session."
                    : "Recording is being processed and will appear here when ready."}
                </div>
              )}
            </div>
          ))}
          {recordings.length === 0 && (
            <p className="text-sm text-slate-500">No recordings available yet.</p>
          )}
        </div>
      </article>

      {/* Notifications */}
      {notifications.length > 0 && (
        <article className="app-card mt-4 p-5">
          <h2 className="mb-3 font-bold text-white">Recent Updates</h2>
          <div className="space-y-2">
            {notifications.slice(0, 3).map((item) => (
              <div
                key={item.id}
                className="rounded-2xl p-3"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}
              >
                <p className="text-sm font-semibold text-white">{item.title}</p>
                <p className="mt-0.5 text-sm text-slate-500">{item.message}</p>
              </div>
            ))}
          </div>
        </article>
      )}
    </>
  );
}
