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
  pending_call_session_id?: string | null;
  pending_call_status?: string | null;
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
  event_type?: string | null;
  link_path?: string | null;
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

function extractSessionIdFromLinkPath(linkPath?: string | null): string | null {
  if (!linkPath) return null;
  const match = linkPath.match(/\/dashboard\/sessions\/([0-9a-f-]+)/i);
  return match?.[1] ?? null;
}

function extractSessionIdFromCallEvent(message: string): string | null {
  const match = message.match(/Session ID:\s*([0-9a-f-]+)/i);
  return match?.[1] ?? null;
}

function formatStatus(status: string): string {
  return status.replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function statusClasses(status: string): string {
  if (status === "active") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";
  if (status === "pending") return "border-amber-500/30 bg-amber-500/10 text-amber-400";
  if (status === "rejected") return "border-rose-500/30 bg-rose-500/10 text-rose-400";
  return "border-white/10 bg-white/5 text-slate-400";
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
    return requestSubject;
  }, [defaultSubject, requestSubject, subjectOptions]);

  async function loadThreads(preserveSelection = true) {
    const resp = await authedFetch("/chats/threads");
    const data = await parseJsonSafe(resp);
    const rows = Array.isArray(data) ? (data as ChatThread[]) : [];
    setThreads(rows);
    if (!preserveSelection) {
      setSelectedThreadId(rows[0]?.id ?? "");
      if (!rows[0]?.id) setMessages([]);
      return;
    }
    if (!selectedThreadId && rows[0]?.id) {
      setSelectedThreadId(rows[0].id);
      return;
    }
    if (selectedThreadId && !rows.some((item) => item.id === selectedThreadId)) {
      setSelectedThreadId(rows[0]?.id ?? "");
      if (!rows[0]?.id) setMessages([]);
    }
    if (rows.length === 0) setMessages([]);
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

  async function updateThread(action: "accept" | "reject") {
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
    setMessage(action === "accept" ? "Chat accepted" : "Chat rejected");
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

  async function approvePendingCall() {
    if (!selectedThread?.pending_call_session_id) return;
    const resp = await authedFetch(`/sessions/${selectedThread.pending_call_session_id}/approve`, { method: "POST" });
    const data = await parseJsonSafe(resp);
    if (!resp.ok) {
      setMessage(data?.detail ?? "Unable to approve call");
      return;
    }
    await loadThreads();
    window.location.href = `/dashboard/sessions/${selectedThread.pending_call_session_id}`;
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
          const sessionId = extractSessionIdFromLinkPath(item.link_path) ?? extractSessionId(item.message);
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
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="font-bold text-white">1:1 Chat</h2>
          <p className="mt-1 text-sm text-slate-500">
            {role === "student"
              ? "Request a subject chat, wait for mentor acceptance, then message or start an instant call."
              : "Accept chat requests for your subjects and keep an active inbox with students."}
          </p>
        </div>
        {canUseBrowserNotifications && Notification.permission === "default" && (
          <button
            className="rounded-xl border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-400 transition hover:border-white/20 hover:text-white"
            onClick={() => void Notification.requestPermission()}
          >
            Enable Call Alerts
          </button>
        )}
      </div>

      {/* New chat request (student) */}
      {role === "student" && (
        <div
          className="mt-4 grid gap-3 rounded-xl p-3 md:grid-cols-3"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <select className="input-dark" value={requestMentorId} onChange={(e) => setRequestMentorId(e.target.value)}>
            <option value="">Select mentor</option>
            {mentorOptions.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
          <select
            className="input-dark"
            value={requestSubject}
            onChange={(e) => setRequestSubject(e.target.value)}
            disabled={Boolean(defaultSubject) && subjectOptions.length <= 1}
          >
            <option value="">Select category</option>
            {subjectOptions.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          <button
            className="rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:from-violet-500 hover:to-blue-500 disabled:opacity-50"
            onClick={() => void createThread()}
            disabled={!requestMentorId || !resolvedRequestSubject}
          >
            Request Chat
          </button>
          <textarea
            className="input-dark min-h-[72px] resize-y md:col-span-3"
            value={requestMessage}
            onChange={(e) => setRequestMessage(e.target.value)}
            placeholder="Write the first message for the mentor"
          />
          {!resolvedRequestSubject && (
            <div
              className="rounded-xl px-3 py-2 text-sm text-amber-400 md:col-span-3"
              style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}
            >
              Start new mentor connections from the mentor directory so the category is already selected.{" "}
              <Link href="/dashboard/student/mentors" className="font-semibold underline">
                Open Mentor Directory
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Incoming call notifications */}
      {callNotifications.length > 0 && (
        <div
          className="mt-4 space-y-2 rounded-xl p-3"
          style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)" }}
        >
          {callNotifications.slice(0, 3).map((item) => {
            const sessionId = extractSessionIdFromLinkPath(item.link_path) ?? extractSessionId(item.message);
            return (
              <div key={item.id} className="flex items-center justify-between gap-2 text-sm">
                <div>
                  <p className="font-semibold text-emerald-300">{item.title}</p>
                  <p className="text-emerald-400/80">{item.message}</p>
                </div>
                {sessionId && (
                  <Link
                    href={`/dashboard/sessions/${sessionId}`}
                    className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-1.5 text-sm font-bold text-white transition hover:from-emerald-500 hover:to-teal-500"
                  >
                    Join Now
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Thread list + message area */}
      <div className="mt-4 grid gap-4 md:grid-cols-[280px_minmax(0,1fr)]">
        {/* Thread sidebar */}
        <div
          className="space-y-1.5 rounded-xl p-2"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          {threads.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedThreadId(item.id)}
              className={`w-full rounded-xl px-3 py-2.5 text-left text-sm transition ${
                selectedThreadId === item.id
                  ? "bg-violet-500/15 text-white"
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
              style={
                selectedThreadId === item.id
                  ? { border: "1px solid rgba(124,58,237,0.3)" }
                  : { border: "1px solid transparent" }
              }
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{item.subject}</p>
                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClasses(item.status)}`}>
                  {formatStatus(item.status)}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                {item.last_message_preview || "No messages yet"}
              </p>
              <p className="mt-1.5 text-[11px] text-slate-600">
                {item.last_message_at
                  ? new Date(item.last_message_at).toLocaleString()
                  : "No activity yet"}
              </p>
            </button>
          ))}
          {threads.length === 0 && (
            <p className="p-2 text-sm text-slate-500">No chat threads yet.</p>
          )}
        </div>

        {/* Message area */}
        <div
          className="rounded-xl p-3"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          {selectedThread ? (
            <>
              {/* Thread header */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-white">{selectedThread.subject}</p>
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
                      <button
                        className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-1.5 text-sm font-bold text-white transition hover:from-emerald-500 hover:to-teal-500"
                        onClick={() => void updateThread("accept")}
                      >
                        Accept
                      </button>
                      <button
                        className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-sm font-semibold text-rose-400 transition hover:bg-rose-500/20"
                        onClick={() => void updateThread("reject")}
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {selectedThread.status === "active" && (
                    <>
                      {!selectedThread.pending_call_session_id && role === "student" && (
                        <button
                          className="rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-3 py-1.5 text-sm font-bold text-white transition hover:from-violet-500 hover:to-blue-500"
                          onClick={() => void startInstantCall()}
                        >
                          Request Call
                        </button>
                      )}
                      {role === "mentor" &&
                        selectedThread.pending_call_status === "pending_mentor_approval" &&
                        selectedThread.pending_call_session_id && (
                          <button
                            className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-1.5 text-sm font-bold text-white transition hover:from-emerald-500 hover:to-teal-500"
                            onClick={() => void approvePendingCall()}
                          >
                            Approve & Join
                          </button>
                        )}
                      {selectedThread.pending_call_session_id &&
                        ["confirmed", "ready_to_join", "in_progress"].includes(
                          selectedThread.pending_call_status ?? "",
                        ) && (
                          <Link
                            href={`/dashboard/sessions/${selectedThread.pending_call_session_id}`}
                            className="rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-3 py-1.5 text-sm font-bold text-white transition hover:from-violet-500 hover:to-blue-500"
                          >
                            Join Call
                          </Link>
                        )}
                      {role === "student" &&
                        selectedThread.pending_call_status === "pending_mentor_approval" && (
                          <span
                            className="rounded-xl px-3 py-1.5 text-sm font-semibold text-amber-400"
                            style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)" }}
                          >
                            Call Requested
                          </span>
                        )}
                    </>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div
                className="mt-3 max-h-96 space-y-3 overflow-y-auto rounded-xl p-3 text-sm styled-scrollbar"
                style={{ background: "rgba(0,0,0,0.15)", border: "1px solid rgba(255,255,255,0.05)" }}
              >
                {messages.map((item) => {
                  const isCallEvent =
                    /^Requested an instant call\.|^Started an instant call\.|^Call ended\./.test(
                      item.message,
                    );
                  const callEventSessionId = isCallEvent
                    ? extractSessionIdFromCallEvent(item.message)
                    : null;
                  const isMine =
                    (role === "student" && item.sender_id === selectedThread.student_id) ||
                    (role === "mentor" && item.sender_id === selectedThread.mentor_id);
                  const senderLabel = isMine
                    ? "You"
                    : item.sender_id === selectedThread.student_id
                      ? "Student"
                      : "Mentor";

                  if (isCallEvent) {
                    return (
                      <div key={item.id} className="flex justify-center">
                        <div
                          className="max-w-[90%] rounded-2xl px-4 py-3 text-center text-xs font-medium text-blue-300"
                          style={{
                            background: "rgba(59,130,246,0.08)",
                            border: "1px solid rgba(59,130,246,0.2)",
                          }}
                        >
                          <div className="flex flex-wrap items-center justify-center gap-2">
                            <i className="fa-solid fa-phone text-[11px]" />
                            <span>{item.message}</span>
                            <span className="text-blue-400/60">
                              {new Date(item.created_at).toLocaleString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                                day: "2-digit",
                                month: "short",
                              })}
                            </span>
                          </div>
                          {callEventSessionId && (
                            <div className="mt-2">
                              <Link
                                href={`/dashboard/sessions/${callEventSessionId}`}
                                className="inline-flex rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-[11px] font-semibold text-blue-300 transition hover:bg-blue-500/20"
                              >
                                View Call Details
                              </Link>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={item.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                          isMine
                            ? "bg-gradient-to-br from-violet-600/80 to-blue-600/80 text-white"
                            : "text-slate-200"
                        }`}
                        style={
                          !isMine
                            ? { background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }
                            : {}
                        }
                      >
                        <div className="flex items-center gap-2 text-[11px] opacity-70">
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/15 text-[9px] font-bold">
                            {senderLabel.slice(0, 1)}
                          </span>
                          <span className="font-semibold">{senderLabel}</span>
                          <span>
                            {new Date(item.created_at).toLocaleString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                              day: "2-digit",
                              month: "short",
                            })}
                          </span>
                        </div>
                        <p className="mt-1.5 whitespace-pre-wrap break-words leading-6">{item.message}</p>
                      </div>
                    </div>
                  );
                })}
                {messages.length === 0 && <p className="text-slate-500">No messages yet.</p>}
                <div ref={messagesEndRef} />
              </div>

              {/* Composer */}
              <div className="mt-3 flex gap-2">
                <input
                  className="input-dark flex-1"
                  value={composer}
                  onChange={(e) => setComposer(e.target.value)}
                  placeholder={
                    selectedThread.status === "active"
                      ? "Type a message..."
                      : "Connection must be accepted before chat starts"
                  }
                  disabled={selectedThread.status !== "active"}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendMessage();
                    }
                  }}
                />
                <button
                  className="rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-5 py-2.5 text-sm font-bold text-white transition hover:from-violet-500 hover:to-blue-500 disabled:opacity-50"
                  onClick={() => void sendMessage()}
                  disabled={selectedThread.status !== "active"}
                >
                  <i className="fa-solid fa-paper-plane mr-1.5" />
                  Send
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-500">Select a thread to open chat.</p>
          )}
        </div>
      </div>

      {message && <p className="mt-3 text-sm text-slate-400">{message}</p>}
    </article>
  );
}
