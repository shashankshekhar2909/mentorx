"use client";

import { useSearchParams } from "next/navigation";

import { DashboardShell } from "@/components/dashboard-shell";
import { ChatPanel } from "@/components/chat-panel";

export default function MentorChatsPage() {
  const searchParams = useSearchParams();
  return (
    <DashboardShell role="mentor" title="Mentor Chats">
      <ChatPanel role="mentor" defaultThreadId={searchParams.get("thread") ?? ""} />
    </DashboardShell>
  );
}
