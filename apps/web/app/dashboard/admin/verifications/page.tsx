"use client";

import { useEffect, useState } from "react";

import { authedFetch, parseJsonSafe } from "@/lib/api";

type Verification = {
  mentor_user_id: string;
  status: string;
  headline: string | null;
  exams?: string | null;
};

export default function AdminVerificationsPage() {
  const [items, setItems] = useState<Verification[]>([]);
  const [message, setMessage] = useState("");

  async function refresh() {
    const resp = await authedFetch("/admin/mentor-verifications");
    const rows = await parseJsonSafe(resp);
    setItems(Array.isArray(rows) ? rows : []);
  }

  async function setVerification(mentorUserId: string, status: "approved" | "rejected" | "needs_info") {
    const resp = await authedFetch("/admin/mentor-verifications/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mentor_user_id: mentorUserId, status }),
    });
    const response = await parseJsonSafe(resp);
    if (!resp.ok) {
      setMessage(response.detail ?? "Failed to update verification");
      return;
    }
    setMessage(`Updated ${response.mentor_user_id} => ${response.status}`);
    await refresh();
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <section className="rounded-xl bg-card p-5 shadow-sm">
      <h2 className="text-lg font-semibold">Mentor Verification Queue</h2>
      {message && <p className="mt-2 rounded bg-accentSoft px-3 py-2 text-sm text-accent">{message}</p>}
      <div className="mt-3 space-y-2">
        {items.map((row) => (
          <div key={row.mentor_user_id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
            <div>
              <div className="font-medium">{row.headline ?? row.mentor_user_id}</div>
              <div className="text-black/70">{row.exams ?? "No exams set"}</div>
              <div className="text-black/70">Status: {row.status}</div>
            </div>
            <div className="flex gap-2">
              <button className="rounded border px-2 py-1" onClick={() => setVerification(row.mentor_user_id, "approved")}>Approve</button>
              <button className="rounded border px-2 py-1" onClick={() => setVerification(row.mentor_user_id, "needs_info")}>Needs Info</button>
              <button className="rounded border px-2 py-1" onClick={() => setVerification(row.mentor_user_id, "rejected")}>Reject</button>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-black/60">No mentor profiles yet.</p>}
      </div>
    </section>
  );
}
