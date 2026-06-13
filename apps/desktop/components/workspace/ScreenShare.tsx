"use client";

import { useRef, useState, useEffect, useCallback } from "react";

interface ScreenShareProps {
  onFrame: (base64: string) => void;
  onTranscript: (text: string, source: "mic" | "screen") => void;
  onFrameRequest?: (base64: string) => void;
}

// Compare two canvas frames and return the percentage of pixels that changed
function getFrameDifference(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  prevData: Uint8ClampedArray | null
): { different: boolean; newData: Uint8ClampedArray } {
  const current = ctx.getImageData(0, 0, width, height);
  const newData = current.data;

  if (!prevData || prevData.length !== newData.length) {
    return { different: true, newData };
  }

  // Sample every 20th pixel for performance (good enough for change detection)
  let changedPixels = 0;
  const totalSampled = Math.floor(newData.length / (4 * 20));

  for (let i = 0; i < newData.length; i += 4 * 20) {
    const rDiff = Math.abs(newData[i] - prevData[i]);
    const gDiff = Math.abs(newData[i + 1] - prevData[i + 1]);
    const bDiff = Math.abs(newData[i + 2] - prevData[i + 2]);
    // Threshold of 15 per channel to ignore compression artifacts and subtle changes
    if (rDiff + gDiff + bDiff > 45) changedPixels++;
  }

  const changePercent = (changedPixels / totalSampled) * 100;
  // Only trigger if more than 3% of sampled pixels changed
  return { different: changePercent > 3, newData };
}

export function ScreenShare({ onFrame, onTranscript }: ScreenShareProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameIntervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const screenRecorderRef = useRef<MediaRecorder | null>(null);
  const micRecorderRef = useRef<MediaRecorder | null>(null);
  const screenAudioChunksRef = useRef<Blob[]>([]);
  const micAudioChunksRef = useRef<Blob[]>([]);
  const prevFrameDataRef = useRef<Uint8ClampedArray | null>(null);
  const isRecordingMicRef = useRef(false);

  const [sharing, setSharing] = useState(false);
  const [hasScreenAudio, setHasScreenAudio] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [isPTTRecording, setIsPTTRecording] = useState(false);
  const [changePercent, setChangePercent] = useState(0); // debug indicator

  const stopShare = useCallback(() => {

  if ((window as any).__TAURI_INTERNALS__) {
      import("@tauri-apps/api/event").then(({ emit }) => {
        emit("recording-status", { active: false });
      }).catch(() => {});
    }

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    clearInterval(frameIntervalRef.current);
    screenRecorderRef.current?.stop();
    micRecorderRef.current?.stop();
    prevFrameDataRef.current = null;
    setSharing(false);
    setHasScreenAudio(false);
    setMicActive(false);
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  // Always-on screen audio transcription (meeting/video audio)
  const startScreenAudioCapture = useCallback(
    (stream: MediaStream) => {
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) return;

      setHasScreenAudio(true);
      const audioStream = new MediaStream(audioTracks);

      const recorder = new MediaRecorder(audioStream, { mimeType: "audio/webm" });

      const sendChunk = async () => {
        if (screenAudioChunksRef.current.length === 0) return;
        const blob = new Blob(screenAudioChunksRef.current, { type: "audio/webm" });
        screenAudioChunksRef.current = [];

        const formData = new FormData();
        formData.append("audio", blob, "screen.webm");
        try {
          const res = await fetch("/api/transcribe", { method: "POST", body: formData });
          const { transcript } = await res.json();
          if (transcript?.trim() && transcript.trim().split(" ").length >= 6) {
            onTranscript(transcript, "screen");
          }
        } catch (err) {
          console.error("Screen audio transcription failed:", err);
        }
      };

      //recorder.ondataavailable = (e) => {
      //  if (e.data.size > 0) screenAudioChunksRef.current.push(e.data);
      //};

      recorder.ondataavailable = async (e) => {
  if (e.data.size === 0) return;

  const formData = new FormData();
  formData.append("audio", e.data, "screen.webm");

  try {
    const res = await fetch("/api/transcribe", {
      method: "POST",
      body: formData,
    });

    const { transcript } = await res.json();

    if (
      transcript?.trim() &&
      transcript.trim().split(" ").length >= 6
    ) {
      onTranscript(transcript, "screen");
    }
  } catch (err) {
    console.error("Screen transcription failed:", err);
  }
};

      screenRecorderRef.current = recorder;
      recorder.start(5000);
    },
    [onTranscript]
  );

  // Push-to-talk mic setup
  const setupMic = useCallback(async () => {
    try {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(micStream, { mimeType: "audio/webm" });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) micAudioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        if (micAudioChunksRef.current.length === 0) return;
        const blob = new Blob(micAudioChunksRef.current, { type: "audio/webm" });
        micAudioChunksRef.current = [];

        const formData = new FormData();
        formData.append("audio", blob, "mic.webm");
        try {
          const res = await fetch("/api/transcribe", { method: "POST", body: formData });
          const { transcript } = await res.json();
          // Ignore transcripts under 4 words — likely mic noise or bleed
        if (transcript?.trim() && transcript.trim().split(" ").length >= 4) {
          onTranscript(transcript, "mic");
        }
        } catch (err) {
          console.error("Mic transcription failed:", err);
        }
      };

      micRecorderRef.current = recorder;
      setMicActive(true);
    } catch (err) {
      console.error("Mic access failed:", err);
    }
  }, [onTranscript]);

  const startPTT = useCallback(() => {
    if (!micRecorderRef.current || isRecordingMicRef.current) return;

    // Force capture a fresh frame right when user starts speaking
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas && video.readyState >= 2) {
      canvas.width = Math.min(video.videoWidth, 1280);
      canvas.height = Math.min(video.videoHeight, 720);
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL("image/jpeg", 0.6).split(",")[1];
        onFrame(base64); // immediately store as latestFrame before transcription arrives
        console.log("📸 PTT frame forced");
      }
    }

    micAudioChunksRef.current = [];
    micRecorderRef.current.start();
    isRecordingMicRef.current = true;
    setIsPTTRecording(true);
  }, [onFrame]);

  const stopPTT = useCallback(() => {
    if (!micRecorderRef.current || !isRecordingMicRef.current) return;

    // Capture frame RIGHT before stopping — this is the freshest possible frame
    // and guarantees latestFrame is populated before transcription fires
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas && video.readyState >= 2) {
      canvas.width = Math.min(video.videoWidth, 1280);
      canvas.height = Math.min(video.videoHeight, 720);
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL("image/jpeg", 0.6).split(",")[1];
        onFrame(base64);
        console.log("📸 PTT stop — frame forced before transcription");
      }
    }

    micRecorderRef.current.stop();
    isRecordingMicRef.current = false;
    setIsPTTRecording(false);
  }, [onFrame]);

  const startShare = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 5, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: true,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setSharing(true);

      // Notify float of recording status
      if ((window as any).__TAURI_INTERNALS__) {
        import("@tauri-apps/api/event").then(({ emit }) => {
          emit("recording-status", { active: true });
        });
      }

      stream.getVideoTracks()[0].onended = () => stopShare();
      startScreenAudioCapture(stream);
      await setupMic();
    } catch (err) {
      console.log("Share cancelled:", err);
    }
  }, [stopShare, startScreenAudioCapture, setupMic]);

  // Register Tauri event listeners once on mount so float can control workspace
  useEffect(() => {
  if (typeof window === "undefined") return;
  if (!(window as any).__TAURI_INTERNALS__) return;

  let unlistenStop: (() => void) | null = null;
  let unlistenStart: (() => void) | null = null;
  let unlistenChange: (() => void) | null = null;
  let unlistenFrameReq: (() => void) | null = null;

  (async () => {
    const { listen } = await import("@tauri-apps/api/event");

    unlistenStop = await listen(
      "workspace-stop-recording",
      () => stopShare()
    );

    unlistenStart = await listen(
      "workspace-start-recording",
      () => startShare()
    );

    unlistenChange = await listen(
      "workspace-change-screen",
      () => {
        stopShare();
        setTimeout(() => startShare(), 400);
      }
    );

    unlistenFrameReq = await listen(
      "float-request-frame",
      async () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;

        if (
          !video ||
          !canvas ||
          video.readyState < 2 ||
          !streamRef.current
        ) {
          return;
        }

        canvas.width = Math.min(video.videoWidth, 1280);
        canvas.height = Math.min(video.videoHeight, 720);

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const base64 =
          canvas.toDataURL("image/jpeg", 0.6).split(",")[1];

        const { emit } = await import("@tauri-apps/api/event");
        await emit("screen-frame", { base64 });
      }
    );
  })();

  return () => {
    unlistenStop?.();
    unlistenStart?.();
    unlistenChange?.();
    unlistenFrameReq?.();
  };
}, [stopShare, startShare]);

  // Smart frame capture — only sends when screen actually changed
  useEffect(() => {
    if (!sharing) return;

    frameIntervalRef.current = setInterval(async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;

      // Use smaller resolution for change detection (faster comparison)
      canvas.width = Math.min(video.videoWidth, 1280);
      canvas.height = Math.min(video.videoHeight, 720);

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const { different, newData } = getFrameDifference(
        ctx,
        canvas.width,
        canvas.height,
        prevFrameDataRef.current
      );

      prevFrameDataRef.current = newData;

      if (different) {
        const base64 = canvas.toDataURL("image/jpeg", 0.6).split(",")[1];
        onFrame(base64);
        console.log("📸 Frame sent — screen changed");

        try {
          if ((window as any).__TAURI_INTERNALS__) {
            const { emit } = await import("@tauri-apps/api/event");
            await emit("screen-frame", { base64 });
          }
        } catch {
          // not in tauri context or float not open
        }
      } else {
        console.log("⏭ Frame skipped — no significant change");
      }
    }, 3000); // Check every 3 seconds, only send if changed

    return () => clearInterval(frameIntervalRef.current);
  }, [sharing, onFrame]);

  return (
    <div className="relative w-full h-full min-h-[500px] bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800">
      {/* Hidden video — always in DOM */}
      <video
        ref={videoRef}
        className={sharing ? "w-full h-full object-contain bg-black" : "hidden"}
        muted
        playsInline
      />

      {!sharing ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6">
          <div className="flex flex-col items-center gap-3 text-zinc-500">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8M12 17v4" />
            </svg>
            <p className="text-sm">No screen connected</p>
            <p className="text-xs text-zinc-600">Sam watches for changes and listens in real time</p>
          </div>
          <button onClick={startShare}
            className="px-8 py-3 bg-white text-black rounded-full text-sm font-medium hover:bg-zinc-200 transition hover:scale-105">
            Connect Screen
          </button>
        </div>
      ) : (
        <>
          {/* Status bar */}
          <div className="absolute top-3 left-3 flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1.5 px-3 py-1 bg-black/60 backdrop-blur-sm rounded-full text-xs text-green-400 border border-green-400/20">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Sam is watching
            </span>
            {hasScreenAudio && (
              <span className="flex items-center gap-1.5 px-3 py-1 bg-black/60 backdrop-blur-sm rounded-full text-xs text-blue-400 border border-blue-400/20">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                Hearing audio
              </span>
            )}
            {micActive && (
              <span className="flex items-center gap-1.5 px-3 py-1 bg-black/60 backdrop-blur-sm rounded-full text-xs text-purple-400 border border-purple-400/20">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                Mic ready
              </span>
            )}
          </div>

          {/* Push to talk button */}
          {micActive && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
              <button
                onMouseDown={startPTT}
                onMouseUp={stopPTT}
                onTouchStart={startPTT}
                onTouchEnd={stopPTT}
                className={`
                  flex items-center gap-2 px-6 py-3 rounded-full text-sm font-medium
                  transition-all duration-150 select-none
                  ${isPTTRecording
                    ? "bg-red-500 text-white scale-110 shadow-[0_0_20px_rgba(239,68,68,0.5)]"
                    : "bg-black/60 backdrop-blur-sm text-white border border-white/20 hover:bg-black/80"
                  }
                `}
              >
                <span className={`w-2 h-2 rounded-full ${isPTTRecording ? "bg-white animate-pulse" : "bg-zinc-400"}`} />
                {isPTTRecording ? "Listening..." : "Hold to speak to Sam"}
              </button>
            </div>
          )}

          {/* Disconnect */}
          <button onClick={stopShare}
            className="absolute top-3 right-3 px-3 py-1.5 bg-red-500/80 backdrop-blur-sm text-white text-xs rounded-full hover:bg-red-500 transition border border-red-400/20">
            Disconnect
          </button>
        </>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}