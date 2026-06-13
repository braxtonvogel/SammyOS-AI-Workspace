import { create } from "zustand";
import type { NexusObject } from "./nexus-objects";

export type Message = {
  role: "user" | "assistant";
  content: string;
  imageBase64?: string;
  timestamp: Date;
};

export type ChatEntry = {
  id: string;
  name: string;
  messages: Message[];
  createdAt: Date;
};

type Intent = "chatting" | "coding" | "debugging" | "planning" | "unknown";

type NexusState = {
  // =====================
  // 💬 ACTIVE CHAT STATE
  // =====================
  messages: Message[];
  setMessages: (messages: Message[]) => void;

  addMessage: (msg: Message) => void;
  clearMessages: () => void;

  // =====================
  // 🗂 CHAT HISTORY SYSTEM
  // =====================
  chatHistory: ChatEntry[];
  setChatHistory: (history: ChatEntry[]) => void;

  currentChatId: string;
  setCurrentChatId: (id: string) => void;

  saveCurrentChat: () => void;
  loadChat: (chat: ChatEntry) => void;
  deleteChat: (id: string) => void;
  renameChat: (id: string, name: string) => void;

  // =====================
  // 🧭 OS CONTEXT
  // =====================
  currentContext: string;
  setCurrentContext: (context: string) => void;

  intent: Intent;
  setIntent: (intent: Intent) => void;

  // =====================
  // ⚡ UI STATE
  // =====================
  isThinking: boolean;
  setIsThinking: (value: boolean) => void;

  // =====================
  // 🧩 WORKSPACE OBJECTS
  // =====================
  objects: NexusObject[];
  setObjects: (objects: NexusObject[]) => void;
  addObject: (object: NexusObject) => void;

  // =====================
  // 🖥 SHARED SCREEN FRAME
  // =====================
  latestFrame: string | null;
  setLatestFrame: (frame: string | null) => void;
};

export const useNexusStore = create<NexusState>((set, get) => ({
  // =====================
  // 💬 CHAT CORE
  // =====================
  messages: [],

  setMessages: (messages) => set({ messages }),

  addMessage: (msg) =>
  set((state) => {
    const exists = state.messages.some(
      (m) =>
        m.role === msg.role &&
        m.content === msg.content &&
        String(m.timestamp) === String(msg.timestamp)
    );

    if (exists) {
      return state;
    }

    return {
      messages: [...state.messages, msg],
    };
  }),

  clearMessages: () => set({ messages: [] }),

  // =====================
  // 🗂 CHAT HISTORY
  // =====================
  chatHistory: [],

  setChatHistory: (chatHistory) => set({ chatHistory }),

  currentChatId: "main",

  setCurrentChatId: (id) => set({ currentChatId: id }),

  saveCurrentChat: () => {
    const state = get();

    if (state.messages.length === 0) return;

    const existing = state.chatHistory.find(
      (c) => c.id === state.currentChatId
    );

    const updatedChat: ChatEntry = {
      id: state.currentChatId,
      name: existing?.name || `Chat ${state.chatHistory.length + 1}`,
      messages: state.messages,
      createdAt: existing?.createdAt || new Date(),
    };

    const filtered = state.chatHistory.filter(
      (c) => c.id !== state.currentChatId
    );

    set({
      chatHistory: [updatedChat, ...filtered],
    });
  },

  loadChat: (chat) =>
    set({
      messages: chat.messages,
      currentChatId: chat.id,
    }),

  deleteChat: (id) =>
    set((state) => ({
      chatHistory: state.chatHistory.filter((c) => c.id !== id),
    })),

  renameChat: (id, name) =>
    set((state) => ({
      chatHistory: state.chatHistory.map((c) =>
        c.id === id ? { ...c, name } : c
      ),
    })),

  // =====================
  // 🧭 CONTEXT
  // =====================
  currentContext: "home",

  setCurrentContext: (context) => set({ currentContext: context }),

  intent: "chatting",

  setIntent: (intent) => set({ intent }),

  // =====================
  // ⚡ UI STATE
  // =====================
  isThinking: false,

  setIsThinking: (value) => set({ isThinking: value }),

  // =====================
  // 🧩 OBJECTS
  // =====================
  objects: [],

  setObjects: (objects) => set({ objects }),

  addObject: (object) =>
    set((state) => ({
      objects: [...state.objects, object],
    })),

  // =====================
  // 🖥 SCREEN FRAME
  // =====================
  latestFrame: null,

  setLatestFrame: (frame) => set({ latestFrame: frame }),
  appendMessage: (message: Message) =>
  set((state) => ({
    messages: [...state.messages, message],
  })),
}));