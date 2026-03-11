"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ChatPanel } from "@/components/chat-panel";
import { DashboardShell } from "@/components/dashboard-shell";
import { authedFetch, parseJsonSafe } from "@/lib/api";

type Mentor = {
  user_id: string;
  headline: string | null;
  exams: string | null;
};

export default function StudentChatsPage() {
  const searchParams = useSearchParams();
  const [categories, setCategories] = useState("");
  const [mentors, setMentors] = useState<Mentor[]>([]);

  const categoryList = useMemo(
    () =>
      categories
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    [categories],
  );

  useEffect(() => {
    async function load() {
      const profileResp = await authedFetch("/users/me/profile");
      const profile = await parseJsonSafe(profileResp);
      const profileCategories = String(profile?.target_exams ?? "");
      setCategories(profileCategories);

      const mentorResp = await authedFetch(`/mentors?categories=${encodeURIComponent(profileCategories)}`);
      const mentorData = await parseJsonSafe(mentorResp);
      setMentors(Array.isArray(mentorData) ? (mentorData as Mentor[]) : []);
    }
    void load();
  }, []);

  return (
    <DashboardShell role="student" title="Student Chats">
      <ChatPanel
        role="student"
        mentorOptions={mentors.map((mentor) => ({
          id: mentor.user_id,
          label: `${mentor.headline ?? mentor.user_id} | ${mentor.exams ?? "-"}`,
        }))}
        defaultMentorId={searchParams.get("mentor") ?? ""}
        defaultSubject={searchParams.get("subject") ?? ""}
        defaultThreadId={searchParams.get("thread") ?? ""}
        subjectOptions={categoryList}
      />
    </DashboardShell>
  );
}
