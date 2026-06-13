import type { Intent } from "./nexus-intent";
import type { Activity } from "./sam-intent";

export function getSamSuggestion(
  intent: Intent,
  activity?: Activity | string
) {
  // 🧠 PRIORITY: OS activity overrides chat intent
  if (activity) {
    switch (activity) {
      case "coding":
        return "You're in a coding environment. Want me to scaffold your workspace or debug something?";

      case "researching":
        return "You're browsing and researching. Want me to summarize or organize what you're looking at?";

      case "watching":
        return "You're watching content. Want a focus mode or note capture while you watch?";

      case "chatting":
        return "You're in a communication app. Want me to summarize conversations or extract tasks?";

      case "organizing":
        return "You're managing files. Want me to turn this into a structured workspace?";

      default:
        break;
    }
  }

  // 💬 fallback: old intent system
  switch (intent) {
    case "debugging":
      return "I see you're debugging. Want help breaking down the error?";

    case "coding":
      return "Looks like you're building something. Want a project structure suggestion?";

    case "planning":
      return "Want me to turn this into a step-by-step plan?";

    case "chatting":
      return "Ask me anything or start a new project.";

    default:
      return "I'm ready.";
  }
}