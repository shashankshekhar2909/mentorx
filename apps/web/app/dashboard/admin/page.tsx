"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { authedFetch, parseJsonSafe } from "@/lib/api";
import { formatIstDateTime, formatSessionStatus, sessionStatusClasses, sessionStatusIcon } from "@/lib/presentation";

type Overview = {
  total_users: number;
  total_sessions: number;
  pending_mentor_verifications: number;
  paid_payments: number;
};

type UserRow = {
  id: string;
  email: string;
  role: string;
};

type SessionRow = {
  id: string;
  student_name: string;
  mentor_name: string;
  title: string;
  status: string;
  starts_at: string;
  duration_minutes: number;
  actual_duration_seconds?: number;
  is_instant: boolean;
};

type DisputeRow = {
  id: string;
  status: string;
  reason: string;
  created_at: string;
};

type VerificationRow = {
  mentor_user_id: string;
  status: string;
  headline: string | null;
  exams: string | null;
};

type RecordingRow = {
  id: string;
  session_id: string;
  title: string;
  student_name: string;
  mentor_name: string;
  status: string;
  created_at: string;
  visible_to_student: boolean;
};

type RecordingResponse = {
  items: RecordingRow[];
};

function formatDuration(seconds?: number, plannedMinutes?: number): string {
  const totalSeconds = Number(seconds ?? 0);
  if (totalSeconds > 0) {
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;
    if (minutes <= 0) return `${remainingSeconds}s actual`;
    if (remainingSeconds === 0) return `${minutes}m actual`;
    return `${minutes}m ${remainingSeconds}s actual`;
  }
  return `${plannedMinutes ?? 0} min planned`;
}

function toneForValue(value: number, mode: "danger-high" | "success-high" | "neutral" = "neutral"): string {
  if (mode === "danger-high") {
    return value > 0 ? "text-rose-700" : "text-slate-900";
  }
  if (mode === "success-high") {
    return value > 0 ? "text-emerald-700" : "text-slate-900";
  }
  return "text-slate-900";
}

export default function AdminOverviewPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [disputes, setDisputes] = useState<DisputeRow[]>([]);
  const [verifications, setVerifications] = useState<VerificationRow[]>([]);
  const [recordings, setRecordings] = useState<RecordingRow[]>([]);
  const [message, setMessage] = useState("");

  async function refresh() {
    const [overviewResp, usersResp, sessionsResp, disputesResp, verificationResp, recordingsResp] = await Promise.all([
      authedFetch("/admin/overview"),
      authedFetch("/admin/users"),
      authedFetch("/admin/sessions"),
      authedFetch("/admin/disputes"),
      authedFetch("/admin/mentor-verifications"),
      authedFetch("/admin/recordings?page=1&page_size=200"),
    ]);
    const [overviewData, usersData, sessionsData, disputesData, verificationData, recordingsData] = await Promise.all([
      parseJsonSafe(overviewResp),
      parseJsonSafe(usersResp),
      parseJsonSafe(sessionsResp),
      parseJsonSafe(disputesResp),
      parseJsonSafe(verificationResp),
      parseJsonSafe(recordingsResp),
    ]);

    setOverview(overviewResp.ok && overviewData?.total_users !== undefined ? overviewData : null);
    setUsers(usersResp.ok && Array.isArray(usersData) ? usersData : []);
    setSessions(sessionsResp.ok && Array.isArray(sessionsData) ? sessionsData : []);
    setDisputes(disputesResp.ok && Array.isArray(disputesData) ? disputesData : []);
    setVerifications(verificationResp.ok && Array.isArray(verificationData) ? verificationData : []);
    setRecordings(recordingsResp.ok && Array.isArray((recordingsData as RecordingResponse)?.items) ? recordingsData.items : []);
    setMessage(overviewResp.ok ? "" : (overviewData?.detail ?? "Unable to load admin console"));
  }

  useEffect(() => {
    void refresh();
  }, []);

  const userCounts = useMemo(() => {
    return users.reduce<Record<string, number>>((acc, row) => {
      acc[row.role] = (acc[row.role] ?? 0) + 1;
      return acc;
    }, {});
  }, [users]);

  const statusCounts = useMemo(() => {
    return sessions.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = (acc[row.status] ?? 0) + 1;
      return acc;
    }, {});
  }, [sessions]);

  const activeCalls = sessions.filter((row) => ["confirmed", "ready_to_join", "in_progress"].includes(row.status)).length;
  const pendingApprovals = sessions.filter((row) => row.status === "pending_mentor_approval").length;
  const instantCalls = sessions.filter((row) => row.is_instant).length;
  const openDisputes = disputes.filter((row) => row.status !== "resolved").length;
  const hiddenRecordings = recordings.filter((row) => row.visible_to_student === false).length;
  const processingRecordings = recordings.filter((row) => row.status === "queued" || row.status === "recording").length;
  const readyRecordings = recordings.filter((row) => row.status === "uploaded").length;
  const pendingVerifications = verifications.filter((row) => row.status === "pending").length;

  const attentionItems = [
    {
      label: "Mentor verification queue",
      value: pendingVerifications,
      href: "/dashboard/admin/verifications",
      tone: "danger-high" as const,
      help: "Mentors waiting for approval",
    },
    {
      label: "Open disputes",
      value: openDisputes,
      href: "/dashboard/admin/disputes",
      tone: "danger-high" as const,
      help: "Cases that still need review",
    },
    {
      label: "Processing recordings",
      value: processingRecordings,
      href: "/dashboard/admin/sessions",
      tone: "danger-high" as const,
      help: "Calls still waiting on recording finalization",
    },
    {
      label: "Hidden recordings",
      value: hiddenRecordings,
      href: "/dashboard/admin/sessions",
      tone: "neutral" as const,
      help: "Calls hidden from students",
    },
  ];

  const recentSessions = [...sessions]
    .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime())
    .slice(0, 6);
  const recentRecordings = [...recordings]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 6);

  return (
    <section className="space-y-5">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">System monitoring</p>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950">Platform health and intervention queue</h2>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">
                Review growth, call load, disputes, verifications, and recording visibility before dropping into detailed workflows.
              </p>
            </div>
            <button
              type="button"
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-teal-300 hover:text-teal-700"
              onClick={() => void refresh()}
            >
              Refresh Console
            </button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Users</p>
              <p className="mt-2 text-3xl font-extrabold text-slate-950">{overview?.total_users ?? users.length}</p>
              <p className="mt-2 text-xs text-slate-500">
                {userCounts.student ?? 0} students • {userCounts.mentor ?? 0} mentors • {userCounts.manager ?? 0} managers
              </p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Calls tracked</p>
              <p className="mt-2 text-3xl font-extrabold text-slate-950">{overview?.total_sessions ?? sessions.length}</p>
              <p className="mt-2 text-xs text-slate-500">{instantCalls} instant calls recorded in this workspace</p>
            </article>
            <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Ready recordings</p>
              <p className="mt-2 text-3xl font-extrabold text-emerald-900">{readyRecordings}</p>
              <p className="mt-2 text-xs text-emerald-700">Available for playback or moderation</p>
            </article>
            <article className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Paid payments</p>
              <p className="mt-2 text-3xl font-extrabold text-amber-900">{overview?.paid_payments ?? "-"}</p>
              <p className="mt-2 text-xs text-amber-700">Successful payment records in the system</p>
            </article>
          </div>
        </header>

        <section className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
          <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-950">Operational pulse</h3>
                <p className="text-sm text-slate-600">High-signal counts for what needs action right now.</p>
              </div>
              <Link className="text-sm font-semibold text-teal-700 hover:text-teal-800" href="/dashboard/admin/sessions">
                Open call management
              </Link>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {attentionItems.map((item) => (
                <Link key={item.label} href={item.href} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-teal-200 hover:bg-teal-50/40">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                  <p className={`mt-2 text-3xl font-extrabold ${toneForValue(item.value, item.tone)}`}>{item.value}</p>
                  <p className="mt-2 text-xs text-slate-500">{item.help}</p>
                </Link>
              ))}
            </div>
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold text-slate-950">Session load</h3>
            <p className="text-sm text-slate-600">Live monitoring of where calls are sitting in the funnel.</p>
            <div className="mt-4 space-y-3">
              {[
                ["Pending mentor approval", pendingApprovals],
                ["Ready or in progress", activeCalls],
                ["Completed", statusCounts.completed ?? 0],
                ["Cancelled", statusCounts.cancelled ?? 0],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
                  <span className="text-sm font-medium text-slate-700">{label}</span>
                  <span className="text-lg font-bold text-slate-950">{value}</span>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-950">Recent call activity</h3>
                <p className="text-sm text-slate-600">Latest sessions across the platform with their current state.</p>
              </div>
              <Link className="text-sm font-semibold text-teal-700 hover:text-teal-800" href="/dashboard/admin/analytics">
                Open analytics
              </Link>
            </div>
            <div className="mt-4 space-y-3">
              {recentSessions.map((row) => (
                <div key={row.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{row.title}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {row.student_name} with {row.mentor_name}
                      </p>
                    </div>
                    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${sessionStatusClasses(row.status)}`}>
                      <i className={sessionStatusIcon(row.status)} />
                      {formatSessionStatus(row.status)}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    <span>{formatIstDateTime(row.starts_at)}</span>
                    <span>{formatDuration(row.actual_duration_seconds, row.duration_minutes)}</span>
                  </div>
                </div>
              ))}
              {recentSessions.length === 0 && <p className="text-sm text-slate-500">No sessions recorded yet.</p>}
            </div>
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-950">Recording and dispute watch</h3>
                <p className="text-sm text-slate-600">Surface moderation issues and recent uploaded assets.</p>
              </div>
              <Link className="text-sm font-semibold text-teal-700 hover:text-teal-800" href="/dashboard/admin/disputes">
                Review disputes
              </Link>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Open disputes</p>
                <p className="mt-2 text-3xl font-extrabold text-rose-700">{openDisputes}</p>
                <div className="mt-3 space-y-2 text-sm text-slate-600">
                  {disputes.slice(0, 3).map((row) => (
                    <div key={row.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <p className="font-medium text-slate-900">{row.reason}</p>
                      <p className="text-xs text-slate-500">{formatIstDateTime(row.created_at)}</p>
                    </div>
                  ))}
                  {disputes.length === 0 && <p className="text-sm text-slate-500">No disputes filed.</p>}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Latest recordings</p>
                <p className="mt-2 text-3xl font-extrabold text-slate-950">{recordings.length}</p>
                <div className="mt-3 space-y-2 text-sm text-slate-600">
                  {recentRecordings.slice(0, 3).map((row) => (
                    <div key={row.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <p className="font-medium text-slate-900">{row.title}</p>
                      <p className="text-xs text-slate-500">
                        {row.student_name} • {row.mentor_name} • {row.status}
                      </p>
                    </div>
                  ))}
                  {recordings.length === 0 && <p className="text-sm text-slate-500">No recordings available yet.</p>}
                </div>
              </div>
            </div>
          </article>
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <Link href="/dashboard/admin/system" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-200">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Infra tab</p>
            <h3 className="mt-2 text-lg font-bold text-slate-950">Inspect system stats</h3>
            <p className="mt-2 text-sm text-slate-600">Open API, LiveKit, bucket, and container health in a dedicated system view.</p>
          </Link>
          <Link href="/dashboard/admin/users" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-200">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">User access</p>
            <h3 className="mt-2 text-lg font-bold text-slate-950">Inspect users and roles</h3>
            <p className="mt-2 text-sm text-slate-600">Audit user distribution and jump into user management.</p>
          </Link>
          <Link href="/dashboard/admin/verifications" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-200">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Mentor quality</p>
            <h3 className="mt-2 text-lg font-bold text-slate-950">Work the verification queue</h3>
            <p className="mt-2 text-sm text-slate-600">Approve or reject mentors before they become active for students.</p>
          </Link>
          <Link href="/dashboard/admin/sessions" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-200">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Call controls</p>
            <h3 className="mt-2 text-lg font-bold text-slate-950">Moderate sessions and recordings</h3>
            <p className="mt-2 text-sm text-slate-600">Hide, review, or delete session artifacts for individual students.</p>
          </Link>
        </section>

        {message ? <p className="text-sm text-rose-600">{message}</p> : null}
      </section>
  );
}
