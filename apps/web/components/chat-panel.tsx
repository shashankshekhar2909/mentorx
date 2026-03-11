"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { authedFetch, parseJsonSafe } from "@/lib/api";

type ChatThread = {
  id: string;
  student_id: string;
  mentor_id: string;
  subject: string;
  status: string;
  last_message_preview: string | null;
  last_message_at: string | null;
};

type ChatMessage = {
  id: string;
  sender_id: string;
  message: string;
  created_at: string;
};

type NotificationRow = {
  id: string;
  title: string;
  message: string;
  created_at: string;
};

type MentorOption = {
  id: string;
  label: string;
};

type Props = {
  role: "student" | "mentor";
  mentorOptions?: MentorOption[];
  defaultMentorId?: string;
  defaultSubject?: string;
  defaultThreadId?: string;
  subjectOptions?: string[];
};

function extractSessionId(message: string): string | null {
  const match = message.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  return match?.[0] ?? null;
}

function formatStatus(status: string): string {
  return status.replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function statusClasses(status: string): string {
  if (status === "active") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "pending") return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "rejected") return "border-rose-200 bg-rose-50 text-rose-800";
  return "border-slate-200 bg-slate-100 text-slate-700";
}

export function ChatPanel({ role, mentorOptions = [], defaultMentorId = "", defaultSubject = "", defaultThreadId = "", subjectOptions = [] }: Props) {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [composer, setComposer] = useState("");
  const [requestMentorId, setRequestMentorId] = useState(defaultMentorId);
  const [requestSubject, setRequestSubject] = useState(defaultSubject || subjectOptions[0] || "");
  const [requestMessage, setRequestMessage] = useState("");
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [message, setMessage] = useState("");
  const seenNotificationIdsRef = useRef<Set<string>>(new Set());
  const notificationsBootstrappedRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const selectedThread = useMemo(
    () => threads.find((item) => item.id === selectedThreadId) ?? null,
    [selectedThreadId, threads],
  );
  const selectedMentorLabel = useMemo(
    () => mentorOptions.find((item) => item.id === selectedThread?.mentor_id)?.label ?? null,
    [mentorOptions, selectedThread?.mentor_id],
  );
  const resolvedRequestSubject = useMemo(() => {
    if (defaultSubject) return defaultSubject;
    if (subjectOptions.length === 1) return subjectOptions[0];
    return "";
  }, [defaultSubject, subjectOptions]);

  async function loadThreads(preserveSelection = true) {
    const resp = await authedFetch("/chats/threads");
    const data = await parseJsonSafe(resp);
    const rows = Array.isArray(data) ? (data as ChatThread[]) : [];
    setThreads(rows);
    if (!preserveSelection) {
      setSelectedThreadId(rows[0]?.id ?? "");
      return;
    }
    if (!selectedThreadId && rows[0]?.id) setSelectedThreadId(rows[0].id);
    if (selectedThreadId && !rows.some((item) => item.id === selectedThreadId)) {
      setSelectedThreadId(rows[0]?.id ?? "");
    }
  }

  async function loadMessages(threadId: string) {
    if (!threadId) {
      setMessages([]);
      return;
    }
    const resp = await authedFetch(`/chats/threads/${threadId}/messages`);
    const data = await parseJsonSafe(resp);
    setMessages(Array.isArray(data) ? (data as ChatMessage[]) : []);
  }

  async function loadNotifications() {
    const resp = await authedFetch("/notifications/mine");
    const data = await parseJsonSafe(resp);
    const rows = Array.isArray(data) ? (data as NotificationRow[]) : [];
    setNotifications(rows);
  }

  async function createThread() {
    if (!requestMentorId || !resolvedRequestSubject.trim()) return;
    const resp = await authedFetch("/chats/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mentor_id: requestMentorId,
        subject: resolvedRequestSubject.trim(),
        message: requestMessage.trim() || null,
      }),
    });
    const data = await parseJsonSafe(resp);
    if (!resp.ok) {
      setMessage(data?.detail ?? "Unable to create chat request");
      return;
    }
    setRequestMessage("");
    setMessage("Chat request sent");
    await loadThreads(false);
    setSelectedThreadId(String(data.id));
  }

  async function updateThread(action: "accept" | "reject" | "close") {
    if (!selectedThread) return;
    const resp = await authedFetch(`/chats/threads/${selectedThread.id}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await parseJsonSafe(resp);
    if (!resp.ok) {
      setMessage(data?.detail ?? "Unable to update chat");
      return;
    }
    setMessage(action === "accept" ? "Chat accepted" : action === "reject" ? "Chat rejected" : "Chat closed");
    await loadThreads();
  }

  async function sendMessage() {
    if (!selectedThread || !composer.trim()) return;
    const resp = await authedFetch(`/chats/threads/${selectedThread.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: composer.trim() }),
    });
    const data = await parseJsonSafe(resp);
    if (!resp.ok) {
      setMessage(data?.detail ?? "Unable to send message");
      return;
    }
    setComposer("");
    setMessages((prev) => [...prev, data as ChatMessage]);
    await loadThreads();
  }

  async function startInstantCall() {
    if (!selectedThread) return;
    const resp = await authedFetch(`/chats/threads/${selectedThread.id}/instant-call`, { method: "POST" });
    const data = await parseJsonSafe(resp);
    if (!resp.ok || !data?.id) {
      setMessage(data?.detail ?? "Unable to start instant call");
      return;
    }
    window.location.href = `/dashboard/sessions/${String(data.id)}`;
  }

  useEffect(() => {
    setRequestMentorId(defaultMentorId);
  }, [defaultMentorId]);

  useEffect(() => {
    if (defaultSubject) setRequestSubject(defaultSubject);
  }, [defaultSubject]);

  useEffect(() => {
    if (defaultThreadId) setSelectedThreadId(defaultThreadId);
  }, [defaultThreadId]);

  useEffect(() => {
    void loadThreads(false);
    void loadNotifications();
  }, []);

  useEffect(() => {
    if (!selectedThreadId) return;
    void loadMessages(selectedThreadId);
  }, [selectedThreadId]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void loadThreads();
      if (selectedThreadId) void loadMessages(selectedThreadId);
      void loadNotifications();
    }, 5000);
    return () => window.clearInterval(id);
  }, [selectedThreadId]);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (!notificationsBootstrappedRef.current) {
      notifications.forEach((item) => seenNotificationIdsRef.current.add(item.id));
      notificationsBootstrappedRef.current = true;
      return;
    }
    for (const item of notifications) {
      if (seenNotificationIdsRef.current.has(item.id)) continue;
      seenNotificationIdsRef.current.add(item.id);
      if (!/incoming instant call/i.test(item.title)) continue;
      if (Notification.permission === "granted") {
        const notification = new Notification(item.title, { body: item.message });
        notification.onclick = () => {
          const sessionId = extractSessionId(item.message);
          if (sessionId) window.location.href = `/dashboard/sessions/${sessionId}`;
        };
      }
    }
  }, [notifications]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages, selectedThreadId]);

  const callNotifications = notifications.filter((item) => /incoming instant call/i.test(item.title));
  const canUseBrowserNotifications = typeof window !== "undefined" && "Notification" in window;

  return (
    <article className="app-card p-5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">1:1 Chat</h2>
          <p className="mt-1 text-sm text-slate-600">
            {role === "student"
              ? "Request a subject chat, wait for mentor acceptance, then message or start an instant call."
              : "Accept chat requests for your subjects and keep an active inbox with students."}
          </p>
        </div>
        {canUseBrowserNotifications && Notification.permission === "default" && (
          <button className="rounded-md border px-3 py-1.5 text-xs" onClick={() => void Notification.requestPermission()}>
            Enable Call Alerts
          </button>
        )}
      </div>

      {role === "student" && (
        <div className="mt-4 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-3">
          <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm" value={requestMentorId} onChange={(e) => setRequestMentorId(e.target.value)}>
            <option value="">Select mentor</option>
            {mentorOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
            Category: <span className="font-semibold text-slate-900">{resolvedRequestSubject || "Pick from Mentor Directory"}</span>
          </div>
          <button
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            onClick={() => void createThread()}
            disabled={!requestMentorId || !resolvedRequestSubject}
          >
            Request Chat
          </button>
          <textarea
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-3"
            value={requestMessage}
            onChange={(e) => setRequestMessage(e.target.value)}
            placeholder="Write the first message for the mentor"
          />
          {!resolvedRequestSubject && (
            <div className="md:col-span-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Start new mentor connections from the mentor directory so the category is already selected.
              <Link href="/dashboard/student/mentors" className="ml-2 font-semibold underline">
                Open Mentor Directory
              </Link>
            </div>
          )}
        </div>
      )}

      {callNotifications.length > 0 && (
        <div className="mt-4 space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          {callNotifications.slice(0, 3).map((item) => {
            const sessionId = extractSessionId(item.message);
            return (
              <div key={item.id} className="flex items-center justify-between gap-2 text-sm">
                <div>
                  <p className="font-semibold text-emerald-900">{item.title}</p>
                  <p className="text-emerald-800">{item.message}</p>
                </div>
                {sessionId && (
                  <Link href={`/dashboard/sessions/${sessionId}`} className="rounded-md bg-emerald-600 px-3 py-1.5 text-white">
                    Join Now
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 grid gap-4 md:grid-cols-[280px_minmax(0,1fr)]">
        <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-2">
          {threads.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedThreadId(item.id)}
              className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${selectedThreadId === item.id ? "border-accent bg-accent/5" : "border-slate-200 bg-slate-50"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-slate-900">{item.subject}</p>
                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClasses(item.status)}`}>{formatStatus(item.status)}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-slate-600">{item.last_message_preview || "No messages yet"}</p>
              <p className="mt-2 text-[11px] text-slate-400">{item.last_message_at ? new Date(item.last_message_at).toLocaleString() : "No activity yet"}</p>
            </button>
          ))}
          {threads.length === 0 && <p className="p-2 text-sm text-slate-500">No chat threads yet.</p>}
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          {selectedThread ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-900">{selectedThread.subject}</p>
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClasses(selectedThread.status)}`}>
                      {formatStatus(selectedThread.status)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {role === "student"
                      ? `With ${selectedMentorLabel ?? "your mentor"}`
                      : `Student ID ${selectedThread.student_id.slice(0, 8)}`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {role === "mentor" && selectedThread.status === "pending" && (
                    <>
                      <button className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm text-white" onClick={() => void updateThread("accept")}>
                        Accept
                      </button>
                      <button className="rounded-md border border-rose-300 px-3 py-1.5 text-sm text-rose-700" onClick={() => void updateThread("reject")}>
                        Reject
                      </button>
                    </>
                  )}
                  {selectedThread.status === "active" && (
                    <>
                      <button className="rounded-md bg-accent px-3 py-1.5 text-sm text-white" onClick={() => void startInstantCall()}>
                        Instant Call
                      </button>
                      <button className="rounded-md border px-3 py-1.5 text-sm" onClick={() => void updateThread("close")}>
                        Close
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="mt-3 max-h-96 space-y-3 overflow-y-auto rounded-lg border border-slate-200 bg-white p-3 text-sm">
                {messages.map((item) => {
                  const isMine =
                    (role === "student" && item.sender_id === selectedThread.student_id) ||
                    (role === "mentor" && item.sender_id === selectedThread.mentor_id);
                  const senderLabel = isMine
                    ? "You"
                    : item.sender_id === selectedThread.student_id
                      ? "Student"
                      : "Mentor";

                  return (
                    <div key={item.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] rounded-2xl px-3 py-2 shadow-sm ${isMine ? "bg-slate-900 text-white" : "border border-slate-200 bg-slate-50 text-slate-900"}`}>
                        <div className={`flex items-center gap-2 text-[11px] ${isMine ? "text-slate-300" : "text-slate-500"}`}>
                          <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${isMine ? "bg-white/10 text-white" : "bg-slate-200 text-slate-700"}`}>
                            {senderLabel.slice(0, 1)}
                          </span>
                          <span className="font-semibold">{senderLabel}</span>
                          <span>{new Date(item.created_at).toLocaleString([], { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })}</span>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap break-words leading-6">{item.message}</p>
                      </div>
                    </div>
                  );
                })}
                {messages.length === 0 && <p className="text-slate-500">No messages yet.</p>}
                <div ref={messagesEndRef} />
              </div>

              <div className="mt-3 flex gap-2">
                <input
                  className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm"
                  value={composer}
                  onChange={(e) => setComposer(e.target.value)}
                  placeholder={selectedThread.status === "active" ? "Type a message" : "Connection must be accepted before chat starts"}
                  disabled={selectedThread.status !== "active"}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendMessage();
                    }
                  }}
                />
                <button
                  className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                  onClick={() => void sendMessage()}
                  disabled={selectedThread.status !== "active"}
                >
                  Send
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-500">Select a thread to open chat.</p>
          )}
        </div>
      </div>

      {message && <p className="mt-3 text-sm text-slate-700">{message}</p>}
    </article>
  );
}
