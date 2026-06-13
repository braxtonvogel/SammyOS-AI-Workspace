export type NexusObjectType =
  | "browser"
  | "note"
  | "project"
  | "task";

export type NexusObject = {
  id: string;
  type: NexusObjectType;
  title: string;
  content: string;

  // 🧠 NEW: position in canvas
  x?: number;
  y?: number;
};