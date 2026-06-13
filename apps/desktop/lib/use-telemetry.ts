// lib/use-telemetry.ts
// Call useTelemetry() in any component to get a `ping()` function.
// Sends anonymous activity signals to the backend for the portfolio dashboard.
// NO message content, NO personal data.

import { useCallback } from "react";
import { useAuthStore } from "./auth-store";

const BACKEND = process.env.NEXT_PUBLIC_NEXUS_ANALYZER_URL ?? "https://nexus-analyzer-three.vercel.app";

type TelemetryEvent =
  | "session_start"
  | "session_end"
  | "message_sent"
  | "research_started"
  | "vault_upload"
  | "screen_share"
  | "register"
  | "login";

type Feature = "chat" | "research" | "vault" | "workspace" | "settings" | "ideaboard";

export function useTelemetry() {
  const ping = useCallback(
    async (event: TelemetryEvent, feature?: Feature) => {
      // Read token live at call time so pings fired from useEffect on mount
      // always carry the correct token — even before the component re-renders
      // with the hydrated auth state. This fixes session_start, research_started,
      // and vault_upload pings being sent without the x-sammy-token header.
      const token = useAuthStore.getState().user?.token;
      try {
        await fetch(`${BACKEND}/api/telemetry`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { "x-sammy-token": token } : {}),
          },
          body: JSON.stringify({ event, feature }),
        });
      } catch {
        // Silently fail — telemetry should never block the app
      }
    },
    [] // empty deps — token is read live via getState(), not captured in closure
  );

  return { ping };
}