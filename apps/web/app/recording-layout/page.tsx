"use client";

import "@livekit/components-styles";

import { LiveKitRoom, ParticipantTile, RoomAudioRenderer, useTracks } from "@livekit/components-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef } from "react";
import { Track } from "livekit-client";

type CameraTrackRef = ReturnType<typeof useTracks>[number];

function PlaceholderTile({ label }: { label: string }) {
  return (
    <div className="flex aspect-video items-center justify-center rounded-[28px] border border-white/10 bg-white/5 text-white/70">
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-xl font-semibold">
          {label.slice(0, 1).toUpperCase()}
        </div>
        <p className="mt-3 text-sm font-medium">{label}</p>
      </div>
    </div>
  );
}

function sortCameraTracks(tracks: CameraTrackRef[]) {
  return [...tracks].sort((a, b) => {
    const aName = (a.participant.name || a.participant.identity || "").toLowerCase();
    const bName = (b.participant.name || b.participant.identity || "").toLowerCase();
    return aName.localeCompare(bName);
  });
}

function RecordingStage() {
  const startedRef = useRef(false);
  const screenTracks = useTracks([{ source: Track.Source.ScreenShare, withPlaceholder: false }], { onlySubscribed: false });
  const cameraTracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }], { onlySubscribed: false });

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    console.log("START_RECORDING");
    return () => {
      console.log("END_RECORDING");
    };
  }, []);

  const remoteScreenTracks = screenTracks.filter((track) => !track.participant.isLocal);
  const remoteCameraTracks = sortCameraTracks(cameraTracks.filter((track) => !track.participant.isLocal));
  const featuredScreen = remoteScreenTracks[0] ?? null;
  const cameraSlots = remoteCameraTracks.slice(0, 2);

  if (featuredScreen) {
    return (
      <div className="grid h-screen grid-cols-[1.65fr_0.7fr] gap-5 bg-[#0a1220] p-5 text-white">
        <div className="overflow-hidden rounded-[32px] border border-white/10 bg-[#050b14] shadow-2xl">
          <ParticipantTile
            trackRef={featuredScreen}
            className="h-full w-full [&_[data-lk-participant-name]]:bg-black/60 [&_[data-lk-participant-name]]:px-4 [&_[data-lk-participant-name]]:py-2 [&_[data-lk-participant-name]]:text-sm [&_.lk-participant-tile]:h-full [&_.lk-participant-tile]:w-full [&_.lk-participant-tile_video]:h-full [&_.lk-participant-tile_video]:w-full [&_.lk-participant-tile_video]:object-contain"
          />
        </div>

        <div className="flex flex-col gap-5">
          {cameraSlots.map((track) => (
            <div key={`${track.participant.identity}-${track.source}-${track.publication?.trackSid ?? "placeholder"}`} className="overflow-hidden rounded-[28px] border border-white/10 bg-[#050b14] shadow-xl">
              <ParticipantTile
                trackRef={track}
                className="aspect-video w-full [&_[data-lk-participant-name]]:bg-black/60 [&_[data-lk-participant-name]]:px-3 [&_[data-lk-participant-name]]:py-1.5 [&_[data-lk-participant-name]]:text-xs [&_.lk-participant-tile_video]:h-full [&_.lk-participant-tile_video]:w-full [&_.lk-participant-tile_video]:object-cover"
              />
            </div>
          ))}
          {cameraSlots.length === 0 && <PlaceholderTile label="Waiting for participants" />}
          {cameraSlots.length === 1 && <PlaceholderTile label="Second participant" />}
        </div>
        <RoomAudioRenderer />
      </div>
    );
  }

  return (
    <div className="grid h-screen grid-cols-2 gap-5 bg-[#0a1220] p-5 text-white">
      {cameraSlots.map((track) => (
        <div key={`${track.participant.identity}-${track.source}-${track.publication?.trackSid ?? "placeholder"}`} className="overflow-hidden rounded-[32px] border border-white/10 bg-[#050b14] shadow-2xl">
          <ParticipantTile
            trackRef={track}
            className="h-full w-full [&_[data-lk-participant-name]]:bg-black/60 [&_[data-lk-participant-name]]:px-4 [&_[data-lk-participant-name]]:py-2 [&_[data-lk-participant-name]]:text-sm [&_.lk-participant-tile]:h-full [&_.lk-participant-tile]:w-full [&_.lk-participant-tile_video]:h-full [&_.lk-participant-tile_video]:w-full [&_.lk-participant-tile_video]:object-cover"
          />
        </div>
      ))}
      {cameraSlots.length === 0 && (
        <>
          <PlaceholderTile label="Waiting for mentor" />
          <PlaceholderTile label="Waiting for student" />
        </>
      )}
      {cameraSlots.length === 1 && <PlaceholderTile label="Second participant" />}
      <RoomAudioRenderer />
    </div>
  );
}

function RecordingLayoutPageInner() {
  const params = useSearchParams();
  const serverUrl = params.get("url") || "";
  const token = params.get("token") || "";

  const canRender = useMemo(() => Boolean(serverUrl && token), [serverUrl, token]);

  if (!canRender) {
    return <div className="flex h-screen items-center justify-center bg-[#0a1220] text-sm text-white/70">Recording template is waiting for LiveKit egress.</div>;
  }

  return (
    <LiveKitRoom
      serverUrl={serverUrl}
      token={token}
      connect
      video
      audio
      className="h-screen"
    >
      <RecordingStage />
    </LiveKitRoom>
  );
}

export default function RecordingLayoutPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-[#0a1220] text-sm text-white/70">Loading recording layout...</div>}>
      <RecordingLayoutPageInner />
    </Suspense>
  );
}
