"use client";

import { useEffect, useState } from "react";

import { authedFetch, parseJsonSafe } from "@/lib/api";

type Category = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
};

export default function AdminCategoriesPage() {
  const [rows, setRows] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");

  async function refresh() {
    const resp = await authedFetch("/categories?active_only=false");
    const data = await parseJsonSafe(resp);
    setRows(Array.isArray(data) ? data : []);
  }

  async function createCategory() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const resp = await authedFetch("/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    const data = await parseJsonSafe(resp);
    if (!resp.ok) {
      setMessage(data?.detail ?? "Failed to create category");
      return;
    }
    setName("");
    setMessage(`Created ${data.name}`);
    await refresh();
  }

  async function toggle(row: Category) {
    const resp = await authedFetch(`/categories/${row.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: row.name, is_active: !row.is_active }),
    });
    const data = await parseJsonSafe(resp);
    if (!resp.ok) {
      setMessage(data?.detail ?? "Failed to update category");
      return;
    }
    await refresh();
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <section className="space-y-4">
      <header className="rounded-xl bg-card p-5 shadow-sm">
        <h1 className="text-xl font-semibold"><i className="fa-solid fa-layer-group mr-2 text-accent" />Exam Categories</h1>
        <p className="mt-1 text-sm text-black/70">Admin controls categories available for student and mentor profiles.</p>
      </header>

      <article className="rounded-xl bg-card p-4 shadow-sm">
        <div className="flex gap-2">
          <input
            className="w-full rounded-md border px-3 py-2"
            placeholder="Add category name (e.g., SSC CGL)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="rounded-md bg-accent px-4 py-2 text-white" onClick={() => void createCategory()}>
            <i className="fa-solid fa-plus mr-2" />
            Add
          </button>
        </div>
        {message && <p className="mt-2 text-sm text-slate-700">{message}</p>}
      </article>

      <div className="grid gap-3">
        {rows.map((row) => (
          <article key={row.id} className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{row.name}</p>
                <p className="text-xs text-black/60">{row.slug}</p>
              </div>
              <button
                className={`rounded-md px-3 py-1.5 text-sm ${row.is_active ? "bg-emerald-600 text-white" : "border"}`}
                onClick={() => void toggle(row)}
              >
                <i className={`mr-2 fa-solid ${row.is_active ? "fa-toggle-on" : "fa-toggle-off"}`} />
                {row.is_active ? "Active" : "Inactive"}
              </button>
            </div>
          </article>
        ))}
        {rows.length === 0 && <p className="text-sm text-black/60">No categories found.</p>}
      </div>
    </section>
  );
}
