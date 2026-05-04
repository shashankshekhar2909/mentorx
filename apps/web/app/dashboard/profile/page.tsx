"use client";

import React, { useEffect, useState } from "react";

import { authedFetch, parseJsonSafe } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import type { Role } from "@/lib/types";

type AccountProfile = {
  email: string;
  role: Role;
  display_name: string;
  full_name: string | null;
  bio: string | null;
  timezone: string | null;
  language: string | null;
  target_exams: string | null;
};

function roleLabel(role: Role): string {
  return role.slice(0, 1).toUpperCase() + role.slice(1);
}

export default function ProfilePage() {
  const session = useAuthStore((s) => s.session);
  const updateSession = useAuthStore((s) => s.updateSession);
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [language, setLanguage] = useState("English");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function refresh() {
    const resp = await authedFetch("/users/me/account");
    const data = await parseJsonSafe(resp);
    if (!resp.ok) {
      setMessage(data?.detail ?? "Unable to load profile");
      return;
    }
    setProfile(data);
    setFullName(String(data?.full_name ?? ""));
    setBio(String(data?.bio ?? ""));
    setTimezone(String(data?.timezone ?? "Asia/Kolkata"));
    setLanguage(String(data?.language ?? "English"));
    updateSession({ displayName: String(data?.display_name ?? data?.email ?? session?.email ?? "") });
  }

  async function saveProfile() {
    setSaving(true);
    setMessage("");
    try {
      const resp = await authedFetch("/users/me/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName.trim() || null,
          bio: bio.trim() || null,
          timezone: timezone.trim() || "Asia/Kolkata",
          language: language.trim() || "English",
          target_exams: profile?.target_exams ?? null,
        }),
      });
      const data = await parseJsonSafe(resp);
      if (!resp.ok) {
        setMessage(data?.detail ?? "Unable to save profile");
        return;
      }
      const nextName = String(data?.full_name ?? profile?.email ?? session?.email ?? "");
      updateSession({ displayName: nextName });
      setMessage("Profile updated");
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const infoRow = (label: string, value: React.ReactNode) => (
    <div
      className="rounded-xl p-4"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{label}</p>
      <div className="mt-1 font-semibold text-white">{value}</div>
    </div>
  );

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Edit form */}
        <article className="app-card p-6">
          <div className="mb-5 flex items-center gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-xl text-violet-300"
              style={{ background: "rgba(124,58,237,0.15)" }}
            >
              <i className="fa-solid fa-id-badge text-lg" />
            </div>
            <div>
              <h2 className="font-bold text-white">Account Label</h2>
              <p className="text-sm text-slate-500">
                This name is shown in menus, meetings, and participant labels.
              </p>
            </div>
          </div>

          <div className="grid gap-4">
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Display Name</span>
              <input
                className="input-dark"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={profile?.email ?? "name@example.com"}
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Bio</span>
              <textarea
                className="input-dark min-h-28 resize-y"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Add a short introduction or role note."
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Timezone</span>
                <input className="input-dark" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Language</span>
                <input className="input-dark" value={language} onChange={(e) => setLanguage(e.target.value)} />
              </label>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              className="rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:from-violet-500 hover:to-blue-500 disabled:opacity-60"
              onClick={() => void saveProfile()}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Profile"}
            </button>
            {message && <p className="text-sm text-slate-400">{message}</p>}
          </div>
        </article>

        {/* Identity card */}
        <article className="app-card p-6">
          <h2 className="mb-1 font-bold text-white">Identity</h2>
          <p className="mb-4 text-sm text-slate-500">
            Shown consistently across mentorXAI for account verification and participant clarity.
          </p>

          <div className="space-y-3">
            {infoRow("Current Label", profile?.display_name ?? session?.displayName ?? session?.email)}
            {infoRow("Email", profile?.email ?? session?.email)}
            {infoRow(
              "User Type",
              <span
                className="inline-flex rounded-full px-3 py-1 text-sm font-semibold text-violet-300"
                style={{ background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.2)" }}
              >
                {profile?.role ? roleLabel(profile.role) : session?.role ? roleLabel(session.role) : ""}
              </span>,
            )}
            <div
              className="rounded-xl p-4 text-sm text-amber-400"
              style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}
            >
              <div className="mb-1 flex items-center gap-2 font-semibold">
                <i className="fa-solid fa-circle-info" />
                Default behavior
              </div>
              <p>
                If you leave display name blank, mentorXAI will use your email as the visible label in
                calls, menus, and participant lists.
              </p>
            </div>
          </div>
        </article>
      </div>
    </>
  );
}
