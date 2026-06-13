import type { BehaviorState } from "./sam-behavior";

export type SessionType =
  | "focus"
  | "coding"
  | "distracted"
  | "mixed";

type Session = {
  type: SessionType;
  start: number;
  lastUpdate: number;
  switches: number;
};

let currentSession: Session = {
  type: "focus",
  start: Date.now(),
  lastUpdate: Date.now(),
  switches: 0,
};

// 🧠 classify behavior into session type
function mapBehaviorToSession(b: BehaviorState): SessionType {
  switch (b) {
    case "coding":
      return "coding";
    case "debugging":
      return "coding";
    case "planning":
      return "focus";
    case "chatting":
      return "distracted";
    default:
      return "mixed";
  }
}

// 🧠 main brain update function
export function updateSessionBrain(behavior: BehaviorState) {
  const now = Date.now();
  const mapped = mapBehaviorToSession(behavior);

  // session switch detection
  if (mapped !== currentSession.type) {
    currentSession = {
      type: mapped,
      start: now,
      lastUpdate: now,
      switches: currentSession.switches + 1,
    };
  } else {
    currentSession.lastUpdate = now;
  }

  const duration = now - currentSession.start;

  return {
    ...currentSession,
    duration,
  };
}

// 🧠 productivity score based on session state
export function getSessionFocusScore(session: ReturnType<typeof updateSessionBrain>) {
  const minutes = session.duration / 60000;

  let base =
    session.type === "coding" ? 90 :
    session.type === "focus" ? 75 :
    session.type === "mixed" ? 55 :
    35;

  // decay if you stay unfocused too long
  const decay = Math.min(25, minutes * 2);

  // switching penalty
  const switchPenalty = session.switches * 3;

  return Math.max(0, Math.min(100, base - decay - switchPenalty));
}