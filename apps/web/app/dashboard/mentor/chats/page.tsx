"use client";

import { useSearchParams } from "next/navigation";

import { ChatPanel } from "@/components/chat-panel";

export default function MentorChatsPage() {
  const searchParams = useSearchParams();
  return <ChatPanel role="mentor" defaultThreadId={searchParams.get("thread") ?? ""} />;
}
