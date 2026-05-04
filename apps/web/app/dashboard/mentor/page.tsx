"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { authedFetch, parseJsonSafe } from "@/lib/api";

type Booking = {
  id: string;
  title: string;
  status: string;
  starts_at: string;
  duration_minutes: number;
  student_id: string;
};

type MentorProfile = {
  mentor_user_id: string;
  headline: string | null;
  exams: string | null;
  years_experience: number;
  hourly_price: number;
  verification_status: string;
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

function statusStyle(status: string): { background: string; border: string; color: string } {
  if (status === "ready_to_join" || status === "in_progress")
    return { background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", color: "#34d399" };
  if (status === "pending_mentor_approval" || status === "pending_manager_approval")
    return { background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", color: "#fbbf24" };
  if (status === "pending_payment")
    return { background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.3)", color: "#60a5fa" };
  if (status === "cancelled" || status === "no_show")
    return { background: "rgba(244,63,94,0.12)", border: "1px solid rgba(244,63,94,0.3)", color: "#fb7185" };
  return { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8" };
}

export default function MentorDashboardPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [studentNames, setStudentNames] = useState<Record<string, string>>({});
  const [categoryOptions, setCategoryOptions] = useState<Array<{ slug: string; name: string }>>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [profile, setProfile] = useState<MentorProfile | null>(null);
  const [headline, setHeadline] = useState("");
  const [exams, setExams] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [years, setYears] = useState(0);
  const [price, setPrice] = useState(0);
  const [profileMsg, setProfileMsg] = useState("");
  const [resourceTitle, setResourceTitle] = useState("");
  const [resourceDesc, setResourceDesc] = useState("");
  const [resourceCategory, setResourceCategory] = useState("");
  const [resourcePrice, setResourcePrice] = useState(0);
  const [resourceFile, setResourceFile] = useState<File | null>(null);
  const [resourceMsg, setResourceMsg] = useState("");
  const [uploadedResources, setUploadedResources] = useState<UploadedResource[]>([]);

  async function refresh() {
    const categoryResp = await authedFetch("/categories");
    const categoryRows = await parseJsonSafe(categoryResp);
    setCategoryOptions(
      Array.isArray(categoryRows)
        ? categoryRows.map((row) => ({ slug: String(row.slug), name: String(row.name) }))
        : [],
    );

    const [rowsResp, meUserResp] = await Promise.all([
      authedFetch("/bookings/mine"),
      authedFetch("/users/me"),
    ]);
    const [rows, meResp] = await Promise.all([parseJsonSafe(rowsResp), parseJsonSafe(meUserResp)]);
    const bookingRows = Array.isArray(rows) ? rows : [];
    setBookings(bookingRows);
    const names: Record<string, string> = {};
    await Promise.all(
      bookingRows.map(async (booking) => {
        const resp = await authedFetch(`/sessions/${booking.id}/participants`);
        const data = await parseJsonSafe(resp);
        if (resp.ok && data?.student?.id) names[data.student.id] = data.student.name ?? data.student.id;
      }),
    );
    setStudentNames(names);

    const uploadedResp = await authedFetch("/resources/mine/uploaded");
    const uploadedData = await parseJsonSafe(uploadedResp);
    setUploadedResources(Array.isArray(uploadedData) ? uploadedData : []);

    if (meResp?.id) {
      const mentorResp = await authedFetch(`/mentors/${meResp.id}`);
      const p = await parseJsonSafe(mentorResp);
      if (p?.mentor_user_id) {
        setProfile(p);
        setHeadline(p.headline ?? "");
        setExams(p.exams ?? "");
        setYears(Number(p.years_experience ?? 0));
        setPrice(Number(p.hourly_price ?? 0));
      }
    }
  }

  async function uploadResource() {
    if (!resourceTitle.trim() || !resourceCategory) {
      setResourceMsg("Title and category are required");
      return;
    }
    let fileKey: string | null = null;
    if (resourceFile) {
      const signResp = await authedFetch("/resources/upload-sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_name: resourceFile.name,
          content_type: resourceFile.type || "application/octet-stream",
        }),
      });
      const signData = await parseJsonSafe(signResp);
      if (!signResp.ok || !signData?.upload_url || !signData?.object_key) {
        setResourceMsg(signData?.detail ?? "Unable to sign upload");
        return;
      }
      await fetch(signData.upload_url, {
        method: "PUT",
        headers: { "Content-Type": resourceFile.type || "application/octet-stream" },
        body: resourceFile,
      });
      fileKey = signData.object_key;
    }

    const createResp = await authedFetch("/resources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: resourceTitle.trim(),
        description: resourceDesc.trim() || null,
        category: resourceCategory,
        price: Number(resourcePrice) || 0,
        file_key: fileKey,
      }),
    });
    const created = await parseJsonSafe(createResp);
    if (!createResp.ok) { setResourceMsg(created?.detail ?? "Unable to create resource"); return; }
    setResourceMsg(`Resource created: ${created.title}`);
    setResourceTitle(""); setResourceDesc(""); setResourceCategory("");
    setResourcePrice(0); setResourceFile(null);
    await refresh();
  }

  async function toggleResource(resource: UploadedResource) {
    const resp = await authedFetch(`/resources/${resource.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...resource, is_active: !resource.is_active }),
    });
    const data = await parseJsonSafe(resp);
    setResourceMsg(resp.ok ? `Updated ${data.title}` : (data?.detail ?? "Unable to update"));
    await refresh();
  }

  async function updatePrice(resource: UploadedResource, nextPrice: number) {
    const resp = await authedFetch(`/resources/${resource.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...resource, price: nextPrice }),
    });
    const data = await parseJsonSafe(resp);
    setResourceMsg(resp.ok ? `Updated ${data.title}` : (data?.detail ?? "Unable to update price"));
    await refresh();
  }

  async function deleteResource(resourceId: string) {
    const resp = await authedFetch(`/resources/${resourceId}`, { method: "DELETE" });
    const data = await parseJsonSafe(resp);
    setResourceMsg(resp.ok ? "Resource deleted" : (data?.detail ?? "Unable to delete"));
    await refresh();
  }

  async function approveSession(sessionId: string) {
    setBusy(sessionId);
    await authedFetch(`/sessions/${sessionId}/approve`, { method: "POST" });
    setBusy(null);
    await refresh();
  }

  async function saveProfile() {
    const query = new URLSearchParams({
      headline,
      exams,
      years_experience: String(years || 0),
      hourly_price: String(price || 0),
    });
    const resp = await authedFetch(`/mentors/me?${query.toString()}`, { method: "PUT" });
    const data = await parseJsonSafe(resp);
    if (resp.ok) { setProfile(data); setProfileMsg("Mentor profile updated"); }
    else setProfileMsg(data?.detail ?? "Unable to update mentor profile");
  }

  useEffect(() => { void refresh(); }, []);

  const examList = exams.split(",").map((x) => x.trim()).filter(Boolean);

  function addCategory(slug: string) {
    if (!slug || examList.includes(slug)) return;
    setExams([...examList, slug].join(","));
    setSelectedCategory("");
  }

  function removeCategory(slug: string) {
    setExams(examList.filter((x) => x !== slug).join(","));
  }

  return (
    <>
      <div className="space-y-4">
        {/* Mentor profile card */}
        <article className="app-card p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-bold text-white">Your Mentor Profile</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                Configure your categories and pricing visible to students.
              </p>
            </div>
            {profile && (
              <span
                className="rounded-full px-3 py-1 text-[11px] font-semibold capitalize"
                style={{
                  background: profile.verification_status === "approved"
                    ? "rgba(16,185,129,0.12)"
                    : "rgba(245,158,11,0.12)",
                  border: profile.verification_status === "approved"
                    ? "1px solid rgba(16,185,129,0.3)"
                    : "1px solid rgba(245,158,11,0.3)",
                  color: profile.verification_status === "approved" ? "#34d399" : "#fbbf24",
                }}
              >
                {profile.verification_status}
              </span>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Headline</span>
              <input
                className="input-dark"
                placeholder="e.g. IIT Delhi, JEE AIR 47"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
              />
            </label>

            <div
              className="rounded-xl p-3"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Exam Categories
              </p>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {examList.map((slug) => (
                  <button
                    key={slug}
                    type="button"
                    className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-violet-300 transition hover:text-rose-400"
                    style={{ background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.2)" }}
                    onClick={() => removeCategory(slug)}
                  >
                    {slug} &times;
                  </button>
                ))}
                {examList.length === 0 && (
                  <span className="text-xs text-slate-500">No categories selected</span>
                )}
              </div>
              <select
                className="input-dark"
                value={selectedCategory}
                onChange={(e) => { setSelectedCategory(e.target.value); addCategory(e.target.value); }}
              >
                <option value="">Add category...</option>
                {categoryOptions.filter((item) => !examList.includes(item.slug)).map((item) => (
                  <option key={item.slug} value={item.slug}>{item.name}</option>
                ))}
              </select>
            </div>

            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Experience (years)</span>
              <input
                className="input-dark"
                type="number"
                min={0}
                value={years}
                onChange={(e) => setYears(Number(e.target.value))}
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Hourly Price (₹)</span>
              <input
                className="input-dark"
                type="number"
                min={0}
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
              />
            </label>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              className="rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:from-violet-500 hover:to-blue-500"
              onClick={() => void saveProfile()}
            >
              Save Profile
            </button>
            {profileMsg && (
              <span className="text-sm text-slate-400">{profileMsg}</span>
            )}
          </div>
        </article>

        {/* Publish resource */}
        <article className="app-card p-6">
          <h2 className="mb-1 font-bold text-white">
            <i className="fa-solid fa-cloud-arrow-up mr-2 text-blue-400" />
            Publish Study Resource
          </h2>
          <p className="mb-4 text-sm text-slate-500">
            Upload notes, sheets, or videos and attach them to an exam category.
          </p>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Title</span>
              <input className="input-dark" placeholder="Resource title" value={resourceTitle} onChange={(e) => setResourceTitle(e.target.value)} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Category</span>
              <select className="input-dark" value={resourceCategory} onChange={(e) => setResourceCategory(e.target.value)}>
                <option value="">Select category</option>
                {categoryOptions.map((item) => (
                  <option key={item.slug} value={item.slug}>{item.name}</option>
                ))}
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Price (₹, 0 = free)</span>
              <input className="input-dark" type="number" min={0} value={resourcePrice} onChange={(e) => setResourcePrice(Number(e.target.value))} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">File (optional)</span>
              <input
                className="input-dark file:mr-3 file:rounded-lg file:border-0 file:bg-violet-500/20 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-violet-300"
                type="file"
                onChange={(e) => setResourceFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <label className="block space-y-1.5 md:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Description</span>
              <textarea className="input-dark min-h-[80px] resize-y" placeholder="Short description..." value={resourceDesc} onChange={(e) => setResourceDesc(e.target.value)} />
            </label>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              className="rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-4 py-2 text-sm font-bold text-white transition hover:from-blue-500 hover:to-cyan-500"
              onClick={() => void uploadResource()}
            >
              <i className="fa-solid fa-cloud-arrow-up mr-2" />
              Publish Resource
            </button>
            {resourceMsg && <span className="text-sm text-slate-400">{resourceMsg}</span>}
          </div>
        </article>

        {/* My uploaded resources */}
        {uploadedResources.length > 0 && (
          <article className="app-card p-6">
            <h2 className="mb-4 font-bold text-white">
              <i className="fa-solid fa-table-list mr-2 text-cyan-400" />
              My Uploaded Resources
            </h2>
            <div className="space-y-3">
              {uploadedResources.map((row) => (
                <div
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl p-4"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-white">{row.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {row.category || "uncategorized"} &bull;{" "}
                      {new Date(row.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                      style={
                        row.is_active
                          ? { background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", color: "#34d399" }
                          : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#64748b" }
                      }
                    >
                      {row.is_active ? "Active" : "Disabled"}
                    </span>
                    <input
                      className="input-dark w-24 text-sm"
                      type="number"
                      min={0}
                      defaultValue={row.price}
                      onBlur={(e) => void updatePrice(row, Number(e.target.value) || 0)}
                    />
                    <button
                      className="rounded-xl border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-400 transition hover:border-white/20 hover:text-white"
                      onClick={() => void toggleResource(row)}
                    >
                      {row.is_active ? "Disable" : "Enable"}
                    </button>
                    <button
                      className="rounded-xl border border-rose-500/20 px-3 py-1.5 text-xs font-semibold text-rose-400 transition hover:bg-rose-500/10"
                      onClick={() => void deleteResource(row.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </article>
        )}

        {/* Bookings */}
        {bookings.length > 0 ? (
          <div className="space-y-3">
            <h2 className="font-bold text-white">
              <i className="fa-solid fa-calendar-days mr-2 text-violet-400" />
              Your Sessions
            </h2>
            {bookings.map((booking) => (
              <article key={booking.id} className="app-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-white">{booking.title}</h3>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {new Date(booking.starts_at).toLocaleString()} &bull; {booking.duration_minutes} min
                    </p>
                    <p className="text-sm text-slate-500">
                      Student: {studentNames[booking.student_id] ?? booking.student_id}
                    </p>
                  </div>
                  <span
                    className="rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize"
                    style={statusStyle(booking.status)}
                  >
                    {booking.status.replaceAll("_", " ")}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {booking.status === "pending_mentor_approval" && (
                    <button
                      type="button"
                      onClick={() => void approveSession(booking.id)}
                      disabled={busy === booking.id}
                      className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-sm font-bold text-white transition hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50"
                    >
                      Approve Request
                    </button>
                  )}
                  {["confirmed", "ready_to_join", "in_progress"].includes(booking.status) && (
                    <Link
                      href={`/dashboard/sessions/${booking.id}`}
                      className="rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:from-violet-500 hover:to-blue-500"
                    >
                      Join Call
                    </Link>
                  )}
                  <Link
                    href={`/dashboard/sessions/${booking.id}`}
                    className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-400 transition hover:border-white/20 hover:text-white"
                  >
                    Open Review
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No sessions assigned yet.</p>
        )}
      </div>
    </>
  );
}
