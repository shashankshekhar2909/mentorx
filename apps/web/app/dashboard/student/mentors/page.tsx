"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { authedFetch, parseJsonSafe } from "@/lib/api";

type CategoryOption = {
  slug: string;
  name: string;
};

type Mentor = {
  user_id: string;
  headline: string | null;
  exams: string | null;
  years_experience: number;
  hourly_price: number;
  rating_avg: number;
  connection_status: string | null;
  connection_thread_id: string | null;
  is_connected: boolean;
  is_requested: boolean;
};

function normalizeList(value: string | null | undefined): string[] {
  return (value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export default function StudentMentorsPage() {
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [activeCategory, setActiveCategory] = useState("");
  const [studentCategories, setStudentCategories] = useState<string[]>([]);
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [message, setMessage] = useState("");

  async function loadCategories() {
    const resp = await authedFetch("/categories");
    const data = await parseJsonSafe(resp);
    const rows = Array.isArray(data) ? (data as CategoryOption[]) : [];
    setCategories(rows);
  }

  async function loadMentors(category: string) {
    const query = category ? `?category=${encodeURIComponent(category)}` : "";
    const resp = await authedFetch(`/mentors/discover${query}`);
    const data = await parseJsonSafe(resp);
    setMentors(Array.isArray(data) ? (data as Mentor[]) : []);
  }

  async function connectMentor(mentorId: string) {
    if (!activeCategory) return;
    const resp = await authedFetch("/chats/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mentor_id: mentorId,
        subject: activeCategory,
        message: `Connection request for ${activeCategory}`,
      }),
    });
    const data = await parseJsonSafe(resp);
    if (!resp.ok) {
      setMessage(data?.detail ?? "Unable to send connection request");
      return;
    }
    setMessage("Connection request sent");
    await loadMentors(activeCategory);
  }

  async function startInstantCall(threadId: string) {
    const resp = await authedFetch(`/chats/threads/${threadId}/instant-call`, { method: "POST" });
    const data = await parseJsonSafe(resp);
    if (!resp.ok || !data?.id) {
      setMessage(data?.detail ?? "Unable to start instant call");
      return;
    }
    window.location.href = `/dashboard/sessions/${String(data.id)}`;
  }

  useEffect(() => {
    async function bootstrap() {
      await loadCategories();
      const profileResp = await authedFetch("/users/me/profile");
      const profile = await parseJsonSafe(profileResp);
      const targets = normalizeList(String(profile?.target_exams ?? ""));
      setStudentCategories(targets);
      if (targets[0]) {
        setActiveCategory(targets[0]);
        return;
      }
    }
    void bootstrap();
  }, []);

  useEffect(() => {
    void loadMentors(activeCategory);
  }, [activeCategory]);

  return (
    <>
      <section className="space-y-4">
        <article className="app-card p-5">
          <h2 className="text-lg font-semibold">Select Category</h2>
          <p className="mt-1 text-sm text-slate-600">
            Choose one of your approved study categories first. After a mentor accepts your connection, chat and instant call unlock.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {categories
              .filter((item) => studentCategories.includes(item.slug))
              .map((item) => (
              <button
                key={item.slug}
                type="button"
                onClick={() => setActiveCategory(item.slug)}
                className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${activeCategory === item.slug ? "border-teal-300 bg-teal-50 text-teal-800" : "border-cyan-200 bg-cyan-50 text-cyan-800"}`}
              >
                {item.name}
              </button>
            ))}
          </div>
          {studentCategories.length === 0 && (
            <p className="mt-3 text-sm text-slate-600">
              Add approved study categories in your profile to start discovering mentors.
            </p>
          )}
          {message && <p className="mt-3 text-sm text-slate-700">{message}</p>}
        </article>

        <div className="grid gap-4 md:grid-cols-2">
          {mentors.map((mentor) => {
            const matchingSubject =
              normalizeList(mentor.exams).find((item) => item === activeCategory) ?? activeCategory;
            const connectionStatus = mentor.connection_status;
            const threadId = mentor.connection_thread_id;

            return (
              <article key={mentor.user_id} className="app-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                      {mentor.headline ?? mentor.user_id}
                      {mentor.is_connected && <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" title="Connected" />}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">{mentor.exams ?? "No categories listed"}</p>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                    {mentor.rating_avg.toFixed(1)} rating
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-slate-500">Experience</p>
                    <p className="font-semibold text-slate-900">{mentor.years_experience} years</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-slate-500">Price</p>
                    <p className="font-semibold text-slate-900">INR {mentor.hourly_price}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {!threadId && (
                    <button className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white" onClick={() => void connectMentor(mentor.user_id)}>
                      Add Mentor
                    </button>
                  )}
                  {connectionStatus === "pending" && (
                    <span className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-800">
                      Request Pending
                    </span>
                  )}
                  {connectionStatus === "active" && threadId && (
                    <>
                      <span className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-800">
                        Connected
                      </span>
                      <Link
                        href={`/dashboard/student/chats?thread=${threadId}&mentor=${mentor.user_id}&subject=${matchingSubject}`}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700"
                      >
                        Discuss
                      </Link>
                      <button className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white" onClick={() => void startInstantCall(threadId)}>
                        Call
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
          {mentors.length === 0 && <p className="text-sm text-slate-500">No mentors found in your selected study category.</p>}
        </div>
      </section>
    </>
  );
}
