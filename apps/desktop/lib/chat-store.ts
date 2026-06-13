import { create } from "zustand";
import type { NexusObject } from "./nexus-objects";
import type { Intent } from "./nexus-intent";

export type Message = {
  role: "user" | "assistant";
  content: string;
};

type NexusState = {
  // 💬 chat
  messages: Message[];
  setMessages: (messages: Message[]) => void;

  // 🧭 OS context
  currentContext: string;
  setCurrentContext: (context: string) => void;

  // 🧠 intent system
  intent: Intent;
  setIntent: (intent: Intent) => void;

  // ⚡ UI state
  isThinking: boolean;
  setIsThinking: (value: boolean) => void;

  // 🧩 workspace objects
  objects: NexusObject[];
  setObjects: (objects: NexusObject[]) => void;
  addObject: (object: NexusObject) => void;

  // 🖥 shared screen frame
  latestFrame: string | null;
  setLatestFrame: (frame: string | null) => void;
};

export const useNexusStore = create<NexusState>((set) => ({
  // 💬 chat
  messages: [],
  setMessages: (messages) => set({ messages }),

  // 🧭 context
  currentContext: "home",
  setCurrentContext: (context) => set({ currentContext: context }),

  // 🧠 intent
  intent: "chatting",
  setIntent: (intent) => set({ intent }),

  // ⚡ UI
  isThinking: false,
  setIsThinking: (value) => set({ isThinking: value }),

  // 🧩 workspace objects
  objects: [],
  setObjects: (objects) => set({ objects }),

  addObject: (object) =>
    set((state) => ({
      objects: [...state.objects, object],
    })),

  // 🖥 shared screen frame
  latestFrame: null,
  setLatestFrame: (frame) => set({ latestFrame: frame }),
}));