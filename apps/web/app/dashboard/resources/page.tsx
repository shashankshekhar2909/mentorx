"use client";

import { useEffect, useMemo, useState } from "react";

import { authedFetch, parseJsonSafe } from "@/lib/api";

type Resource = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  price: number;
  mentor_id: string;
};

export default function ResourcesPage() {
  const [items, setItems] = useState<Resource[]>([]);
  const [purchased, setPurchased] = useState<Set<string>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState("");
  const [message, setMessage] = useState("");

  async function refresh() {
    const [allResp, mineResp] = await Promise.all([authedFetch("/resources"), authedFetch("/resources/mine/purchases")]);
    const [all, mine] = await Promise.all([parseJsonSafe(allResp), parseJsonSafe(mineResp)]);
    setItems(Array.isArray(all) ? all : []);
    const mineRows = Array.isArray(mine) ? (mine as Array<{ resource_id: string }>) : [];
    setPurchased(new Set(mineRows.map((row) => row.resource_id)));
  }

  async function purchase(resourceId: string) {
    const purchaseResp = await authedFetch(`/resources/${resourceId}/purchase`, { method: "POST" });
    const resp = await parseJsonSafe(purchaseResp);
    setMessage(resp.message ?? "Purchase action completed");
    await refresh();
  }

  async function access(resourceId: string) {
    const accessResp = await authedFetch(`/resources/${resourceId}/access`);
    const resp = await parseJsonSafe(accessResp);
    if (resp.download_url) {
      window.open(resp.download_url, "_blank", "noopener,noreferrer");
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const filtered = useMemo(() => {
    const q = categoryFilter.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => (item.category ?? "").toLowerCase().includes(q));
  }, [items, categoryFilter]);

  return (
    <>
      <section className="space-y-4">
        <div className="rounded-xl bg-card p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Subject Material & Sheets</h2>
          <p className="mt-1 text-sm text-black/70">Purchase once and access anytime from your account.</p>
          <input
            className="mt-3 rounded border px-3 py-2"
            placeholder="Filter by category (e.g., gate)"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          />
          {message && <p className="mt-3 rounded bg-accentSoft px-3 py-2 text-sm text-accent">{message}</p>}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((item) => {
            const isPurchased = purchased.has(item.id) || item.price <= 0;
            return (
              <article key={item.id} className="rounded-xl bg-card p-4 shadow-sm">
                <h3 className="text-base font-semibold">{item.title}</h3>
                <p className="mt-1 text-sm text-black/70">{item.description ?? "No description"}</p>
                <p className="mt-1 text-xs text-black/60">Category: {item.category ?? "general"}</p>
                <p className="mt-1 text-sm font-medium">Price: {item.price > 0 ? `INR ${item.price}` : "Free"}</p>
                <div className="mt-3 flex gap-2">
                  {!isPurchased && (
                    <button className="rounded border px-3 py-1.5 text-sm" onClick={() => purchase(item.id)}>
                      Purchase
                    </button>
                  )}
                  <button className="rounded bg-accent px-3 py-1.5 text-sm text-white" onClick={() => access(item.id)}>
                    {isPurchased ? "Access" : "Try Access"}
                  </button>
                </div>
              </article>
            );
          })}
          {filtered.length === 0 && <p className="text-sm text-black/60">No resources found.</p>}
        </div>
      </section>
    </>
  );
}
