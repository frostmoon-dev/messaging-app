import type { ChatMessage, LocalState, MessageRow } from "@/types/app";

export type ChatState = {
  messages: ChatMessage[];
  loaded: boolean;
  loadError: string | null;
  hasMore: boolean;
  loadingOlder: boolean;
};

export type ChatAction =
  | { type: "loaded"; rows: MessageRow[]; hasMore: boolean }
  | { type: "loadFailed"; error: string }
  | { type: "loadingOlder"; value: boolean }
  | { type: "prepend"; rows: MessageRow[]; hasMore?: boolean }
  | { type: "upsert"; rows: MessageRow[] }
  | { type: "addLocal"; message: ChatMessage }
  | { type: "patchLocal"; id: string; local: Partial<LocalState> }
  | { type: "remove"; id: string }
  | { type: "markPartnerRead"; partnerId: string; at: string }
  | { type: "cleared" };

export const initialChatState: ChatState = {
  messages: [],
  loaded: false,
  loadError: null,
  hasMore: false,
  loadingOlder: false,
};

// Pending messages always sit at the bottom until the server confirms them.
function compare(a: ChatMessage, b: ChatMessage) {
  const pa = a.local ? 1 : 0;
  const pb = b.local ? 1 : 0;
  if (pa !== pb) return pa - pb;
  if (a.created_at !== b.created_at) return a.created_at < b.created_at ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Receipts only move forward, so never let an older payload clear them. */
function mergeRow(existing: ChatMessage | undefined, incoming: MessageRow): ChatMessage {
  if (!existing) return incoming;
  return {
    ...incoming,
    delivered_at: incoming.delivered_at ?? existing.delivered_at,
    read_at: incoming.read_at ?? existing.read_at,
  };
}

function merge(current: ChatMessage[], rows: MessageRow[]) {
  const byId = new Map(current.map((m) => [m.id, m]));
  for (const row of rows) byId.set(row.id, mergeRow(byId.get(row.id), row));
  return [...byId.values()].sort(compare);
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "loaded": {
      // Keep anything realtime delivered while the initial fetch was in flight.
      return {
        ...state,
        messages: merge(state.messages, action.rows),
        loaded: true,
        loadError: null,
        hasMore: action.hasMore,
      };
    }
    case "loadFailed":
      return { ...state, loadError: action.error, loaded: state.loaded };
    case "loadingOlder":
      return { ...state, loadingOlder: action.value };
    case "prepend":
      return {
        ...state,
        messages: merge(state.messages, action.rows),
        hasMore: action.hasMore ?? state.hasMore,
        loadingOlder: false,
      };
    case "upsert":
      if (!action.rows.length) return state;
      return { ...state, messages: merge(state.messages, action.rows) };
    case "addLocal":
      return { ...state, messages: [...state.messages, action.message].sort(compare) };
    case "patchLocal":
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.id && m.local ? { ...m, local: { ...m.local, ...action.local } } : m,
        ),
      };
    case "remove":
      return { ...state, messages: state.messages.filter((m) => m.id !== action.id) };
    case "cleared":
      // History hidden for you; keep only messages still on their way out.
      return { ...state, messages: state.messages.filter((m) => m.local), hasMore: false };
    case "markPartnerRead":
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.sender_id === action.partnerId && !m.read_at
            ? { ...m, read_at: action.at, delivered_at: m.delivered_at ?? action.at }
            : m,
        ),
      };
    default:
      return state;
  }
}
