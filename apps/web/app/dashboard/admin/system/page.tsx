"use client";

import { useEffect, useMemo, useState } from "react";

import { authedFetch, parseJsonSafe } from "@/lib/api";

type ServiceHealth = {
  ok: boolean;
  status: string;
  error?: string;
  [key: string]: unknown;
};

type ContainerSnapshot = {
  available: boolean;
  status: string;
  reason?: string;
  containers: Array<{
    name: string;
    image: string;
    state: string;
    status: string;
  }>;
};

type SystemStats = {
  api: ServiceHealth;
  livekit: ServiceHealth;
  bucket: ServiceHealth;
  usage: {
    users: {
      total: number;
      by_role: Record<string, number>;
    };
    sessions: {
      total: number;
      by_status: Record<string, number>;
    };
    recordings: {
      total: number;
      by_status: Record<string, number>;
      stored_bytes: number;
    };
    resources: {
      total: number;
      active: number;
    };
  };
};

function statusTone(ok: boolean): string {
  return ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-rose-200 bg-rose-50 text-rose-900";
}

function formatBytes(value: number): string {
  if (!value || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(size >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

export default function AdminSystemPage() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [message, setMessage] = useState("");

  async function refresh() {
    const resp = await authedFetch("/admin/system-stats");
    const data = await parseJsonSafe(resp);
    if (!resp.ok) {
      setStats(null);
      setMessage(data?.detail ?? "Unable to load system stats");
      return;
    }
    setStats(data as SystemStats);
    setMessage("");
  }

  useEffect(() => {
    void refresh();
  }, []);

  const serviceCards = useMemo(() => {
    if (!stats) return [];
    return [
      {
        title: "API",
        subtitle: "Backend availability",
        payload: stats.api,
        details: [
          `Status: ${stats.api.status}`,
        ],
      },
      {
        title: "LiveKit",
        subtitle: "Calls and egress provider",
        payload: stats.livekit,
        details: [
          `Server: ${String(stats.livekit.url ?? "-")}`,
          `Public: ${String(stats.livekit.public_url ?? "-")}`,
          `Active rooms: ${String(stats.livekit.active_rooms ?? "-")}`,
        ],
      },
      {
        title: "Bucket",
        subtitle: "Recording and document storage",
        payload: stats.bucket,
        details: [
          `Bucket: ${String(stats.bucket.bucket ?? "-")}`,
          `Endpoint: ${String(stats.bucket.endpoint ?? "-")}`,
          `Region: ${String(stats.bucket.region ?? "-")}`,
        ],
      },
    ];
  }, [stats]);

  return (
    <section className="space-y-5">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Infrastructure view</p>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950">System health, storage, and service reachability</h2>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">
                Use this page for infra checks. Operational reviews stay on the main admin console.
              </p>
            </div>
            <button
              type="button"
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-teal-300 hover:text-teal-700"
              onClick={() => void refresh()}
            >
              Refresh System Stats
            </button>
          </div>
        </header>

        <section className="grid gap-4 xl:grid-cols-3">
          {serviceCards.map((card) => (
            <article key={card.title} className={`rounded-3xl border p-5 shadow-sm ${statusTone(card.payload.ok)}`}>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-70">{card.subtitle}</p>
              <h3 className="mt-2 text-xl font-bold">{card.title}</h3>
              <p className="mt-2 text-sm font-semibold">{card.payload.ok ? "Healthy" : "Attention needed"}</p>
              <div className="mt-4 space-y-2 text-sm">
                {card.details.map((detail) => (
                  <p key={detail}>{detail}</p>
                ))}
                {card.payload.error ? <p className="font-medium">Error: {card.payload.error}</p> : null}
              </div>
            </article>
          ))}
        </section>

        <section className="grid gap-4">
          <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold text-slate-950">Usage snapshot</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Users</p>
                <p className="mt-2 text-3xl font-extrabold text-slate-950">{stats?.usage.users.total ?? "-"}</p>
                <p className="mt-2 text-xs text-slate-500">
                  {Object.entries(stats?.usage.users.by_role ?? {}).map(([role, count]) => `${role}: ${count}`).join(" • ") || "No role data"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Sessions</p>
                <p className="mt-2 text-3xl font-extrabold text-slate-950">{stats?.usage.sessions.total ?? "-"}</p>
                <p className="mt-2 text-xs text-slate-500">
                  {Object.entries(stats?.usage.sessions.by_status ?? {}).map(([status, count]) => `${status}: ${count}`).join(" • ") || "No session data"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Recordings</p>
                <p className="mt-2 text-3xl font-extrabold text-slate-950">{stats?.usage.recordings.total ?? "-"}</p>
                <p className="mt-2 text-xs text-slate-500">Stored bytes: {formatBytes(stats?.usage.recordings.stored_bytes ?? 0)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Resources</p>
                <p className="mt-2 text-3xl font-extrabold text-slate-950">{stats?.usage.resources.total ?? "-"}</p>
                <p className="mt-2 text-xs text-slate-500">Active: {stats?.usage.resources.active ?? "-"}</p>
              </div>
            </div>
          </article>
        </section>

        {message ? <p className="text-sm text-rose-600">{message}</p> : null}
      </section>
  );
}
