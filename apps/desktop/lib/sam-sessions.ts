export type Session = {
  type: string;
  start: number;
  lastUpdate: number;
  duration: number;
};

let currentSession: Session | null = null;

export function updateSession(activity: string) {
  const now = Date.now();

  // start new session if none exists
  if (!currentSession) {
    currentSession = {
      type: activity,
      start: now,
      lastUpdate: now,
      duration: 0,
    };
    return currentSession;
  }

  const sameActivity = currentSession.type === activity;

  if (sameActivity) {
    currentSession.lastUpdate = now;
    currentSession.duration = now - currentSession.start;
  } else {
    // switch session
    currentSession = {
      type: activity,
      start: now,
      lastUpdate: now,
      duration: 0,
    };
  }

  return currentSession;
}

export function getCurrentSession() {
  return currentSession;
}