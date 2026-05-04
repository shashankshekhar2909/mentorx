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

type VerificationRow = {
  mentor_user_id: string;
  status: string;
  headline: string | null;
  exams: string | null;
};

type DisputeRow = {
  id: string;
  status: string;
  reason: string;
  created_at: string;
};

type UploadedResource = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  price: number;
  is_active: boolean;
  created_at: string;
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

export default function ManagerDashboardPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [categories, setCategories] = useState<Array<{ slug: string; name: string }>>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [verifications, setVerifications] = useState<VerificationRow[]>([]);
  const [disputes, setDisputes] = useState<DisputeRow[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [uploadedResources, setUploadedResources] = useState<UploadedResource[]>([]);

  async function refresh() {
    const [overviewResp, categoriesResp, sessionsResp, verificationsResp, disputesResp, uploadedResp] = await Promise.all([
      authedFetch("/admin/overview"),
      authedFetch("/categories"),
      authedFetch("/admin/sessions"),
      authedFetch("/admin/mentor-verifications"),
      authedFetch("/admin/disputes"),
      authedFetch("/resources/mine/uploaded"),
    ]);
    const [overviewData, categoriesData, sessionsData, verificationsData, disputesData, uploadedData] = await Promise.all([
      parseJsonSafe(overviewResp),
      parseJsonSafe(categoriesResp),
      parseJsonSafe(sessionsResp),
      parseJsonSafe(verificationsResp),
      parseJsonSafe(disputesResp),
      parseJsonSafe(uploadedResp),
    ]);

    setOverview(overviewResp.ok && overviewData?.total_users !== undefined ? overviewData : null);
    setCategories(
      Array.isArray(categoriesData)
        ? categoriesData.map((row) => ({ slug: String(row.slug), name: String(row.name) }))
        : [],
    );
    setSessions(sessionsResp.ok && Array.isArray(sessionsData) ? sessionsData : []);
    setVerifications(verificationsResp.ok && Array.isArray(verificationsData) ? verificationsData : []);
    setDisputes(disputesResp.ok && Array.isArray(disputesData) ? disputesData : []);
    setUploadedResources(uploadedResp.ok && Array.isArray(uploadedData) ? uploadedData : []);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function uploadResource() {
    if (!title.trim() || !category) {
      setMessage("Title and category are required");
      return;
    }
    let fileKey: string | null = null;
    if (file) {
      const signResp = await authedFetch("/resources/upload-sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_name: file.name, content_type: file.type || "application/octet-stream" }),
      });
      const signData = await parseJsonSafe(signResp);
      if (!signResp.ok || !signData?.upload_url || !signData?.object_key) {
        setMessage(signData?.detail ?? "Unable to sign upload");
        return;
      }
      await fetch(signData.upload_url, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      fileKey = signData.object_key;
    }

    const createResp = await authedFetch("/resources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        description: description.trim() || null,
        category,
        price: Number(price) || 0,
        file_key: fileKey,
      }),
    });
    const created = await parseJsonSafe(createResp);
    if (!createResp.ok) {
      setMessage(created?.detail ?? "Unable to create resource");
      return;
    }
    setMessage(`Resource created: ${created.title}`);
    setTitle("");
    setDescription("");
    setPrice(0);
    setFile(null);
    await refresh();
  }

  async function toggleResource(resource: UploadedResource) {
    const resp = await authedFetch(`/resources/${resource.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: resource.title,
        description: resource.description,
        category: resource.category,
        price: resource.price,
        is_active: !resource.is_active,
      }),
    });
    const data = await parseJsonSafe(resp);
    setMessage(resp.ok ? `Updated ${data.title}` : (data?.detail ?? "Unable to update resource"));
    await refresh();
  }

  async function updatePrice(resource: UploadedResource, nextPrice: number) {
    const resp = await authedFetch(`/resources/${resource.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: resource.title,
        description: resource.description,
        category: resource.category,
        price: nextPrice,
        is_active: resource.is_active,
      }),
    });
    const data = await parseJsonSafe(resp);
    setMessage(resp.ok ? `Updated ${data.title}` : (data?.detail ?? "Unable to update price"));
    await refresh();
  }

  async function deleteResource(resourceId: string) {
    const resp = await authedFetch(`/resources/${resourceId}`, { method: "DELETE" });
    const data = await parseJsonSafe(resp);
    setMessage(resp.ok ? "Resource deleted" : (data?.detail ?? "Unable to delete resource"));
    await refresh();
  }

  const pendingVerifications = verifications.filter((row) => row.status === "pending").length;
  const liveOrReadyCalls = sessions.filter((row) => ["confirmed", "ready_to_join", "in_progress"].includes(row.status)).length;
  const openDisputes = disputes.filter((row) => row.status !== "resolved").length;
  const activeResources = uploadedResources.filter((row) => row.is_active).length;
  const instantCalls = sessions.filter((row) => row.is_instant).length;

  const upcomingSessions = useMemo(
    () => [...sessions].sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime()).slice(0, 6),
    [sessions],
  );
  const recentResources = useMemo(
    () => [...uploadedResources].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 6),
    [uploadedResources],
  );

  return (
    <>
      <section className="space-y-5">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Operations view</p>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950">Category monitoring and content controls</h2>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">
                Track mentor onboarding, active calls, disputes, and study material health before jumping into publishing workflows.
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

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Scoped users</p>
              <p className="mt-2 text-3xl font-extrabold text-slate-950">{overview?.total_users ?? "-"}</p>
              <p className="mt-2 text-xs text-slate-500">Users visible within this manager scope</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Calls monitored</p>
              <p className="mt-2 text-3xl font-extrabold text-slate-950">{overview?.total_sessions ?? sessions.length}</p>
              <p className="mt-2 text-xs text-slate-500">{instantCalls} instant calls in current scope</p>
            </article>
            <article className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Pending mentor approvals</p>
              <p className="mt-2 text-3xl font-extrabold text-amber-900">{pendingVerifications}</p>
              <p className="mt-2 text-xs text-amber-700">Mentors waiting in assigned categories</p>
            </article>
            <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Live or ready calls</p>
              <p className="mt-2 text-3xl font-extrabold text-emerald-900">{liveOrReadyCalls}</p>
              <p className="mt-2 text-xs text-emerald-700">Calls needing support coverage</p>
            </article>
            <article className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Active resources</p>
              <p className="mt-2 text-3xl font-extrabold text-sky-900">{activeResources}</p>
              <p className="mt-2 text-xs text-sky-700">Published study materials currently enabled</p>
            </article>
          </div>
        </header>

        <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-950">Queue health</h3>
                <p className="text-sm text-slate-600">Fast view into the workflows that need manager intervention.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700" href="/dashboard/admin/verifications">
                  Verifications
                </Link>
                <Link className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700" href="/dashboard/admin/sessions">
                  Sessions
                </Link>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Disputes</p>
                <p className="mt-2 text-3xl font-extrabold text-rose-700">{openDisputes}</p>
                <p className="mt-2 text-xs text-slate-500">Open cases in your scope</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Draft or disabled resources</p>
                <p className="mt-2 text-3xl font-extrabold text-slate-950">{uploadedResources.length - activeResources}</p>
                <p className="mt-2 text-xs text-slate-500">Materials still not live for students</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Pending call approvals</p>
                <p className="mt-2 text-3xl font-extrabold text-slate-950">
                  {sessions.filter((row) => row.status === "pending_mentor_approval").length}
                </p>
                <p className="mt-2 text-xs text-slate-500">Students waiting for a mentor response</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Paid orders</p>
                <p className="mt-2 text-3xl font-extrabold text-slate-950">{overview?.paid_payments ?? "-"}</p>
                <p className="mt-2 text-xs text-slate-500">Payment records visible to managers</p>
              </div>
            </div>
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold text-slate-950">Recent disputes and mentor queue</h3>
            <p className="text-sm text-slate-600">Use this to spot categories falling behind.</p>
            <div className="mt-4 space-y-3">
              {verifications.slice(0, 3).map((row) => (
                <div key={row.mentor_user_id} className="rounded-2xl border border-slate-200 p-4">
                  <p className="font-semibold text-slate-900">{row.headline || row.mentor_user_id}</p>
                  <p className="mt-1 text-xs text-slate-500">{row.exams || "No categories listed"}</p>
                  <p className="mt-2 text-sm text-slate-700">Status: {row.status}</p>
                </div>
              ))}
              {verifications.length === 0 && <p className="text-sm text-slate-500">No mentor verification items in your scope.</p>}
            </div>
          </article>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-950">Recent calls</h3>
                <p className="text-sm text-slate-600">Latest sessions inside your monitored categories.</p>
              </div>
              <Link className="text-sm font-semibold text-teal-700 hover:text-teal-800" href="/dashboard/admin/sessions">
                Open session monitor
              </Link>
            </div>
            <div className="mt-4 space-y-3">
              {upcomingSessions.map((row) => (
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
              {upcomingSessions.length === 0 && <p className="text-sm text-slate-500">No sessions yet in this scope.</p>}
            </div>
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-950">Resource monitoring</h3>
                <p className="text-sm text-slate-600">Recent uploads and pricing controls.</p>
              </div>
              <Link className="text-sm font-semibold text-teal-700 hover:text-teal-800" href="/dashboard/recordings">
                Open recordings
              </Link>
            </div>
            <div className="mt-4 space-y-3">
              {recentResources.map((row) => (
                <div key={row.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{row.title}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {row.category || "uncategorized"} • {new Date(row.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${row.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                      {row.is_active ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <input
                      className="w-28 rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      type="number"
                      min={0}
                      defaultValue={row.price}
                      onBlur={(event) => void updatePrice(row, Number(event.target.value) || 0)}
                    />
                    <button className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700" onClick={() => void toggleResource(row)}>
                      {row.is_active ? "Disable" : "Enable"}
                    </button>
                    <button className="rounded-xl border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-600" onClick={() => void deleteResource(row.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              {recentResources.length === 0 && <p className="text-sm text-slate-500">No uploaded resources yet.</p>}
            </div>
          </article>
        </section>

        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-slate-950">Publish study material</h3>
              <p className="text-sm text-slate-600">Operational tools are above; publishing stays here so the landing page remains a monitoring console first.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <select className="rounded-xl border border-slate-300 px-3 py-2" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Select category</option>
              {categories.map((item) => (
                <option key={item.slug} value={item.slug}>
                  {item.name}
                </option>
              ))}
            </select>
            <input
              className="rounded-xl border border-slate-300 px-3 py-2"
              placeholder="Price"
              type="number"
              min={0}
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
            />
            <input className="rounded-xl border border-slate-300 px-3 py-2" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <textarea
              className="rounded-xl border border-slate-300 px-3 py-2 md:col-span-2"
              placeholder="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            {message ? <p className="text-sm text-slate-600">{message}</p> : <span className="text-sm text-slate-500">Upload documents, videos, or notes into a tracked category.</span>}
            <button className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white" onClick={() => void uploadResource()}>
              Publish Resource
            </button>
          </div>
        </article>
      </section>
    </>
  );
}
