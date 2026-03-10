"use client";

import { Fragment, useEffect, useMemo, useState } from "react";

import { authedFetch, parseJsonSafe } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

type SessionRow = {
  id: string;
  mentor_id: string;
  student_id: string;
  title: string;
  notes: string | null;
  starts_at: string;
  duration_minutes: number;
  status: string;
};

type Mentor = {
  user_id: string;
  headline: string | null;
};

type ViewMode = "week" | "day";

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function startOfWeek(date: Date): Date {
  const day = date.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  const d = new Date(date);
  d.setDate(d.getDate() + offset);
  return startOfDay(d);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function SessionCalendar() {
  const session = useAuthStore((s) => s.session);
  const role = session?.role;

  const [view, setView] = useState<ViewMode>("week");
  const [anchorDate, setAnchorDate] = useState<Date>(new Date());
  const [items, setItems] = useState<SessionRow[]>([]);
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [selectedMentor, setSelectedMentor] = useState("");
  const [title, setTitle] = useState("Mentorship Session");
  const [notes, setNotes] = useState("");
  const [createDate, setCreateDate] = useState(() => dateInputValue(new Date()));
  const [createTime, setCreateTime] = useState("10:00");
  const [createDuration, setCreateDuration] = useState(60);
  const [statusFilter, setStatusFilter] = useState("all");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const hours = useMemo(() => Array.from({ length: 14 }, (_, i) => i + 8), []); // 08:00-21:00
  const weekStart = useMemo(() => startOfWeek(anchorDate), [anchorDate]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const visibleDays = view === "week" ? weekDays : [startOfDay(anchorDate)];

  const rangeStart = visibleDays[0];
  const rangeEnd = endOfDay(visibleDays[visibleDays.length - 1]);

  async function refresh() {
    const query = `?date_from=${encodeURIComponent(rangeStart.toISOString())}&date_to=${encodeURIComponent(rangeEnd.toISOString())}`;
    const response = await authedFetch(`/sessions/calendar/list${query}`);
    const payload = await parseJsonSafe(response);
    setItems(Array.isArray(payload) ? payload : []);
    if (!response.ok && !Array.isArray(payload)) {
      setMessage(payload?.detail ?? "Unable to load calendar data");
    }

    if (role === "student") {
      const mentorResponse = await authedFetch("/mentors");
      const mentorPayload = await parseJsonSafe(mentorResponse);
      const mentorRows = Array.isArray(mentorPayload) ? mentorPayload : [];
      setMentors(mentorRows);
      if (!selectedMentor && mentorRows.length > 0) setSelectedMentor(mentorRows[0].user_id);
    }
  }

  useEffect(() => {
    void refresh();
  }, [view, anchorDate]);

  const visibleItems = useMemo(() => {
    if (statusFilter === "all") return items;
    return items.filter((item) => item.status === statusFilter);
  }, [items, statusFilter]);

  const upcoming = useMemo(() => {
    const now = Date.now();
    return [...visibleItems]
      .filter((item) => new Date(item.starts_at).getTime() >= now)
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
      .slice(0, 8);
  }, [visibleItems]);

  function sessionsForCell(day: Date, hour: number): SessionRow[] {
    return visibleItems.filter((item) => {
      const s = new Date(item.starts_at);
      return sameDay(s, day) && s.getHours() === hour;
    });
  }

  async function createCall() {
    if (role !== "student" || !selectedMentor) return;
    setBusy(true);
    try {
      const [year, month, day] = createDate.split("-").map(Number);
      const [h, m] = createTime.split(":").map(Number);
      if (!year || !month || !day || Number.isNaN(h) || Number.isNaN(m)) {
        setMessage("Please select a valid date and time");
        return;
      }
      const starts = new Date();
      starts.setFullYear(year, month - 1, day);
      starts.setHours(h, m, 0, 0);

      const resp = await authedFetch("/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mentor_id: selectedMentor,
          title,
          notes,
          starts_at: starts.toISOString(),
          duration_minutes: createDuration,
        }),
      });
      const data = await parseJsonSafe(resp);
      setMessage(data.detail ?? "Call request created");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function moveSession(sessionId: string, day: Date, hour: number) {
    const startsAt = new Date(day);
    startsAt.setHours(hour, 0, 0, 0);
    await authedFetch(`/sessions/${sessionId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ starts_at: startsAt.toISOString() }),
    });
    await refresh();
  }

  async function approveCall(item: SessionRow) {
    await authedFetch(`/sessions/${item.id}/approve`, { method: "POST" });
    await refresh();
  }

  async function deleteCall(item: SessionRow) {
    if (!window.confirm("Delete this call?")) return;
    await authedFetch(`/sessions/${item.id}`, { method: "DELETE" });
    await refresh();
  }

  const canCreate = role === "student";

  return (
    <section className="space-y-4">
      <div className="rounded-xl bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <button className="rounded border px-3 py-1.5" onClick={() => setAnchorDate(addDays(anchorDate, view === "week" ? -7 : -1))}>Prev</button>
            <button className="rounded border px-3 py-1.5" onClick={() => setAnchorDate(new Date())}>Today</button>
            <button className="rounded border px-3 py-1.5" onClick={() => setAnchorDate(addDays(anchorDate, view === "week" ? 7 : 1))}>Next</button>
          </div>
          <h2 className="text-lg font-semibold">
            {view === "week"
              ? `${visibleDays[0].toLocaleDateString()} - ${visibleDays[visibleDays.length - 1].toLocaleDateString()}`
              : visibleDays[0].toLocaleDateString()}
          </h2>
          <div className="flex gap-2">
            <select className="rounded border px-2 py-1.5 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All statuses</option>
              <option value="pending_mentor_approval">Pending Mentor Approval</option>
              <option value="pending_manager_approval">Pending Manager Approval</option>
              <option value="pending_payment">Pending Payment</option>
              <option value="confirmed">Confirmed</option>
              <option value="ready_to_join">Ready To Join</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <button className={`rounded px-3 py-1.5 ${view === "day" ? "bg-accent text-white" : "border"}`} onClick={() => setView("day")}>Day</button>
            <button className={`rounded px-3 py-1.5 ${view === "week" ? "bg-accent text-white" : "border"}`} onClick={() => setView("week")}>Week</button>
          </div>
        </div>
      </div>

      {canCreate && (
        <article className="rounded-xl bg-card p-5 shadow-sm">
          <h3 className="text-base font-semibold">Schedule New Call</h3>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <select className="rounded border px-3 py-2" value={selectedMentor} onChange={(e) => setSelectedMentor(e.target.value)}>
              {mentors.map((m) => (
                <option key={m.user_id} value={m.user_id}>{m.headline ?? m.user_id}</option>
              ))}
            </select>
            <input className="rounded border px-3 py-2" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Call title" />
            <input className="rounded border px-3 py-2" value={createDate} onChange={(e) => setCreateDate(e.target.value)} type="date" />
            <input className="rounded border px-3 py-2" value={createTime} onChange={(e) => setCreateTime(e.target.value)} type="time" />
            <select className="rounded border px-3 py-2" value={createDuration} onChange={(e) => setCreateDuration(Number(e.target.value))}>
              <option value={30}>30 mins</option>
              <option value={45}>45 mins</option>
              <option value={60}>60 mins</option>
              <option value={90}>90 mins</option>
            </select>
            <input className="rounded border px-3 py-2" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" />
          </div>
          <button className="mt-3 rounded bg-accent px-4 py-2 text-sm text-white disabled:opacity-50" disabled={busy} onClick={createCall}>
            {busy ? "Saving..." : "Create Call Request"}
          </button>
          {message && <p className="mt-2 text-sm text-black/70">{message}</p>}
        </article>
      )}

      <div className="overflow-x-auto rounded-xl bg-card p-3 shadow-sm">
        <div
          className="min-w-[900px]"
          style={{ display: "grid", gridTemplateColumns: `80px repeat(${visibleDays.length}, minmax(140px, 1fr))` }}
        >
          <div className="border-b p-2 text-xs font-semibold text-black/60">Time</div>
          {visibleDays.map((day) => (
            <div key={day.toISOString()} className="border-b p-2 text-xs font-semibold text-black/60">
              {day.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
            </div>
          ))}

          {hours.map((hour) => (
            <Fragment key={`row-${hour}`}>
              <div key={`h-${hour}`} className="border-b p-2 text-xs text-black/60">{`${String(hour).padStart(2, "0")}:00`}</div>
              {visibleDays.map((day) => {
                const cellItems = sessionsForCell(day, hour);
                return (
                  <div
                    key={`${day.toISOString()}-${hour}`}
                    className="border-b border-l p-1"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={async (e) => {
                      e.preventDefault();
                      const sessionId = e.dataTransfer.getData("text/session-id");
                      if (sessionId) await moveSession(sessionId, day, hour);
                    }}
                  >
                    <div className="min-h-14 rounded border border-dashed border-black/10 p-1">
                      {cellItems.map((item) => {
                        const canApprove =
                          (role === "mentor" && item.status === "pending_mentor_approval") ||
                          (role === "manager" && item.status === "pending_manager_approval") ||
                          (role === "admin" && (item.status === "pending_mentor_approval" || item.status === "pending_manager_approval"));
                        const canDelete = role === "student" || role === "admin" || role === "manager";
                        return (
                          <div
                            key={item.id}
                            className="mb-1 cursor-move rounded bg-accentSoft p-1 text-xs"
                            draggable
                            onDragStart={(e) => e.dataTransfer.setData("text/session-id", item.id)}
                          >
                            <div className="font-semibold">{item.title}</div>
                            <div className="text-black/70">{item.status}</div>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {canApprove && (
                                <button className="rounded border px-1" onClick={() => approveCall(item)}>
                                  {item.status === "pending_mentor_approval" ? "Mentor Approve" : "Manager Approve"}
                                </button>
                              )}
                              {role === "mentor" && item.status === "pending_manager_approval" && (
                                <span className="rounded border px-1 text-[10px] text-black/60">Awaiting Manager</span>
                              )}
                              {canDelete && <button className="rounded border px-1" onClick={() => deleteCall(item)}>Del</button>}
                              <a className="rounded border px-1" href={`/dashboard/sessions/${item.id}`}>Join Call</a>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>

      <article className="rounded-xl bg-card p-4 shadow-sm">
        <h3 className="text-sm font-semibold">Upcoming Calls</h3>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          {upcoming.map((item) => (
            <div key={item.id} className="rounded border p-2 text-sm">
              <div className="font-medium">{item.title}</div>
              <div className="text-black/70">{new Date(item.starts_at).toLocaleString()}</div>
              <div className="text-black/70">{item.duration_minutes} mins | {item.status}</div>
              <a className="mt-1 inline-block rounded bg-accent px-2 py-1 text-xs text-white" href={`/dashboard/sessions/${item.id}`}>
                Join Call Hub
              </a>
            </div>
          ))}
          {upcoming.length === 0 && <p className="text-sm text-black/60">No upcoming calls in current filter.</p>}
        </div>
      </article>
    </section>
  );
}
