"use client";

import "@livekit/components-styles";

import {
  ControlBar,
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  useTracks,
} from "@livekit/components-react";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Track } from "livekit-client";

import { apiWsUrl, authedFetch, parseJsonSafe } from "@/lib/api";
import {
  formatIstDateTime,
  formatIstTime,
  formatSessionStatus,
  sessionStatusClasses,
  sessionStatusIcon,
} from "@/lib/presentation";
import { useAuthStore } from "@/lib/auth-store";

type SessionInfo = {
  id: string;
  student_id: string;
  mentor_id: string;
  title: string;
  notes: string | null;
  starts_at: string;
  duration_minutes: number;
  status: string;
};

type JoinData = {
  room_name: string;
  livekit_url: string;
  token: string;
};

type Recording = {
  id: string;
  session_id: string;
  attempt_number: number;
  object_key: string | null;
  playback_url: string | null;
  status: string;
  error_message: string | null;
  created_at?: string;
};

type RecordingVisibility = {
  session_id: string;
  visible_to_student: boolean;
  visible_to_mentor: boolean;
  visible_to_manager: boolean;
  visible_to_admin: boolean;
};

type Participants = {
  student: { id: string; name: string; email?: string };
  mentor: { id: string; name: string; email?: string };
};

type PresenceRow = {
  connection_id?: string;
  user_id: string;
  user_name?: string;
  user_role?: string;
  joined_at?: string;
};

type SignalPayload = {
  type: string;
  connection_id?: string;
  user_id?: string;
  user_name?: string;
  user_role?: string;
  joined_at?: string;
  participants?: PresenceRow[];
};

function MeetingStage() {
  const cameraTracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }], {
    onlySubscribed: false,
  });

  const localTrack = cameraTracks.find((track) => track.participant.isLocal) ?? null;
  const remoteTracks = cameraTracks.filter((track) => !track.participant.isLocal);
  const featuredTrack = remoteTracks[0] ?? localTrack;
  const sideTracks = remoteTracks.slice(1);

  return (
    <div className="flex h-[720px] flex-col bg-slate-950">
      <div className="relative flex-1 overflow-hidden">
        {featuredTrack ? (
          <ParticipantTile
            trackRef={featuredTrack}
            className="h-full w-full [&_[data-lk-participant-name]]:bg-black/55 [&_[data-lk-participant-name]]:px-3 [&_[data-lk-participant-name]]:py-1 [&_[data-lk-participant-name]]:text-sm [&_.lk-participant-tile]:h-full [&_.lk-participant-tile]:w-full [&_.lk-participant-tile_video]:h-full [&_.lk-participant-tile_video]:w-full [&_.lk-participant-tile_video]:object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-300">
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
                <i className="fa-solid fa-user text-2xl" />
              </div>
              <p className="mt-4 text-lg font-semibold">Waiting for participants</p>
              <p className="mt-1 text-sm text-slate-400">The call stage will appear here as soon as someone joins.</p>
            </div>
          </div>
        )}

        {localTrack && (
          <div className="absolute bottom-4 right-4 w-44 overflow-hidden rounded-2xl border border-white/15 bg-slate-900 shadow-2xl">
            <ParticipantTile
              trackRef={localTrack}
              className="aspect-[9/16] w-full [&_[data-lk-participant-name]]:bg-black/60 [&_[data-lk-participant-name]]:px-2 [&_[data-lk-participant-name]]:py-1 [&_[data-lk-participant-name]]:text-xs [&_.lk-participant-tile_video]:h-full [&_.lk-participant-tile_video]:w-full [&_.lk-participant-tile_video]:object-cover"
            />
          </div>
        )}

        {sideTracks.length > 0 && (
          <div className="absolute left-4 top-4 flex max-h-[calc(100%-2rem)] w-36 flex-col gap-3 overflow-y-auto">
            {sideTracks.map((track) => (
              <div key={`${track.participant.identity}-${track.source}-${track.publication?.trackSid ?? "placeholder"}`} className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/90 shadow-lg">
                <ParticipantTile
                  trackRef={track}
                  className="aspect-[3/4] w-full [&_[data-lk-participant-name]]:bg-black/60 [&_[data-lk-participant-name]]:px-2 [&_[data-lk-participant-name]]:py-1 [&_[data-lk-participant-name]]:text-[11px] [&_.lk-participant-tile_video]:h-full [&_.lk-participant-tile_video]:w-full [&_.lk-participant-tile_video]:object-cover"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-white/10 bg-slate-950/95 px-4 py-3">
        <ControlBar variation="minimal" className="[&_.lk-button]:rounded-full [&_.lk-button]:border-0 [&_.lk-button]:shadow-none" />
      </div>
    </div>
  );
}

export default function SessionHubPage() {
  const params = useParams();
  const sessionId = String(params.sessionId);
  const authSession = useAuthStore((s) => s.session);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const token = authSession?.accessToken;
  const role = authSession?.role;

  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [participants, setParticipants] = useState<Participants | null>(null);
  const [joinData, setJoinData] = useState<JoinData | null>(null);
  const [connectLiveKit, setConnectLiveKit] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [recording, setRecording] = useState<Recording | null>(null);
  const [recordingAttempts, setRecordingAttempts] = useState<Recording[]>([]);
  const [recordingMessage, setRecordingMessage] = useState("");
  const [visibility, setVisibility] = useState<RecordingVisibility | null>(null);
  const [visibilityBusy, setVisibilityBusy] = useState(false);
  const [callError, setCallError] = useState("");
  const [roomParticipants, setRoomParticipants] = useState<PresenceRow[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const recordingStartedRef = useRef(false);

  const wsUrl = useMemo(() => {
    if (!token || !sessionId) return null;
    return apiWsUrl(`/sessions/${sessionId}/ws?token=${encodeURIComponent(token)}`);
  }, [token, sessionId]);

  const canManageVisibility = role === "mentor" || role === "manager" || role === "admin";

  async function loadRecording() {
    const resp = await authedFetch(`/sessions/${sessionId}/recordings`);
    const data = await parseJsonSafe(resp);
    if (resp.ok) {
      const attempts = Array.isArray(data) ? (data as Recording[]) : [];
      setRecordingAttempts(attempts);
      setRecording(attempts[0] ?? null);
      setRecordingMessage(attempts.length > 0 ? "" : "Automatic recording will appear here after the meeting is processed.");
      return;
    }
    if (resp.status === 404) {
      setRecording(null);
      setRecordingAttempts([]);
      setRecordingMessage("Automatic recording will appear here after the meeting is processed.");
      return;
    }
    setRecording(null);
    setRecordingAttempts([]);
    setRecordingMessage(data?.detail ?? "Recording status is unavailable right now.");
  }

  async function loadVisibility() {
    const resp = await authedFetch(`/sessions/${sessionId}/recording-visibility`);
    const data = await parseJsonSafe(resp);
    if (resp.ok) setVisibility(data);
  }

  async function bootstrap() {
    if (!hasHydrated) return;
    if (!authSession?.accessToken) {
      setCallError("Your sign-in session expired. Please sign in again to open this meeting.");
      return;
    }
    try {
      const [sessionResp, participantsResp] = await Promise.all([
        authedFetch(`/sessions/${sessionId}`),
        authedFetch(`/sessions/${sessionId}/participants`),
      ]);
      const [details, participantsData] = await Promise.all([
        parseJsonSafe(sessionResp),
        parseJsonSafe(participantsResp),
      ]);

      if (sessionResp.status === 401 || participantsResp.status === 401) {
        setCallError("Your sign-in session expired. Please sign in again to open this meeting.");
        return;
      }
      if (!sessionResp.ok || !participantsResp.ok) {
        setCallError("Meeting details are not available right now. Refresh the page or reopen the session from your dashboard.");
        return;
      }

      setSessionInfo(sessionResp.ok ? details : null);
      setParticipants(participantsResp.ok ? participantsData : null);
      setCallError("");
      await Promise.all([loadVisibility(), loadRecording()]);
    } catch {
      setCallError("Meeting details are not available right now. Refresh the page or reopen the session from your dashboard.");
    }
  }

  async function prepareJoin() {
    setIsJoining(true);
    setCallError("");
    try {
      const resp = await authedFetch(`/sessions/${sessionId}/join-token`, { method: "POST" });
      const data = await parseJsonSafe(resp);
      if (!resp.ok) {
        setCallError(data?.detail ?? "Unable to prepare the meeting room.");
        return;
      }
      recordingStartedRef.current = false;
      setJoinData(data);
      setConnectLiveKit(true);
    } finally {
      setIsJoining(false);
    }
  }

  async function ensureRecordingStarted() {
    if (recordingStartedRef.current) return;
    recordingStartedRef.current = true;
    const resp = await authedFetch("/sessions/recordings/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId }),
    });
    const data = await parseJsonSafe(resp);
    if (!resp.ok) {
      recordingStartedRef.current = false;
      setRecordingMessage(data?.detail ?? "Automatic recording could not be started.");
      return;
    }
    setRecording(data);
    setRecordingAttempts((current) =>
      [data as Recording, ...current.filter((item) => item.id !== data?.id)].sort(
        (a, b) => (b.attempt_number ?? 0) - (a.attempt_number ?? 0),
      ),
    );
    setRecordingMessage("Meeting recording is active and will remain available for student review.");
  }

  async function updateVisibility() {
    if (!visibility) return;
    setVisibilityBusy(true);
    try {
      const resp = await authedFetch(`/sessions/${sessionId}/recording-visibility`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(visibility),
      });
      const data = await parseJsonSafe(resp);
      if (resp.ok) {
        setVisibility(data);
      }
    } finally {
      setVisibilityBusy(false);
    }
  }

  async function deleteRecording() {
    const confirmed = window.confirm("Delete this recording? Students will lose access until a new recording is generated.");
    if (!confirmed) return;
    const resp = await authedFetch(`/sessions/${sessionId}/recording`, { method: "DELETE" });
    if (resp.ok) {
      setRecording(null);
      setRecordingMessage("Recording deleted.");
    }
  }

  useEffect(() => {
    void bootstrap();
  }, [sessionId, hasHydrated, authSession?.accessToken]);

  useEffect(() => {
    if (!wsUrl) return;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      let payload: SignalPayload;
      try {
        payload = JSON.parse(event.data) as SignalPayload;
      } catch {
        return;
      }

      if (payload.type === "presence_snapshot") {
        setRoomParticipants(payload.participants ?? []);
        return;
      }
      if (payload.type === "presence" || payload.type === "presence_leave") {
        void bootstrap();
        return;
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [wsUrl]);

  useEffect(() => {
    if (!isConnected) return;
    void ensureRecordingStarted();
    const id = window.setInterval(() => {
      void loadRecording();
    }, 10000);
    return () => window.clearInterval(id);
  }, [isConnected]);

  const recordingEta = useMemo(() => {
    const durationMinutes = sessionInfo?.duration_minutes ?? 60;
    const processingMinutes = Math.max(3, Math.min(18, Math.ceil(durationMinutes / 8)));
    const createdAt = recording?.created_at ? new Date(recording.created_at) : null;
    const now = new Date();
    const baseTime = createdAt && createdAt.getTime() > now.getTime() ? createdAt : now;
    const readyAt = new Date(baseTime.getTime() + processingMinutes * 60 * 1000);
    return {
      processingMinutes,
      readyAtLabel: formatIstTime(readyAt),
    };
  }, [recording?.created_at, sessionInfo?.duration_minutes]);

  const recordingStatus = useMemo(() => {
    if (recording?.status === "uploaded") {
      return {
        label: "Recording Available",
        icon: "fa-circle-check",
        className: "border-sky-200 bg-sky-50 text-sky-800",
        note: "The latest recording is ready to watch.",
      };
    }
    if (recording?.status === "failed") {
      return {
        label: "Recording Failed",
        icon: "fa-triangle-exclamation",
        className: "border-rose-200 bg-rose-50 text-rose-700",
        note: recording.error_message || "The latest recording attempt failed.",
      };
    }
    if (recording?.status === "recording" && isConnected) {
      return {
        label: "Recording In Progress",
        icon: "fa-record-vinyl",
        className: "border-red-200 bg-red-50 text-red-700",
        note: "The meeting is live and the current attempt is recording.",
      };
    }
    if (recording?.status === "recording") {
      return {
        label: "Finalizing Recording",
        icon: "fa-clock",
        className: "border-amber-200 bg-amber-50 text-amber-800",
        note: `The meeting ended. Recording review should be ready in about ${recordingEta.processingMinutes} minutes, around ${recordingEta.readyAtLabel} IST.`,
      };
    }
    if (recording?.status === "queued") {
      return {
        label: "Preparing Recording",
        icon: "fa-clock",
        className: "border-amber-200 bg-amber-50 text-amber-800",
        note: `Processing has started. Recording review should be ready in about ${recordingEta.processingMinutes} minutes, around ${recordingEta.readyAtLabel} IST.`,
      };
    }
    return {
      label: "Recording Starts Automatically",
      icon: "fa-cloud-arrow-up",
      className: "border-slate-200 bg-slate-50 text-slate-700",
      note: recordingMessage || "Recording starts automatically when the meeting begins.",
    };
  }, [isConnected, recording, recordingEta, recordingMessage]);

  return (
    <section className="space-y-4">
      <header className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-teal-50 p-6 shadow-sm">
        <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full bg-teal-100/70 blur-3xl" />
        <div className="pointer-events-none absolute -left-6 bottom-0 h-24 w-24 rounded-full bg-amber-100/70 blur-2xl" />

        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600">
              <i className="fa-solid fa-video text-teal-600" />
              mentorXAI Meeting Space
            </p>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950">Meeting Room</h1>
            <p className="mt-2 max-w-xl text-sm text-slate-600">
              Secure live session space for scheduled classes and instant mentor calls.
            </p>
          </div>
          {sessionInfo && (
            <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm ${sessionStatusClasses(sessionInfo.status)}`}>
              <i className={sessionStatusIcon(sessionInfo.status)} />
              {formatSessionStatus(sessionInfo.status)}
            </span>
          )}
        </div>

        {callError && (
          <div className="relative mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <div className="flex items-start gap-3">
              <i className="fa-solid fa-triangle-exclamation mt-0.5" />
              <p>{callError}</p>
            </div>
          </div>
        )}

        {sessionInfo && (
          <div className="relative mt-5 grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Session</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">{sessionInfo.title}</p>
                <p className="mt-2 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
                  <i className="fa-solid fa-hashtag text-slate-400" />
                  {sessionInfo.id.slice(0, 8)}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Schedule</p>
                <div className="mt-3 space-y-3 text-sm text-slate-700">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                      <i className="fa-solid fa-calendar-day" />
                    </span>
                    <div>
                      <p className="font-semibold text-slate-900">{formatIstDateTime(sessionInfo.starts_at)}</p>
                      <p className="text-xs text-slate-500">IST</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                      <i className="fa-regular fa-clock" />
                    </span>
                    <div>
                      <p className="font-semibold text-slate-900">{sessionInfo.duration_minutes} minutes</p>
                      <p className="text-xs text-slate-500">Planned meeting duration</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm md:col-span-2">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Participants</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Student</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{participants?.student?.name ?? sessionInfo.student_id}</p>
                    <p className="mt-1 text-xs text-slate-500">{participants?.student?.email ?? sessionInfo.student_id}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Mentor</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{participants?.mentor?.name ?? sessionInfo.mentor_id}</p>
                    <p className="mt-1 text-xs text-slate-500">{participants?.mentor?.email ?? sessionInfo.mentor_id}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Room Presence</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {roomParticipants.length > 0 ? (
                    roomParticipants.map((person) => (
                      <span
                        key={person.connection_id ?? `${person.user_id}-${person.joined_at ?? ""}`}
                        className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800"
                      >
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        {person.user_name ?? person.user_id}
                      </span>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                      Waiting for participants to join the room.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Meeting Notes</p>
                <p className="mt-3 text-sm font-medium leading-6 text-slate-800">
                  {sessionInfo.notes || "No additional notes for this meeting."}
                </p>
              </div>
            </div>
          </div>
        )}
      </header>

      <article className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Live Meeting</h2>
            <p className="mt-1 text-sm text-slate-600">
              Shared room for student and mentor with automatic cloud recording and retained playback.
            </p>
          </div>
          {!connectLiveKit ? (
            <button
              className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
              onClick={() => void prepareJoin()}
              disabled={isJoining}
            >
              <i className={`mr-2 ${isJoining ? "fa-solid fa-spinner fa-spin" : "fa-solid fa-video"}`} />
              {isJoining ? "Preparing Room" : "Join Meeting"}
            </button>
          ) : (
            <button
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700"
              onClick={() => {
                setConnectLiveKit(false);
                setIsConnected(false);
              }}
            >
              <i className="fa-solid fa-phone-slash mr-2" />
              Leave Meeting
            </button>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${isConnected ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-50 text-slate-700"}`}>
            <i className={`fa-solid ${isConnected ? "fa-signal" : "fa-door-open"}`} />
            {isConnected ? "Connected to Meeting" : "Ready to Join"}
          </span>
          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${recordingStatus.className}`}>
            <i className={`fa-solid ${recordingStatus.icon}`} />
            {recordingStatus.label}
          </span>
        </div>

        <p className="mt-3 text-sm text-slate-600">{recordingStatus.note}</p>

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-950">
          {joinData && connectLiveKit ? (
            <LiveKitRoom
              token={joinData.token}
              serverUrl={joinData.livekit_url}
              connect={connectLiveKit}
              video
              audio
              data-lk-theme="default"
              className="h-[720px]"
              onConnected={() => {
                setIsConnected(true);
                setCallError("");
              }}
              onDisconnected={() => {
                setIsConnected(false);
                setConnectLiveKit(false);
                void loadRecording();
              }}
              onError={(error) => {
                setCallError(error.message || "Unable to connect to meeting room.");
              }}
            >
              <MeetingStage />
              <RoomAudioRenderer />
            </LiveKitRoom>
          ) : (
            <div className="flex h-[420px] flex-col items-center justify-center gap-3 px-6 text-center text-slate-200">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
                <i className="fa-solid fa-video text-2xl" />
              </div>
              <div>
                <p className="text-lg font-semibold">Meeting room is ready</p>
                <p className="mt-1 text-sm text-slate-400">
                  Join to start camera, microphone, and automatic session recording.
                </p>
              </div>
            </div>
          )}
        </div>
      </article>

      <article className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-950">Recording Review</h2>
          {(role === "mentor" || role === "manager" || role === "admin") && (
            <button className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700" onClick={() => void loadRecording()}>
              Refresh
            </button>
          )}
        </div>
        {recording && recording.playback_url ? (
          <div className="mt-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${recordingStatus.className}`}>
                <i className={`fa-solid ${recordingStatus.icon}`} />
                {recordingStatus.label}
              </span>
              {(role === "manager" || role === "admin") && (
                <button className="rounded-xl border border-rose-300 px-3 py-1.5 text-sm font-semibold text-rose-700" onClick={() => void deleteRecording()}>
                  Delete Recording
                </button>
              )}
            </div>
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-black">
              <video
                src={recording.playback_url}
                controls
                controlsList="nodownload noplaybackrate"
                className="h-80 w-full bg-black"
                preload="metadata"
                onContextMenu={(e) => e.preventDefault()}
              />
            </div>
            <p className="text-xs text-slate-500">Recording is retained for student reference until manager or admin deletes it.</p>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-slate-600">{recordingStatus.note}</p>
            {(role === "manager" || role === "admin") && recording && (
              <button className="rounded-xl border border-rose-300 px-3 py-1.5 text-sm font-semibold text-rose-700" onClick={() => void deleteRecording()}>
                Delete Recording
              </button>
            )}
          </div>
        )}

        {recordingAttempts.length > 0 && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">Recorded Sessions</p>
              <p className="text-xs text-slate-500">{recordingAttempts.length} total</p>
            </div>
            <div className="mt-3 space-y-2">
              {recordingAttempts.map((attempt) => (
                <div key={attempt.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Session {attempt.attempt_number}</p>
                    <p className="text-xs text-slate-500">
                      {attempt.created_at ? formatIstDateTime(attempt.created_at) : "Timestamp unavailable"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-700">
                      {attempt.status.replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase())}
                    </span>
                    {attempt.playback_url && (
                      <a
                        href={attempt.playback_url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
                      >
                        Open
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {canManageVisibility && visibility && (
          <div className="mt-4 space-y-2 rounded-2xl border border-slate-200 p-4">
            <p className="text-sm font-semibold">Moderation & Visibility</p>
            <p className="text-sm text-slate-600">Use these controls to hide a recording from users or remove it entirely if the content is not acceptable.</p>
            {role !== "mentor" && (
              <>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={visibility.visible_to_student}
                    onChange={(e) => setVisibility((current) => (current ? { ...current, visible_to_student: e.target.checked } : current))}
                  />
                  Student can review recording
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={visibility.visible_to_mentor}
                    onChange={(e) => setVisibility((current) => (current ? { ...current, visible_to_mentor: e.target.checked } : current))}
                  />
                  Mentor can review recording
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={visibility.visible_to_manager}
                    onChange={(e) => setVisibility((current) => (current ? { ...current, visible_to_manager: e.target.checked } : current))}
                  />
                  Manager can review recording
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={visibility.visible_to_admin}
                    onChange={(e) => setVisibility((current) => (current ? { ...current, visible_to_admin: e.target.checked } : current))}
                  />
                  Admin can review recording
                </label>
              </>
            )}
            <button className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 disabled:opacity-50" onClick={() => void updateVisibility()} disabled={visibilityBusy}>
              {visibilityBusy ? "Saving..." : "Save Visibility"}
            </button>
          </div>
        )}
      </article>
    </section>
  );
}
