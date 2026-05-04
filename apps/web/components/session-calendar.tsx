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

function statusLabel(status: string): string {
  return status.replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function statusClasses(status: string): string {
  if (status === "ready_to_join" || status === "in_progress") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";
  if (status === "pending_mentor_approval" || status === "pending_manager_approval") return "border-amber-500/30 bg-amber-500/10 text-amber-400";
  if (status === "completed") return "border-blue-500/30 bg-blue-500/10 text-blue-400";
  if (status === "cancelled" || status === "no_show") return "border-rose-500/30 bg-rose-500/10 text-rose-400";
  return "border-white/10 bg-white/5 text-slate-400";
}

function statusIcon(status: string): string {
  if (status === "ready_to_join" || status === "in_progress") return "fa-solid fa-video";
  if (status === "pending_mentor_approval" || status === "pending_manager_approval") return "fa-solid fa-hourglass-half";
  if (status === "completed") return "fa-solid fa-circle-check";
  if (status === "cancelled" || status === "no_show") return "fa-solid fa-circle-xmark";
  return "fa-solid fa-calendar-check";
}

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

  const navBtnBase = "rounded-xl border border-white/10 px-3 py-1.5 text-sm font-medium text-slate-400 transition hover:border-white/20 hover:text-white";

  return (
    <section className="space-y-4">
      {/* Calendar controls */}
      <div className="app-card flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex gap-2">
          <button className={navBtnBase} onClick={() => setAnchorDate(addDays(anchorDate, view === "week" ? -7 : -1))}>
            <i className="fa-solid fa-chevron-left mr-2" />Prev
          </button>
          <button className={navBtnBase} onClick={() => setAnchorDate(new Date())}>
            <i className="fa-solid fa-calendar-day mr-2" />Today
          </button>
          <button className={navBtnBase} onClick={() => setAnchorDate(addDays(anchorDate, view === "week" ? 7 : 1))}>
            Next<i className="fa-solid fa-chevron-right ml-2" />
          </button>
        </div>
        <h2 className="font-semibold text-white">
          <i className="fa-solid fa-calendar-week mr-2 text-violet-400" />
          {view === "week"
            ? `${visibleDays[0].toLocaleDateString()} – ${visibleDays[visibleDays.length - 1].toLocaleDateString()}`
            : visibleDays[0].toLocaleDateString()}
        </h2>
        <div className="flex gap-2">
          <select
            className="input-dark text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
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
          <button
            className={view === "day" ? "rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-3 py-1.5 text-sm font-semibold text-white" : navBtnBase}
            onClick={() => setView("day")}
          >
            <i className="fa-solid fa-table-cells-large mr-2" />Day
          </button>
          <button
            className={view === "week" ? "rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-3 py-1.5 text-sm font-semibold text-white" : navBtnBase}
            onClick={() => setView("week")}
          >
            <i className="fa-solid fa-table-columns mr-2" />Week
          </button>
        </div>
      </div>

      {/* Schedule new call */}
      {canCreate && (
        <article className="app-card p-5">
          <h3 className="mb-3 font-semibold text-white">
            <i className="fa-solid fa-calendar-plus mr-2 text-violet-400" />
            Schedule New Call
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            <select className="input-dark" value={selectedMentor} onChange={(e) => setSelectedMentor(e.target.value)}>
              {mentors.map((m) => (
                <option key={m.user_id} value={m.user_id}>{m.headline ?? m.user_id}</option>
              ))}
            </select>
            <input className="input-dark" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Call title" />
            <input className="input-dark" value={createDate} onChange={(e) => setCreateDate(e.target.value)} type="date" />
            <input className="input-dark" value={createTime} onChange={(e) => setCreateTime(e.target.value)} type="time" />
            <select className="input-dark" value={createDuration} onChange={(e) => setCreateDuration(Number(e.target.value))}>
              <option value={30}>30 mins</option>
              <option value={45}>45 mins</option>
              <option value={60}>60 mins</option>
              <option value={90}>90 mins</option>
            </select>
            <input className="input-dark" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" />
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              className="rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:from-violet-500 hover:to-blue-500 disabled:opacity-50"
              disabled={busy}
              onClick={createCall}
            >
              <i className={`mr-2 ${busy ? "fa-solid fa-spinner fa-spin" : "fa-solid fa-paper-plane"}`} />
              {busy ? "Saving..." : "Create Call Request"}
            </button>
            {message && <span className="text-sm text-slate-400">{message}</span>}
          </div>
        </article>
      )}

      {/* Calendar grid */}
      <div className="app-card overflow-x-auto p-3">
        <div
          className="min-w-[900px]"
          style={{
            display: "grid",
            gridTemplateColumns: `80px repeat(${visibleDays.length}, minmax(140px, 1fr))`,
          }}
        >
          <div className="border-b border-white/8 p-2 text-xs font-semibold text-slate-500">Time</div>
          {visibleDays.map((day) => (
            <div
              key={day.toISOString()}
              className="border-b border-white/8 p-2 text-xs font-semibold text-slate-400"
            >
              {day.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
            </div>
          ))}

          {hours.map((hour) => (
            <Fragment key={`row-${hour}`}>
              <div key={`h-${hour}`} className="border-b border-white/6 p-2 text-xs text-slate-600">
                {`${String(hour).padStart(2, "0")}:00`}
              </div>
              {visibleDays.map((day) => {
                const cellItems = sessionsForCell(day, hour);
                return (
                  <div
                    key={`${day.toISOString()}-${hour}`}
                    className="border-b border-l border-white/6 p-1"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={async (e) => {
                      e.preventDefault();
                      const sessionId = e.dataTransfer.getData("text/session-id");
                      if (sessionId) await moveSession(sessionId, day, hour);
                    }}
                  >
                    <div
                      className="min-h-24 rounded-xl p-1.5"
                      style={{
                        background: "rgba(255,255,255,0.02)",
                        border: "1px dashed rgba(255,255,255,0.06)",
                      }}
                    >
                      {cellItems.map((item) => {
                        const canApprove =
                          (role === "mentor" && item.status === "pending_mentor_approval") ||
                          (role === "manager" && item.status === "pending_manager_approval") ||
                          (role === "admin" &&
                            (item.status === "pending_mentor_approval" ||
                              item.status === "pending_manager_approval"));
                        const canDelete =
                          role === "student" || role === "admin" || role === "manager";
                        return (
                          <div
                            key={item.id}
                            className="mb-2 cursor-move rounded-xl p-2 text-xs"
                            style={{
                              background: "rgba(124,58,237,0.08)",
                              border: "1px solid rgba(124,58,237,0.2)",
                            }}
                            draggable
                            onDragStart={(e) => e.dataTransfer.setData("text/session-id", item.id)}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="font-semibold text-white">{item.title}</div>
                                <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
                                  <i className="fa-regular fa-clock" />
                                  <span>
                                    {new Date(item.starts_at).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                  <span>&bull;</span>
                                  <span>{item.duration_minutes} min</span>
                                </div>
                              </div>
                              <span
                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusClasses(item.status)}`}
                              >
                                <i className={statusIcon(item.status)} />
                                {statusLabel(item.status)}
                              </span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1">
                              {canApprove && (
                                <button
                                  className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-emerald-400 transition hover:bg-emerald-500/20"
                                  onClick={() => approveCall(item)}
                                >
                                  <i className="fa-solid fa-check mr-1" />
                                  {item.status === "pending_mentor_approval"
                                    ? "Mentor Approve"
                                    : "Manager Approve"}
                                </button>
                              )}
                              {role === "mentor" && item.status === "pending_manager_approval" && (
                                <span className="rounded-lg border border-white/10 px-2 py-1 text-[10px] text-slate-500">
                                  <i className="fa-solid fa-user-clock mr-1" />
                                  Awaiting Manager
                                </span>
                              )}
                              {canDelete && (
                                <button
                                  className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-rose-400 transition hover:bg-rose-500/20"
                                  onClick={() => deleteCall(item)}
                                >
                                  <i className="fa-solid fa-trash mr-1" />
                                  Delete
                                </button>
                              )}
                              <a
                                className="rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 px-2 py-1 text-white transition hover:from-violet-500 hover:to-blue-500"
                                href={`/dashboard/sessions/${item.id}`}
                              >
                                <i className="fa-solid fa-video mr-1" />
                                Open
                              </a>
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

      {/* Upcoming calls list */}
      <article className="app-card p-4">
        <h3 className="mb-3 font-semibold text-white">
          <i className="fa-solid fa-bell-concierge mr-2 text-violet-400" />
          Upcoming Calls
        </h3>
        <div className="grid gap-2 md:grid-cols-2">
          {upcoming.map((item) => (
            <div
              key={item.id}
              className="rounded-xl p-3 text-sm"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold text-white">{item.title}</div>
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusClasses(item.status)}`}
                >
                  <i className={statusIcon(item.status)} />
                  {statusLabel(item.status)}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2 text-slate-500">
                <i className="fa-regular fa-calendar" />
                {new Date(item.starts_at).toLocaleString()}
              </div>
              <div className="mt-1 flex items-center gap-2 text-slate-500">
                <i className="fa-regular fa-clock" />
                {item.duration_minutes} mins
              </div>
              <a
                className="mt-3 inline-block rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-3 py-1.5 text-xs font-bold text-white transition hover:from-violet-500 hover:to-blue-500"
                href={`/dashboard/sessions/${item.id}`}
              >
                <i className="fa-solid fa-video mr-1" />
                Open Call Hub
              </a>
            </div>
          ))}
          {upcoming.length === 0 && (
            <p className="text-sm text-slate-500">No upcoming calls in current filter.</p>
          )}
        </div>
      </article>
    </section>
  );
}
