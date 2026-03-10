"use client";

import { useEffect, useState } from "react";

import { DashboardShell } from "@/components/dashboard-shell";
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

    const [rowsResp, meUserResp] = await Promise.all([authedFetch("/bookings/mine"), authedFetch("/users/me")]);
    const [rows, meResp] = await Promise.all([parseJsonSafe(rowsResp), parseJsonSafe(meUserResp)]);
    const bookingRows = Array.isArray(rows) ? rows : [];
    setBookings(bookingRows);
    const names: Record<string, string> = {};
    await Promise.all(
      bookingRows.map(async (booking) => {
        const resp = await authedFetch(`/sessions/${booking.id}/participants`);
        const data = await parseJsonSafe(resp);
        if (resp.ok && data?.student?.id) {
          names[data.student.id] = data.student.name ?? data.student.id;
        }
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
        body: JSON.stringify({ file_name: resourceFile.name, content_type: resourceFile.type || "application/octet-stream" }),
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
    if (!createResp.ok) {
      setResourceMsg(created?.detail ?? "Unable to create resource");
      return;
    }
    setResourceMsg(`Resource created: ${created.title}`);
    setResourceTitle("");
    setResourceDesc("");
    setResourceCategory("");
    setResourcePrice(0);
    setResourceFile(null);
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
    setResourceMsg(resp.ok ? `Updated ${data.title}` : (data?.detail ?? "Unable to update resource"));
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
    setResourceMsg(resp.ok ? `Updated ${data.title}` : (data?.detail ?? "Unable to update price"));
    await refresh();
  }

  async function deleteResource(resourceId: string) {
    const resp = await authedFetch(`/resources/${resourceId}`, { method: "DELETE" });
    const data = await parseJsonSafe(resp);
    setResourceMsg(resp.ok ? "Resource deleted" : (data?.detail ?? "Unable to delete resource"));
    await refresh();
  }

  async function startRecording(sessionId: string) {
    setBusy(sessionId);
    await authedFetch("/sessions/recordings/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId }),
    });
    setBusy(null);
  }

  async function completeRecording(sessionId: string) {
    setBusy(sessionId);
    await authedFetch("/sessions/recordings/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, object_key: `recordings/${sessionId}.mp4` }),
    });
    setBusy(null);
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
    if (resp.ok) {
      setProfile(data);
      setProfileMsg("Mentor profile updated");
    } else {
      setProfileMsg(data?.detail ?? "Unable to update mentor profile");
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const examList = exams
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  function addCategory(slug: string) {
    if (!slug) return;
    if (examList.includes(slug)) return;
    setExams([...examList, slug].join(","));
    setSelectedCategory("");
  }

  function removeCategory(slug: string) {
    setExams(examList.filter((x) => x !== slug).join(","));
  }

  return (
    <DashboardShell role="mentor" title="Mentor Dashboard">
      <div className="space-y-4">
        <article className="app-card p-5">
          <h2 className="text-lg font-semibold">Your Mentor Profile</h2>
          <p className="mt-1 text-sm text-slate-600">
            Configure categories/subjects and pricing that students see.
          </p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Headline" value={headline} onChange={(e) => setHeadline(e.target.value)} />
            <div className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <p className="mb-2 text-xs text-slate-500">Categories</p>
              <div className="mb-2 flex flex-wrap gap-2">
                {examList.map((slug) => (
                  <button
                    key={slug}
                    type="button"
                    className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs"
                    onClick={() => removeCategory(slug)}
                  >
                    {slug} ×
                  </button>
                ))}
                {examList.length === 0 && <span className="text-xs text-slate-400">No categories selected</span>}
              </div>
              <select
                className="w-full rounded border px-2 py-1.5"
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  addCategory(e.target.value);
                }}
              >
                <option value="">Select category</option>
                {categoryOptions
                  .filter((item) => !examList.includes(item.slug))
                  .map((item) => (
                    <option key={item.slug} value={item.slug}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </div>
            <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Experience in years" type="number" min={0} value={years} onChange={(e) => setYears(Number(e.target.value))} />
            <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Hourly price" type="number" min={0} value={price} onChange={(e) => setPrice(Number(e.target.value))} />
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-white" onClick={() => void saveProfile()}>
              Save Profile
            </button>
            <span className="text-xs text-slate-600">
              Verification: {profile?.verification_status ?? "unknown"}
            </span>
          </div>
          {profileMsg && <p className="mt-2 text-sm text-slate-700">{profileMsg}</p>}
        </article>

        <article className="app-card p-5">
          <h2 className="text-lg font-semibold"><i className="fa-solid fa-book mr-2 text-accent" />Publish Study Resource</h2>
          <p className="mt-1 text-sm text-slate-600">Upload notes/sheets/videos and attach a predefined exam category.</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <input className="rounded border px-3 py-2" placeholder="Title" value={resourceTitle} onChange={(e) => setResourceTitle(e.target.value)} />
            <select className="rounded border px-3 py-2" value={resourceCategory} onChange={(e) => setResourceCategory(e.target.value)}>
              <option value="">Select category</option>
              {categoryOptions.map((item) => (
                <option key={item.slug} value={item.slug}>
                  {item.name}
                </option>
              ))}
            </select>
            <input
              className="rounded border px-3 py-2"
              placeholder="Price"
              type="number"
              min={0}
              value={resourcePrice}
              onChange={(e) => setResourcePrice(Number(e.target.value))}
            />
            <input className="rounded border px-3 py-2" type="file" onChange={(e) => setResourceFile(e.target.files?.[0] ?? null)} />
            <textarea className="rounded border px-3 py-2 md:col-span-2" placeholder="Description" value={resourceDesc} onChange={(e) => setResourceDesc(e.target.value)} />
          </div>
          <button className="mt-3 rounded-md bg-accent px-3 py-1.5 text-sm text-white" onClick={() => void uploadResource()}>
            <i className="fa-solid fa-cloud-arrow-up mr-2" />
            Publish Resource
          </button>
          {resourceMsg && <p className="mt-2 text-sm text-slate-700">{resourceMsg}</p>}
        </article>

        <article className="app-card p-5">
          <h2 className="text-lg font-semibold"><i className="fa-solid fa-table-list mr-2 text-accent" />My Uploaded Resources</h2>
          <div className="mt-3 space-y-2">
            {uploadedResources.map((row) => (
              <div key={row.id} className="rounded-md border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{row.title}</p>
                    <p className="text-xs text-slate-500">
                      {row.category || "uncategorized"} • {new Date(row.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`rounded px-2 py-1 text-xs ${row.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                    {row.is_active ? "Enabled" : "Disabled"}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    className="w-28 rounded border px-2 py-1"
                    type="number"
                    min={0}
                    defaultValue={row.price}
                    onBlur={(e) => void updatePrice(row, Number(e.target.value) || 0)}
                  />
                  <button className="rounded border px-2 py-1" onClick={() => void toggleResource(row)}>
                    {row.is_active ? "Disable" : "Enable"}
                  </button>
                  <button className="rounded border px-2 py-1 text-red-600" onClick={() => void deleteResource(row.id)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
            {uploadedResources.length === 0 && <p className="text-sm text-slate-500">No uploaded resources yet.</p>}
          </div>
        </article>

        {bookings.map((booking) => (
          <article key={booking.id} className="app-card p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">{booking.title}</h2>
                <p className="text-xs text-slate-500">{new Date(booking.starts_at).toLocaleString()} • {booking.duration_minutes} min</p>
                <p className="text-xs text-slate-500">Student: {studentNames[booking.student_id] ?? booking.student_id}</p>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                {booking.status}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {booking.status === "pending_mentor_approval" && (
                <button
                  type="button"
                  onClick={() => approveSession(booking.id)}
                  disabled={busy === booking.id}
                  className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Approve Request
                </button>
              )}
              <button
                type="button"
                onClick={() => startRecording(booking.id)}
                disabled={busy === booking.id}
                className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
              >
                Start Recording
              </button>
              <button
                type="button"
                onClick={() => completeRecording(booking.id)}
                disabled={busy === booking.id}
                className="rounded-md bg-accent px-3 py-1.5 text-sm text-white"
              >
                Mark Recording Uploaded
              </button>
              {["confirmed", "ready_to_join", "in_progress"].includes(booking.status) && (
                <a className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm text-white" href={`/dashboard/sessions/${booking.id}`}>Join Call</a>
              )}
              <a className="rounded-md border px-3 py-1.5 text-sm" href={`/dashboard/sessions/${booking.id}`}>Open Session Hub</a>
            </div>
          </article>
        ))}
        {bookings.length === 0 && <p className="text-sm text-black/60">No sessions assigned yet.</p>}
      </div>
    </DashboardShell>
  );
}
