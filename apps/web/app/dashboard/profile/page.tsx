"use client";

import { useEffect, useState } from "react";

import { DashboardShell } from "@/components/dashboard-shell";
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

  return (
    <DashboardShell role={["student", "mentor", "manager", "admin"] as Role[]} title="Profile Settings">
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="app-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-100 text-teal-700">
              <i className="fa-solid fa-id-badge text-lg" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Account Label</h2>
              <p className="text-sm text-slate-600">This name is shown in menus, meetings, and participant labels.</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4">
            <label className="grid gap-1.5 text-sm">
              <span className="font-semibold text-slate-700">Display Name</span>
              <input
                className="rounded-xl border border-slate-300 px-3 py-2.5"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={profile?.email ?? "name@example.com"}
              />
            </label>

            <label className="grid gap-1.5 text-sm">
              <span className="font-semibold text-slate-700">Bio</span>
              <textarea
                className="min-h-28 rounded-xl border border-slate-300 px-3 py-2.5"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Add a short introduction or role note."
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1.5 text-sm">
                <span className="font-semibold text-slate-700">Timezone</span>
                <input className="rounded-xl border border-slate-300 px-3 py-2.5" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="font-semibold text-slate-700">Language</span>
                <input className="rounded-xl border border-slate-300 px-3 py-2.5" value={language} onChange={(e) => setLanguage(e.target.value)} />
              </label>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              onClick={() => void saveProfile()}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Profile"}
            </button>
            {message && <p className="text-sm text-slate-600">{message}</p>}
          </div>
        </article>

        <article className="app-card p-5">
          <h2 className="text-lg font-semibold text-slate-900">Identity</h2>
          <p className="mt-1 text-sm text-slate-600">Shown consistently across mentorXAI for account verification and participant clarity.</p>

          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Current Label</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{profile?.display_name ?? session?.displayName ?? session?.email}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Email</p>
              <p className="mt-1 font-semibold text-slate-900">{profile?.email ?? session?.email}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">User Type</p>
              <p className="mt-1 inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-semibold text-slate-700">
                {profile?.role ? roleLabel(profile.role) : session?.role ? roleLabel(session.role) : ""}
              </p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <div className="flex items-center gap-2 font-semibold">
                <i className="fa-solid fa-circle-info" />
                Default behavior
              </div>
              <p className="mt-2">
                If you leave display name blank, mentorXAI will use your email as the visible label in calls, menus, and participant lists.
              </p>
            </div>
          </div>
        </article>
      </div>
    </DashboardShell>
  );
}
