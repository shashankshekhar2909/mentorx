"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { DashboardShell } from "@/components/dashboard-shell";
import { authedFetch, parseJsonSafe } from "@/lib/api";

type Mentor = {
  user_id: string;
  headline: string | null;
  exams: string | null;
  years_experience: number;
  hourly_price: number;
  rating_avg: number;
};

type SessionRow = {
  id: string;
  title: string;
  status: string;
  starts_at: string;
  duration_minutes: number;
  mentor_id: string;
};

type StudentRecording = {
  session_id: string;
  title: string;
  starts_at: string;
  status: string;
  playback_url: string;
};

function statusLabel(status: string): string {
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
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [notifications, setNotifications] = useState<{ id: string; title: string; message: string }[]>([]);
  const [recordings, setRecordings] = useState<StudentRecording[]>([]);
  const [selectedMentor, setSelectedMentor] = useState<string>("");
  const [time, setTime] = useState("10:00");
  const [loading, setLoading] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const mentorMap = useMemo(
    () =>
      mentors.reduce<Record<string, Mentor>>((acc, mentor) => {
        acc[mentor.user_id] = mentor;
        return acc;
      }, {}),
    [mentors],
  );
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

  const [dateFrom, dateTo] = useMemo(() => {
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59));
    return [start.toISOString(), end.toISOString()];
  }, []);

  async function refreshMentors(activeCategories: string) {
    const mentorResp = await authedFetch(`/mentors?categories=${encodeURIComponent(activeCategories)}`);
    const m = await parseJsonSafe(mentorResp);
    const mentorRows = Array.isArray(m) ? m : [];
    setMentors(mentorRows);
    if (mentorRows.length > 0 && !selectedMentor) setSelectedMentor(mentorRows[0].user_id);
  }

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

    const [sessionsResp, notificationsResp] = await Promise.all([
      authedFetch(`/sessions/calendar/list?date_from=${encodeURIComponent(dateFrom)}&date_to=${encodeURIComponent(dateTo)}`),
      authedFetch("/notifications/mine"),
    ]);
    const [s, n] = await Promise.all([parseJsonSafe(sessionsResp), parseJsonSafe(notificationsResp)]);
    const sessionRows = Array.isArray(s) ? s : [];
    setSessions(sessionRows);
    setNotifications(Array.isArray(n) ? n : []);
    const recordingRows = (
      await Promise.all(
        sessionRows.map(async (row: SessionRow) => {
          const recResp = await authedFetch(`/sessions/${row.id}/recording`);
          if (!recResp.ok) return null;
          const rec = await parseJsonSafe(recResp);
          if (!rec?.playback_url) return null;
          return {
            session_id: row.id,
            title: row.title,
            starts_at: row.starts_at,
            status: String(rec.status ?? "uploaded"),
            playback_url: String(rec.playback_url),
          } as StudentRecording;
        }),
      )
    ).filter(Boolean) as StudentRecording[];
    setRecordings(recordingRows);
    await refreshMentors(profileCategories);
  }

  async function savePreferences() {
    await authedFetch("/users/me/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_exams: categories }),
    });
    await refreshMentors(categories);
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

  async function requestCall() {
    if (!selectedMentor) return;
    setLoading(true);
    try {
      const [h, m] = time.split(":").map(Number);
      const start = new Date();
      start.setUTCDate(start.getUTCDate() + 2);
      start.setUTCHours(h, m, 0, 0);

      await authedFetch("/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mentor_id: selectedMentor,
          title: "Student call request",
          starts_at: start.toISOString(),
          duration_minutes: 60,
        }),
      });
      await refreshAll();
    } finally {
      setLoading(false);
    }
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
          <h2 className="text-lg font-semibold">Related Mentors</h2>
          <p className="mt-1 text-sm text-slate-600">Mentors filtered by your categories/subjects.</p>
          <select
            className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2"
            value={selectedMentor}
            onChange={(e) => setSelectedMentor(e.target.value)}
          >
            {mentors.map((mentor) => (
              <option key={mentor.user_id} value={mentor.user_id}>
                {mentor.headline ?? mentor.user_id} | {mentor.exams ?? "-"}
              </option>
            ))}
          </select>
          <div className="mt-3 flex gap-2">
            <input className="rounded-lg border border-slate-300 px-3 py-2" value={time} onChange={(e) => setTime(e.target.value)} type="time" />
            <button
              type="button"
              onClick={requestCall}
              disabled={loading || !selectedMentor}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? "Sending..." : "Request Call"}
            </button>
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
                    <p className="font-semibold text-slate-800">{mentorMap[item.mentor_id]?.headline || `Mentor ${item.mentor_id.slice(0, 6)}`}</p>
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
                <p className="text-xs text-slate-500">{new Date(item.starts_at).toLocaleString()} • {item.status}</p>
                <a className="mt-2 inline-flex rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white" href={item.playback_url} target="_blank" rel="noreferrer">
                  Open Recording
                </a>
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
