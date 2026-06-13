export type BehaviorState =
  | "deep_work"
  | "coding"
  | "research"
  | "consuming"
  | "idle"
  | "distraction";

type BehaviorScore = {
  state: BehaviorState;
  confidence: number;
};

function score(text: string, keywords: string[]): number {
  let s = 0;
  for (const k of keywords) {
    if (text.includes(k)) s += 1;
  }
  return s;
}

export function interpretBehavior(windowText: string): BehaviorState {
  const text = windowText.toLowerCase();

  // =========================
  // 🧠 CODING
  // =========================
  const codingScore = score(text, [
    "visual studio",
    "vscode",
    "cursor",
    "intellij",
    "code",
    "src",
    ".ts",
    ".js",
    "git",
  ]);

  // =========================
  // 📚 RESEARCH
  // =========================
  const researchScore = score(text, [
    "chrome",
    "google",
    "docs",
    "stackoverflow",
    "mdn",
    "wikipedia",
    "chatgpt",
  ]);

  // =========================
  // 🎥 CONSUMPTION
  // =========================
  const consumeScore = score(text, [
    "youtube",
    "netflix",
    "twitch",
    "video",
    "watch",
  ]);

  // =========================
  // 🚨 DISTRACTION SIGNALS
  // =========================
  const distractionScore = score(text, [
    "discord",
    "instagram",
    "twitter",
    "x.com",
    "reddit",
    "tiktok",
  ]);

  // =========================
  // 🧠 DECISION LAYER
  // =========================

  const max = Math.max(
    codingScore,
    researchScore,
    consumeScore,
    distractionScore
  );

  if (max === 0) return "idle";

  if (codingScore === max) {
    // upgrade to deep_work if strong coding signal
    return codingScore >= 3 ? "deep_work" : "coding";
  }

  if (researchScore === max) {
    // Chrome can be deep work OR distraction depending on intensity later
    return researchScore >= 3 ? "deep_work" : "research";
  }

  if (consumeScore === max) return "consuming";

  if (distractionScore === max) return "distraction";

  return "idle";
}

export function getSamInsight(state: BehaviorState): string {
  switch (state) {
    case "deep_work":
      return "Deep work detected. Don’t switch tasks — you’re in a high-focus state.";

    case "coding":
      return "You’re building something. I can help debug, structure, or speed this up.";

    case "research":
      return "You’re gathering information. I can summarize or extract key insights.";

    case "consuming":
      return "You’re in passive consumption mode. Want me to turn this into actionable notes?";

    case "distraction":
      return "You’re bouncing between low-focus apps. I can help you refocus.";

    default:
      return "Waiting for activity...";
  }
}