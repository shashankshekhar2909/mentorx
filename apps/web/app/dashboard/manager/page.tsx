"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { DashboardShell } from "@/components/dashboard-shell";
import { authedFetch, parseJsonSafe } from "@/lib/api";

type Overview = {
  total_users: number;
  total_sessions: number;
  pending_mentor_verifications: number;
  paid_payments: number;
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

export default function ManagerDashboardPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [categories, setCategories] = useState<Array<{ slug: string; name: string }>>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [uploadedResources, setUploadedResources] = useState<UploadedResource[]>([]);

  async function refresh() {
    authedFetch("/admin/overview")
      .then((r) => parseJsonSafe(r))
      .then((data) => setOverview(data?.total_users !== undefined ? data : null))
      .catch(() => setOverview(null));
    authedFetch("/categories")
      .then((r) => parseJsonSafe(r))
      .then((rows) =>
        setCategories(
          Array.isArray(rows) ? rows.map((row) => ({ slug: String(row.slug), name: String(row.name) })) : [],
        ),
      );
    const uploadedResp = await authedFetch("/resources/mine/uploaded");
    const uploadedData = await parseJsonSafe(uploadedResp);
    setUploadedResources(Array.isArray(uploadedData) ? uploadedData : []);
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

  return (
    <DashboardShell role="manager" title="Manager Dashboard">
      <div className="grid gap-4 md:grid-cols-3">
        <article className="rounded-xl bg-card p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Verification Queue</h2>
          <p className="mt-2 text-sm text-black/70">Pending mentors: {overview?.pending_mentor_verifications ?? "-"}</p>
          <Link className="mt-3 inline-block rounded-md bg-accent px-3 py-1.5 text-sm text-white" href="/dashboard/admin/verifications">
            Open Verifications
          </Link>
        </article>
        <article className="rounded-xl bg-card p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Dispute Desk</h2>
          <p className="mt-2 text-sm text-black/70">Review and resolve active disputes.</p>
          <Link className="mt-3 inline-block rounded-md border px-3 py-1.5 text-sm" href="/dashboard/admin/disputes">
            Open Disputes
          </Link>
        </article>
        <article className="rounded-xl bg-card p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Live Sessions</h2>
          <p className="mt-2 text-sm text-black/70">Managers can review calls/chats and join support directly from sessions list.</p>
          <Link className="mt-3 inline-block rounded-md border px-3 py-1.5 text-sm" href="/dashboard/admin/sessions">
            Open Sessions
          </Link>
        </article>
        <article className="rounded-xl bg-card p-5 shadow-sm md:col-span-3">
          <h2 className="text-lg font-semibold"><i className="fa-solid fa-file-circle-plus mr-2 text-accent" />Upload Study Material</h2>
          <p className="mt-1 text-sm text-black/70">Managers can publish resources with predefined categories for student purchase/access.</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <input className="rounded border px-3 py-2" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <select className="rounded border px-3 py-2" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Select category</option>
              {categories.map((item) => (
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
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
            />
            <input className="rounded border px-3 py-2" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <textarea
              className="rounded border px-3 py-2 md:col-span-2"
              placeholder="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <button className="mt-3 rounded-md bg-accent px-3 py-1.5 text-sm text-white" onClick={() => void uploadResource()}>
            <i className="fa-solid fa-cloud-arrow-up mr-2" />
            Publish Resource
          </button>
          {message && <p className="mt-2 text-sm text-slate-700">{message}</p>}
        </article>
        <article className="rounded-xl bg-card p-5 shadow-sm md:col-span-3">
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
      </div>
    </DashboardShell>
  );
}
