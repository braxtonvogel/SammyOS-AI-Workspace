"use client";

import { useNexusStore } from "@/lib/sammy-store";
import { useState, useCallback, useRef } from "react";
import { ScreenShare } from "@/components/workspace/ScreenShare";
import { SamSidebar } from "@/components/workspace/SamSidebar";

interface Message {
  role: "user" | "sam" | "transcript";
  content: string;
  timestamp: Date;
}

export default function WorkspacePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [latestFrame, setLatestFrame] = useState<string | null>(null);
  const latestFrameRef = useRef<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const addMessage = (role: Message["role"], content: string) => {
    setMessages((prev) => [...prev, { role, content, timestamp: new Date() }]);
  };

  const { setLatestFrame: setGlobalFrame } = useNexusStore();

const handleFrame = useCallback((base64: string) => {
    console.log("📸 Frame stored, size:", base64.length);
    latestFrameRef.current = base64;
    setLatestFrame(base64);
    setGlobalFrame(base64); // share with sidebar
  }, []);

  const handleTranscript = useCallback(
    async (transcript: string, source: "mic" | "screen") => {
      addMessage("transcript", transcript);
      console.log("🎤 Transcript | source:", source, "| frame:", latestFrameRef.current?.length ?? "NULL");

      console.log("TRANSCRIPT RECEIVED:", transcript);

      const prompt =
        source === "mic"
          ? `The user just asked by voice: "${transcript}". You have a screenshot of their screen attached as an image — look at it and answer based on what you actually see. Be specific about what is visible.`
          : `Audio from the screen: "${transcript}". If this is relevant or raises something worth noting, mention it briefly. Otherwise stay silent.`;

      setIsAnalyzing(true);
      try {
        console.log("🖼 Attaching frame:", latestFrameRef.current?.length ?? "NULL");
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: prompt,
            imageBase64: latestFrameRef.current,
          }),
        });
        

        const { reply } = await res.json();
        if (reply && !reply.includes("ALL_CLEAR")) {
          addMessage("sam", reply);
        }
      } catch (err) {
        console.error("Transcript handling failed:", err);
      } finally {
        setIsAnalyzing(false);
      }
    },
    []
  );

  const handleAsk = useCallback(
    async (question: string) => {
      console.log("🖼 Attaching frame:", latestFrameRef.current?.length ?? "NULL");
      addMessage("user", question);
      setIsAnalyzing(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: `The user is asking you directly: "${question}". Answer their question. If you can see their screen, use it as context.`,
            imageBase64: latestFrameRef.current,
          }),
        });

        const { reply } = await res.json();
        addMessage("sam", reply);
      } catch {
        addMessage("sam", "Sorry, I had trouble responding. Try again.");
      } finally {
        setIsAnalyzing(false);
      }
    },
    []
  );

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 shrink-0">
          <div>
            <h1 className="text-lg font-semibold">Workspace</h1>
            <p className="text-xs text-zinc-500">
              Share your screen and Sam will assist in real time
            </p>
          </div>
        </div>

        <div className="flex-1 min-h-0 p-4">
          <ScreenShare
            onFrame={handleFrame}
            onTranscript={handleTranscript}
          />
        </div>
      </div>

      <SamSidebar
        messages={messages}
        onAsk={handleAsk}
        isAnalyzing={isAnalyzing}
      />
    </div>
  );
}