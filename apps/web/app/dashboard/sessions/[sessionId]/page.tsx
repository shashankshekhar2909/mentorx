"use client";

import { useParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { apiWsUrl, authedFetch, parseJsonSafe } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

type Message = {
  id: string;
  sender_id: string;
  message: string;
  created_at: string;
};

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

type Recording = {
  session_id: string;
  object_key: string | null;
  playback_url: string | null;
  status: string;
};

type RecordingVisibility = {
  session_id: string;
  visible_to_student: boolean;
  visible_to_mentor: boolean;
  visible_to_manager: boolean;
  visible_to_admin: boolean;
};

type Participants = {
  student: { id: string; name: string };
  mentor: { id: string; name: string };
};

type SignalPayload = {
  type: string;
  sender_id?: string;
  user_id?: string;
  user_name?: string;
  user_role?: string;
  participants?: Array<{ user_id: string; user_name?: string; user_role?: string }>;
  id?: string;
  message?: string;
  created_at?: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
};

type RtcDebugState = {
  ws_state: string;
  pc_state: string;
  ice_state: string;
  ready_sent: number;
  ready_recv: number;
  offer_sent: number;
  offer_recv: number;
  answer_sent: number;
  answer_recv: number;
  ice_sent: number;
  ice_recv: number;
  hangup_sent: number;
  hangup_recv: number;
  ws_messages_recv: number;
  last_event: string;
};

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export default function SessionHubPage() {
  const params = useParams();
  const sessionId = String(params.sessionId);
  const session = useAuthStore((s) => s.session);
  const token = session?.accessToken;
  const role = session?.role;

  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [text, setText] = useState("");
  const [callError, setCallError] = useState("");
  const [recording, setRecording] = useState<Recording | null>(null);
  const [recordingMessage, setRecordingMessage] = useState("");
  const [visibility, setVisibility] = useState<RecordingVisibility | null>(null);
  const [participants, setParticipants] = useState<Participants | null>(null);
  const [visibilityBusy, setVisibilityBusy] = useState(false);
  const [isInCall, setIsInCall] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isCamEnabled, setIsCamEnabled] = useState(true);
  const [localVideoState, setLocalVideoState] = useState("idle");
  const [selfUserId, setSelfUserId] = useState<string | null>(null);
  const [peerUserId, setPeerUserId] = useState<string | null>(null);
  const [peerConnected, setPeerConnected] = useState(false);
  const [roomParticipants, setRoomParticipants] = useState<Array<{ user_id: string; user_name?: string; user_role?: string }>>([]);
  const [rtcDebug, setRtcDebug] = useState<RtcDebugState>({
    ws_state: "idle",
    pc_state: "new",
    ice_state: "new",
    ready_sent: 0,
    ready_recv: 0,
    offer_sent: 0,
    offer_recv: 0,
    answer_sent: 0,
    answer_recv: 0,
    ice_sent: 0,
    ice_recv: 0,
    hangup_sent: 0,
    hangup_recv: 0,
    ws_messages_recv: 0,
    last_event: "init",
  });

  const wsRef = useRef<WebSocket | null>(null);
  const selfUserIdRef = useRef<string | null>(null);
  const peerUserIdRef = useRef<string | null>(null);
  const isInCallRef = useRef(false);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const madeOfferRef = useRef(false);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  const wsUrl = useMemo(() => {
    if (!token || !sessionId) return null;
    return apiWsUrl(`/sessions/${sessionId}/ws?token=${encodeURIComponent(token)}`);
  }, [token, sessionId]);

  const canManageVisibility = role === "mentor" || role === "manager" || role === "admin";
  const canUseLocalMedia = useMemo(() => {
    if (typeof window === "undefined") return false;
    return Boolean(window.isSecureContext && navigator.mediaDevices?.getUserMedia);
  }, []);
  const canRunWebRtcCall = role === "student" || role === "mentor" || role === "manager" || role === "admin";
  const preferredPeerId = useMemo(() => {
    if (!participants || !session) return null;
    if (session.role === "student") return participants.mentor.id;
    if (session.role === "mentor") return participants.student.id;
    if (session.role === "manager" || session.role === "admin") return participants.mentor.id || participants.student.id;
    return null;
  }, [participants, session]);

  async function loadRecording() {
    const resp = await authedFetch(`/sessions/${sessionId}/recording`);
    const data = await parseJsonSafe(resp);
    if (resp.ok) {
      setRecording(data);
      setRecordingMessage("");
      return;
    }
    if (resp.status === 404) {
      setRecording(null);
      setRecordingMessage("No recording available yet.");
      return;
    }
    setRecording(null);
    setRecordingMessage(data?.detail ?? "Recording unavailable");
  }

  async function loadVisibility() {
    const resp = await authedFetch(`/sessions/${sessionId}/recording-visibility`);
    const data = await parseJsonSafe(resp);
    if (resp.ok) setVisibility(data);
  }

  function sendSignal(type: string, payload: Record<string, unknown> = {}) {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    setRtcDebug((prev) => {
      const next = { ...prev, last_event: `send:${type}` };
      if (type === "webrtc_ready") next.ready_sent += 1;
      else if (type === "webrtc_offer") next.offer_sent += 1;
      else if (type === "webrtc_answer") next.answer_sent += 1;
      else if (type === "webrtc_ice") next.ice_sent += 1;
      else if (type === "webrtc_hangup") next.hangup_sent += 1;
      return next;
    });
    ws.send(JSON.stringify({ type, ...payload }));
  }

  function cleanupPeerConnection() {
    const pc = pcRef.current;
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      pc.close();
    }
    pcRef.current = null;
    remoteStreamRef.current = null;
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    setPeerConnected(false);
    madeOfferRef.current = false;
  }

  function stopLocalStream() {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
  }

  function ensurePeerConnection(): RTCPeerConnection {
    if (pcRef.current) return pcRef.current;
    const pc = new RTCPeerConnection(RTC_CONFIG);
    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      sendSignal("webrtc_ice", { candidate: event.candidate.toJSON() });
    };
    pc.oniceconnectionstatechange = () => {
      setRtcDebug((prev) => ({ ...prev, ice_state: pc.iceConnectionState, last_event: `ice:${pc.iceConnectionState}` }));
    };
    pc.ontrack = (event) => {
      if (!remoteStreamRef.current) {
        remoteStreamRef.current = new MediaStream();
      }
      for (const track of event.streams[0]?.getTracks() ?? [event.track]) {
        remoteStreamRef.current.addTrack(track);
      }
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStreamRef.current;
      }
    };
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      setPeerConnected(state === "connected");
      setRtcDebug((prev) => ({ ...prev, pc_state: state, last_event: `pc:${state}` }));
      if (state === "failed" || state === "disconnected" || state === "closed") {
        // Keep local user in the call screen; peer can reconnect.
        cleanupPeerConnection();
      }
    };
    pcRef.current = pc;
    return pc;
  }

  async function maybeCreateOffer() {
    const selfId = selfUserIdRef.current;
    const peerId = peerUserIdRef.current;
    if (!isInCallRef.current || !selfId || !peerId || madeOfferRef.current) return;
    if (!canRunWebRtcCall) return;
    const shouldInitiate = selfId < peerId;
    if (!shouldInitiate) return;
    const pc = ensurePeerConnection();
    if (localStreamRef.current) {
      for (const track of localStreamRef.current.getTracks()) {
        if (!pc.getSenders().some((s) => s.track?.id === track.id)) {
          pc.addTrack(track, localStreamRef.current);
        }
      }
    }
    if (pc.signalingState !== "stable") return;
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    madeOfferRef.current = true;
    sendSignal("webrtc_offer", { sdp: offer });
  }

  async function startCall() {
    if (!canRunWebRtcCall) {
      setCallError("Direct WebRTC call is available only for student and mentor.");
      return;
    }
    if (!canUseLocalMedia) {
      setCallError("Open MentorX on HTTPS or localhost to enable microphone/camera and join call.");
      return;
    }
    try {
      setCallError("");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      const videoTracks = stream.getVideoTracks();
      if (videoTracks.length === 0) {
        setCallError("Camera track not available. Check camera permissions/device.");
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      localStreamRef.current = stream;
      setLocalVideoState("live");
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        void localVideoRef.current.play().catch(() => {
          setLocalVideoState("autoplay_blocked");
        });
      }
      const pc = ensurePeerConnection();
      for (const track of stream.getTracks()) {
        pc.addTrack(track, stream);
      }
      isInCallRef.current = true;
      setIsInCall(true);
      setIsMicEnabled(true);
      setIsCamEnabled(true);
      sendSignal("webrtc_ready");
      await maybeCreateOffer();
    } catch {
      setCallError("Unable to access microphone/camera. Please allow browser permissions.");
    }
  }

  function leaveCall(notifyPeer: boolean) {
    if (notifyPeer) sendSignal("webrtc_hangup");
    cleanupPeerConnection();
    stopLocalStream();
    isInCallRef.current = false;
    setIsInCall(false);
    setIsMicEnabled(true);
    setIsCamEnabled(true);
  }

  function onPeerLeftCall() {
    cleanupPeerConnection();
    setPeerConnected(false);
    setCallError("Peer left the call. You can stay here and they can rejoin.");
  }

  function toggleMic() {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !isMicEnabled;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = next;
    });
    setIsMicEnabled(next);
  }

  function toggleCam() {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !isCamEnabled;
    stream.getVideoTracks().forEach((track) => {
      track.enabled = next;
    });
    setIsCamEnabled(next);
    setLocalVideoState(next ? "live" : "disabled");
  }

  useEffect(() => {
    selfUserIdRef.current = selfUserId;
  }, [selfUserId]);

  useEffect(() => {
    peerUserIdRef.current = peerUserId;
  }, [peerUserId]);

  useEffect(() => {
    isInCallRef.current = isInCall;
  }, [isInCall]);

  useEffect(() => {
    async function bootstrap() {
      try {
        const [historyResp, sessionResp, participantsResp] = await Promise.all([
          authedFetch(`/sessions/${sessionId}/messages`),
          authedFetch(`/sessions/${sessionId}`),
          authedFetch(`/sessions/${sessionId}/participants`),
        ]);
        const [history, details, participantsData] = await Promise.all([
          parseJsonSafe(historyResp),
          parseJsonSafe(sessionResp),
          parseJsonSafe(participantsResp),
        ]);

        setSessionInfo(details?.id ? details : null);
        setMessages(Array.isArray(history) ? history : []);
        setParticipants(participantsResp.ok ? participantsData : null);

        await loadVisibility();
        const statusValue = String(details?.status ?? "");
        if (["in_progress", "completed"].includes(statusValue)) {
          await loadRecording();
        } else {
          setRecording(null);
          setRecordingMessage("Recording appears after the call starts/completes.");
        }
      } catch {
        setCallError("Unable to load session hub right now. Please refresh.");
      }
    }
    void bootstrap();
  }, [sessionId]);

  useEffect(() => {
    if (!wsUrl) return;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    setRtcDebug((prev) => ({ ...prev, ws_state: "connecting", last_event: "ws:connecting" }));

    ws.onopen = () => {
      setRtcDebug((prev) => ({ ...prev, ws_state: "open", last_event: "ws:open" }));
    };

    ws.onerror = () => {
      setRtcDebug((prev) => ({ ...prev, ws_state: "error", last_event: "ws:error" }));
    };

    ws.onclose = () => {
      setRtcDebug((prev) => ({ ...prev, ws_state: "closed", last_event: "ws:closed" }));
    };

    ws.onmessage = async (event) => {
      let payload: SignalPayload;
      try {
        payload = JSON.parse(event.data) as SignalPayload;
      } catch {
        return;
      }
      setRtcDebug((prev) => ({ ...prev, ws_messages_recv: prev.ws_messages_recv + 1, last_event: `recv:${payload.type}` }));

      if (payload.type === "presence" && payload.user_id) {
        const userId = payload.user_id;
        if (!userId) return;
        setRoomParticipants((prev) => {
          const exists = prev.some((p) => p.user_id === userId);
          if (exists) return prev.map((p) => (p.user_id === userId ? { ...p, user_name: payload.user_name, user_role: payload.user_role } : p));
          return [...prev, { user_id: userId, user_name: payload.user_name, user_role: payload.user_role }];
        });
        const currentSelf = selfUserIdRef.current;
        if (!currentSelf) {
          // Identify self by known session identity (email + role) when available.
          if ((payload.user_name && payload.user_name === session?.email) || (payload.user_role && payload.user_role === role)) {
            selfUserIdRef.current = userId;
            setSelfUserId(userId);
            return;
          }
        }
        if (userId !== selfUserIdRef.current) {
          const desiredPeer = preferredPeerId ?? userId;
          if (userId !== desiredPeer) return;
          if (peerUserIdRef.current && peerUserIdRef.current !== userId) return;
          peerUserIdRef.current = userId;
          setPeerUserId(userId);
          if (isInCallRef.current) await maybeCreateOffer();
        }
        return;
      }

      if (payload.type === "presence_snapshot" && Array.isArray(payload.participants)) {
        setRoomParticipants(payload.participants);
        if (!selfUserIdRef.current) {
          const foundSelf = payload.participants.find(
            (p) => (p.user_name && p.user_name === session?.email) || (p.user_role && p.user_role === role),
          );
          if (foundSelf?.user_id) {
            selfUserIdRef.current = foundSelf.user_id;
            setSelfUserId(foundSelf.user_id);
          }
        }
        const candidatePeer = payload.participants.find(
          (p) => p.user_id !== selfUserIdRef.current && (!preferredPeerId || p.user_id === preferredPeerId),
        );
        if (candidatePeer?.user_id) {
          if (!peerUserIdRef.current || peerUserIdRef.current === candidatePeer.user_id) {
            peerUserIdRef.current = candidatePeer.user_id;
            setPeerUserId(candidatePeer.user_id);
          }
          if (isInCallRef.current) {
            madeOfferRef.current = false;
            await maybeCreateOffer();
          }
        }
        return;
      }

      if (payload.type === "presence_leave" && payload.user_id) {
        setRoomParticipants((prev) => prev.filter((p) => p.user_id !== payload.user_id));
        if (peerUserIdRef.current === payload.user_id) {
          onPeerLeftCall();
        }
        return;
      }

      if (payload.type === "webrtc_ready" && payload.sender_id) {
        setRtcDebug((prev) => ({ ...prev, ready_recv: prev.ready_recv + 1, last_event: "recv:webrtc_ready" }));
        if (payload.sender_id !== selfUserIdRef.current) {
          if (preferredPeerId && payload.sender_id !== preferredPeerId) return;
          peerUserIdRef.current = payload.sender_id;
          setPeerUserId(payload.sender_id);
          if (isInCallRef.current) {
            // Peer may have joined after our first offer; allow re-offer.
            madeOfferRef.current = false;
            await maybeCreateOffer();
          }
        }
        return;
      }

      if (payload.type === "message" && payload.id && payload.sender_id && payload.message && payload.created_at) {
        const nextMessage: Message = {
          id: payload.id,
          sender_id: payload.sender_id,
          message: payload.message,
          created_at: payload.created_at,
        };
        setMessages((prev) => [...prev, nextMessage]);
        return;
      }

      if (!isInCallRef.current) return;
      if (payload.sender_id && payload.sender_id === selfUserIdRef.current) return;

      if (payload.type === "webrtc_offer" && payload.sdp) {
        setRtcDebug((prev) => ({ ...prev, offer_recv: prev.offer_recv + 1, last_event: "recv:webrtc_offer" }));
        const pc = ensurePeerConnection();
        if (localStreamRef.current) {
          for (const track of localStreamRef.current.getTracks()) {
            if (!pc.getSenders().some((s) => s.track?.id === track.id)) {
              pc.addTrack(track, localStreamRef.current);
            }
          }
        }
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignal("webrtc_answer", { sdp: answer });
        return;
      }

      if (payload.type === "webrtc_answer" && payload.sdp && pcRef.current) {
        setRtcDebug((prev) => ({ ...prev, answer_recv: prev.answer_recv + 1, last_event: "recv:webrtc_answer" }));
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        return;
      }

      if (payload.type === "webrtc_ice" && payload.candidate && pcRef.current) {
        setRtcDebug((prev) => ({ ...prev, ice_recv: prev.ice_recv + 1, last_event: "recv:webrtc_ice" }));
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
        } catch {
          // Ignore invalid or stale ICE candidates.
        }
        return;
      }

      if (payload.type === "webrtc_hangup") {
        setRtcDebug((prev) => ({ ...prev, hangup_recv: prev.hangup_recv + 1, last_event: "recv:webrtc_hangup" }));
        onPeerLeftCall();
      }
    };

    return () => {
      ws.close();
    };
  }, [wsUrl, preferredPeerId, role, session?.email]);

  useEffect(() => {
    if (isInCall) {
      void maybeCreateOffer();
    }
  }, [isInCall, selfUserId, peerUserId]);

  useEffect(() => {
    if (!isInCall) return;
    const id = window.setInterval(() => {
      if (!peerConnected) sendSignal("webrtc_ready");
    }, 2000);
    return () => window.clearInterval(id);
  }, [isInCall, peerConnected]);

  useEffect(() => {
    if (!isInCall) return;
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
      void localVideoRef.current.play().catch(() => {
        setLocalVideoState("autoplay_blocked");
      });
    }
    if (remoteVideoRef.current && remoteStreamRef.current) {
      remoteVideoRef.current.srcObject = remoteStreamRef.current;
      void remoteVideoRef.current.play().catch(() => {
        // Browser autoplay policy can block; user can interact with call controls.
      });
    }
  }, [isInCall, peerConnected]);

  useEffect(() => {
    return () => {
      leaveCall(false);
    };
  }, []);

  function send(event: FormEvent) {
    event.preventDefault();
    const value = text.trim();
    if (!value || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ message: value }));
    setText("");
  }

  async function updateVisibility() {
    if (!visibility) return;
    setVisibilityBusy(true);
    try {
      const payload =
        role === "mentor"
          ? {}
          : {
              visible_to_mentor: visibility.visible_to_mentor,
              visible_to_manager: visibility.visible_to_manager,
              visible_to_admin: visibility.visible_to_admin,
            };
      const resp = await authedFetch(`/sessions/${sessionId}/recording-visibility`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await parseJsonSafe(resp);
      if (resp.ok) {
        setVisibility(data);
        setRecordingMessage("Recording visibility updated");
      } else {
        setRecordingMessage(data?.detail ?? "Failed to update visibility");
      }
    } finally {
      setVisibilityBusy(false);
    }
  }

  return (
    <section className="space-y-4">
      <header className="rounded-xl bg-card p-5 shadow-sm">
        <h1 className="text-2xl font-bold">Session Hub</h1>
        <p className="text-sm text-black/70">Session ID: {sessionId}</p>
        {callError && <p className="mt-2 text-sm text-red-600">{callError}</p>}
        {sessionInfo && (
          <div className="mt-3 grid gap-2 text-xs md:grid-cols-3">
            <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
              <p className="text-slate-500">Session Name</p>
              <p className="font-semibold text-slate-800">{sessionInfo.title}</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
              <p className="text-slate-500">When</p>
              <p className="font-semibold text-slate-800">{new Date(sessionInfo.starts_at).toLocaleString()}</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
              <p className="text-slate-500">Duration / Status</p>
              <p className="font-semibold text-slate-800">
                {sessionInfo.duration_minutes} min • {sessionInfo.status}
              </p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 md:col-span-2">
              <p className="text-slate-500">Participants</p>
              <p className="font-semibold text-slate-800">
                Student: {participants?.student?.name ?? sessionInfo.student_id} | Mentor:{" "}
                {participants?.mentor?.name ?? sessionInfo.mentor_id}
              </p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 md:col-span-3">
              <p className="text-slate-500">In Room</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {roomParticipants.map((p) => (
                  <span key={p.user_id} className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                    {p.user_name ?? p.user_id} {p.user_role ? `(${p.user_role})` : ""}
                  </span>
                ))}
                {roomParticipants.length === 0 && <span className="text-[11px] text-slate-500">Waiting for participants</span>}
              </div>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
              <p className="text-slate-500">Notes</p>
              <p className="font-semibold text-slate-800">{sessionInfo.notes || "No notes"}</p>
            </div>
          </div>
        )}
      </header>

      <article className="rounded-xl bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Call (WebRTC)</h2>
          {!isInCall ? (
            <button className="rounded-md bg-accent px-4 py-2 text-sm text-white" onClick={() => void startCall()}>
              Join Call
            </button>
          ) : (
            <button className="rounded-md border px-4 py-2 text-sm" onClick={() => leaveCall(true)}>
              Leave Call
            </button>
          )}
        </div>
        {!isInCall && (
          <p className="mt-2 text-sm text-black/70">
            {canUseLocalMedia
              ? "Click Join Call to start direct student-mentor WebRTC audio/video."
              : "Mic/camera access is blocked on HTTP. Open this app via HTTPS or localhost."}
          </p>
        )}
        {!canRunWebRtcCall && <p className="mt-2 text-sm text-black/70">Manager/Admin can review chat and recordings; live call is student-mentor only.</p>}
        {isInCall && (
          <>
            <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-700">
              <div className="grid gap-1 md:grid-cols-3">
                <p>WS: {rtcDebug.ws_state}</p>
                <p>PC: {rtcDebug.pc_state}</p>
                <p>ICE: {rtcDebug.ice_state}</p>
                <p>ready s/r: {rtcDebug.ready_sent}/{rtcDebug.ready_recv}</p>
                <p>offer s/r: {rtcDebug.offer_sent}/{rtcDebug.offer_recv}</p>
                <p>answer s/r: {rtcDebug.answer_sent}/{rtcDebug.answer_recv}</p>
                <p>ice s/r: {rtcDebug.ice_sent}/{rtcDebug.ice_recv}</p>
                <p>hangup s/r: {rtcDebug.hangup_sent}/{rtcDebug.hangup_recv}</p>
                <p>ws msgs: {rtcDebug.ws_messages_recv}</p>
              </div>
              <p className="mt-1 text-slate-500">Last: {rtcDebug.last_event}</p>
            </div>
            <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-white/20 bg-black/70 px-4 py-3 shadow-xl backdrop-blur">
              <button
                className={`inline-flex h-12 w-12 items-center justify-center rounded-full text-white ${isMicEnabled ? "bg-slate-700 hover:bg-slate-800" : "bg-amber-500 hover:bg-amber-600"}`}
                onClick={toggleMic}
                title={isMicEnabled ? "Mute microphone" : "Unmute microphone"}
                aria-label={isMicEnabled ? "Mute microphone" : "Unmute microphone"}
              >
                <i className={`fa-solid ${isMicEnabled ? "fa-microphone" : "fa-microphone-slash"}`} />
              </button>
              <button
                className={`inline-flex h-12 w-12 items-center justify-center rounded-full text-white ${isCamEnabled ? "bg-slate-700 hover:bg-slate-800" : "bg-amber-500 hover:bg-amber-600"}`}
                onClick={toggleCam}
                title={isCamEnabled ? "Turn camera off" : "Turn camera on"}
                aria-label={isCamEnabled ? "Turn camera off" : "Turn camera on"}
              >
                <i className={`fa-solid ${isCamEnabled ? "fa-video" : "fa-video-slash"}`} />
              </button>
              <button
                className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-700"
                onClick={() => leaveCall(true)}
                title="Leave call"
                aria-label="Leave call"
              >
                <i className="fa-solid fa-phone-slash" />
              </button>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-md border bg-black p-2">
                <p className="mb-2 text-xs text-slate-200">
                  Your Camera {isMicEnabled ? "" : "• muted"} {isCamEnabled ? "" : "• video off"} • {localVideoState}
                </p>
                <video ref={localVideoRef} autoPlay playsInline muted className="h-64 w-full rounded object-cover" />
              </div>
              <div className="rounded-md border bg-black p-2">
                <p className="mb-2 text-xs text-slate-200">Peer Camera {peerConnected ? "• connected" : "• waiting"}</p>
                <video ref={remoteVideoRef} autoPlay playsInline className="h-64 w-full rounded object-cover" />
              </div>
            </div>
          </>
        )}
      </article>

      <article className="rounded-xl bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recording</h2>
          {role !== "student" && (
            <button className="rounded-md border px-3 py-1.5 text-xs" onClick={() => void loadRecording()}>
              Refresh
            </button>
          )}
        </div>
        {recording && recording.playback_url ? (
          <div className="mt-3 space-y-2">
            <p className="text-sm text-black/70">Status: {recording.status}</p>
            <a
              className="inline-flex rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-white"
              href={recording.playback_url}
              target="_blank"
              rel="noreferrer"
            >
              Open Recording
            </a>
          </div>
        ) : (
          <p className="mt-2 text-sm text-black/70">
            {role === "student"
              ? "Recording will appear automatically after call completion."
              : recordingMessage || "Recording not ready yet."}
          </p>
        )}

        {canManageVisibility && visibility && (
          <div className="mt-4 space-y-2 rounded-lg border p-3">
            <p className="text-sm font-semibold">Visibility Control</p>
            <p className="text-sm text-slate-600">Student visibility is always enabled.</p>
            {role !== "mentor" && (
              <>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={visibility.visible_to_mentor}
                    onChange={(e) => setVisibility((v) => (v ? { ...v, visible_to_mentor: e.target.checked } : v))}
                  />
                  Mentor can view recording
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={visibility.visible_to_manager}
                    onChange={(e) => setVisibility((v) => (v ? { ...v, visible_to_manager: e.target.checked } : v))}
                  />
                  Manager can view recording
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={visibility.visible_to_admin}
                    onChange={(e) => setVisibility((v) => (v ? { ...v, visible_to_admin: e.target.checked } : v))}
                  />
                  Admin can view recording
                </label>
              </>
            )}
            <button
              className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
              onClick={() => void updateVisibility()}
              disabled={visibilityBusy}
            >
              {visibilityBusy ? "Saving..." : "Save Visibility"}
            </button>
          </div>
        )}
      </article>

      <article className="rounded-xl bg-card p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Realtime Chat</h2>
        <div className="mt-3 max-h-80 space-y-2 overflow-y-auto rounded-md border p-3 text-sm">
          {messages.map((m) => (
            <div key={m.id} className="rounded border p-2">
              <div className="text-xs text-black/60">
                {m.sender_id === participants?.student?.id
                  ? participants?.student?.name
                  : m.sender_id === participants?.mentor?.id
                    ? participants?.mentor?.name
                    : m.sender_id}
              </div>
              <div>{m.message}</div>
            </div>
          ))}
          {messages.length === 0 && <p className="text-black/60">No messages yet.</p>}
        </div>

        <form className="mt-3 flex gap-2" onSubmit={send}>
          <input
            className="flex-1 rounded-md border px-3 py-2"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message"
          />
          <button type="submit" className="rounded-md bg-accent px-4 py-2 text-white">
            Send
          </button>
        </form>
      </article>
    </section>
  );
}
