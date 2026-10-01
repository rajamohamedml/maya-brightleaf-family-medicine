import type { UIMessage } from "ai";

/** Maya's conversation for this browser tab only (sessionStorage — wiped when the tab closes). */
const KEY = "maya-chat-session-v1";
export const SESSION_IDLE_MS = 30 * 60 * 1000;

export type ChatSession = {
  messages: UIMessage[];
  /** Conversation was in voice mode when last saved. */
  voice: boolean;
  /** Inactivity close already happened. */
  ended: boolean;
  savedAt: number;
};

export function loadChatSession(): ChatSession | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as ChatSession;
    if (!Array.isArray(s.messages) || Date.now() - s.savedAt > SESSION_IDLE_MS) {
      clearChatSession();
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function saveChatSession(s: Omit<ChatSession, "savedAt">) {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify({ ...s, savedAt: Date.now() }));
  } catch {
    /* storage unavailable or full — chat keeps working without restore */
  }
}

export function clearChatSession() {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
