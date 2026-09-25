"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  fetchLatest,
  fetchMessage,
  fetchOlder,
  fetchRange,
  fetchSince,
  fetchSnippets,
  clearChat,
  deleteMessage as deleteMessageRpc,
  fetchPinned,
  hideMessage as hideMessageRpc,
  fetchStarIds,
  pinMessage as pinMessageRpc,
  setStar,
  insertMessage,
  markDelivered,
  markRead,
  editMessage as editMessageRpc,
  fetchReactions,
  setReaction as setReactionRpc,
  type MessageStyle,
  type NewMessage,
  type Reaction,
} from "@/lib/messages/api";
import { readChatCache, writeChatCache } from "@/lib/messages/cache";
import { haptic } from "@/lib/haptics";
import { chatReducer, initialChatState } from "@/lib/messages/store";
import { latestSeen } from "@/lib/presence";
import { validateMessageText } from "@/lib/messages/validation";
import { uploadWithProgress } from "@/lib/storage/upload";
import type { PreparedImage } from "@/lib/storage/image";
import { friendlyError } from "@/lib/errors";
import { devLog, uuid } from "@/lib/utils";
import type { MessageEffect } from "@/lib/messages/effects";
import type { Recording } from "@/lib/audio/recorder";
import { playSound } from "@/lib/sound";
import { showMessageNotification } from "@/lib/notifications";
import type { BondRow, ChatMessage, MessageRow, Profile, ReplySnippet, Session } from "@/types/app";

// ---------------------------------------------------------------------------
// Context shapes
// ---------------------------------------------------------------------------

export type MediaToSend = {
  type: "sticker" | "gif";
  /** Own sticker: path in the `stickers` bucket. GIPHY: https media link. */
  url: string;
  width: number;
  height: number;
  /** GIPHY title, used as the description for screen readers. */
  title?: string;
};

type ChatData = {
  me: Profile;
  partner: Profile;
  conversationId: string;
  messages: ChatMessage[];
  loaded: boolean;
  loadError: string | null;
  hasMore: boolean;
  loadingOlder: boolean;
  unreadCount: number;
  bond: BondRow | null;
  loadOlder: () => Promise<void>;
  reload: () => Promise<void>;
  sendText: (text: string, replyTo: string | null, style?: MessageStyle | null, effect?: MessageEffect | null) => boolean;
  sendImages: (images: PreparedImage[], caption: string, replyTo: string | null) => void;
  sendVoice: (recording: Recording, replyTo: string | null) => void;
  /** Your own text message within 15 minutes. Throws if the server refuses. */
  editMessage: (id: string, text: string) => Promise<void>;
  /** message id → person id → emoji. */
  reactions: Readonly<Record<string, Readonly<Record<string, string>>>>;
  /** Your reaction on a message; null takes it away. */
  react: (id: string, emoji: string | null) => Promise<void>;
  sendImage: (image: PreparedImage, caption: string, replyTo: string | null) => void;
  /** A sticker (own pack path or GIPHY link) or a GIPHY GIF, already stored or hosted, so it sends like text. */
  sendMedia: (media: MediaToSend, replyTo: string | null) => void;
  retry: (id: string) => void;
  /** Your own message, for both of you. Throws if the server refuses. */
  deleteMessage: (id: string) => Promise<void>;
  /** Hides the whole history for you only. */
  clearHistory: () => Promise<void>;
  /** Hides one message (anyone's) for you only. */
  hideMessage: (id: string) => Promise<void>;
  /** Shared pins, newest first (at most 5). */
  pinned: MessageRow[];
  setPinned: (id: string, pinned: boolean) => Promise<void>;
  /** Messages you starred (only you see these). */
  starred: ReadonlySet<string>;
  toggleStar: (id: string) => Promise<void>;
  discard: (id: string) => void;
  getSnippet: (id: string) => ReplySnippet | undefined;
  ensureLoaded: (id: string) => Promise<boolean>;
  localPreview: (id: string) => string | undefined;
  setChatActive: (active: boolean) => void;
  updateMe: (patch: Partial<Profile>) => void;
  setBond: (bond: BondRow) => void;
};

export type ConnectionState = "connecting" | "online" | "reconnecting" | "offline";

type Presence = {
  partnerOnline: boolean;
  partnerTyping: boolean;
  partnerLastSeen: string | null;
  connection: ConnectionState;
  notifyTyping: () => void;
  stopTyping: () => void;
};

export type LiveTable = "events" | "locations" | "alerts" | "lists" | "list_items";
export type LiveChange = { type: "INSERT" | "UPDATE" | "DELETE"; row: Record<string, unknown> };
type Live = { subscribe: (table: LiveTable, listener: (change: LiveChange) => void) => () => void };

const ChatDataContext = createContext<ChatData | null>(null);
const PresenceContext = createContext<Presence | null>(null);
const LiveContext = createContext<Live | null>(null);

export function useChat() {
  const ctx = useContext(ChatDataContext);
  if (!ctx) throw new Error("useChat must be used inside <ChatProvider>");
  return ctx;
}

/**
 * Calls `listener` for every insert/update on a shared table (calendar,
 * locations, alerts) while the component is mounted. Uses the app's one
 * realtime connection. Deletes are not delivered with a filter, so screens
 * also refetch when they open.
 */
export function useLiveTable(table: LiveTable, listener: (change: LiveChange) => void) {
  const ctx = useContext(LiveContext);
  if (!ctx) throw new Error("useLiveTable must be used inside <ChatProvider>");
  const latest = useRef(listener);
  useEffect(() => {
    latest.current = listener;
  });
  useEffect(() => ctx.subscribe(table, (change) => latest.current(change)), [ctx, table]);
}

export function usePresence() {
  const ctx = useContext(PresenceContext);
  if (!ctx) throw new Error("usePresence must be used inside <ChatProvider>");
  return ctx;
}

// ---------------------------------------------------------------------------
// Outbox: what we need to (re)send a message. Kept out of React state.
// ---------------------------------------------------------------------------

type OutboxItem = {
  row: NewMessage;
  image?: { blob: Blob; contentType: string; uploaded: boolean };
};

const TYPING_SEND_INTERVAL = 2500;
const TYPING_TIMEOUT = 4500;

export function ChatProvider({
  session,
  initialBond,
  children,
}: {
  session: Session;
  initialBond: BondRow | null;
  children: ReactNode;
}) {
  const { conversationId } = session;
  const supabase = useMemo(() => createClient(), []);

  const [state, dispatch] = useReducer(chatReducer, initialChatState);
  const [me, setMe] = useState(session.me);
  const [partner, setPartner] = useState(session.partner);
  const [bond, setBond] = useState(initialBond);
  const [snippets, setSnippets] = useState<Record<string, ReplySnippet>>({});

  const [partnerOnline, setPartnerOnline] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [presenceLeftAt, setPresenceLeftAt] = useState<string | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("connecting");

  const messagesRef = useRef(state.messages);
  const outbox = useRef(new Map<string, OutboxItem>());
  const previews = useRef(new Map<string, string>());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const chatActiveRef = useRef(false);
  const lastTypingSent = useRef(0);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const receiptTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveListeners = useRef(new Map<LiveTable, Set<(change: LiveChange) => void>>());
  const live = useMemo<Live>(
    () => ({
      subscribe(table, listener) {
        const set = liveListeners.current.get(table) ?? new Set();
        set.add(listener);
        liveListeners.current.set(table, set);
        return () => void set.delete(listener);
      },
    }),
    [],
  );
  const partnerRef = useRef(partner);
  const meRef = useRef(me);
  const partnerOnlineRef = useRef(false);

  useEffect(() => {
    messagesRef.current = state.messages;
  }, [state.messages]);
  useEffect(() => {
    partnerRef.current = partner;
  }, [partner]);
  useEffect(() => {
    meRef.current = me;
  }, [me]);

  // ------------------------------------------------------------------ receipts

  const syncReceipts = useCallback(() => {
    if (receiptTimer.current) clearTimeout(receiptTimer.current);
    receiptTimer.current = setTimeout(async () => {
      const partnerId = partnerRef.current.id;
      const incoming = messagesRef.current.filter((m) => m.sender_id === partnerId);
      const visible = document.visibilityState === "visible";
      try {
        if (chatActiveRef.current && visible && incoming.some((m) => !m.read_at)) {
          await markRead(supabase, conversationId);
          dispatch({ type: "markPartnerRead", partnerId, at: new Date().toISOString() });
        } else if (incoming.some((m) => !m.delivered_at)) {
          await markDelivered(supabase, conversationId);
        }
      } catch (error) {
        devLog("receipt sync failed", error);
      }
    }, 250);
  }, [supabase, conversationId]);

  // ------------------------------------------------------------------ snippets

  const resolveSnippets = useCallback(
    async (rows: MessageRow[]) => {
      const known = new Set(messagesRef.current.map((m) => m.id));
      rows.forEach((r) => known.add(r.id));
      const missing = [
        ...new Set(rows.map((r) => r.reply_to).filter((id): id is string => Boolean(id) && !known.has(id!))),
      ];
      if (!missing.length) return;
      try {
        const found = await fetchSnippets(supabase, missing);
        setSnippets((prev) => {
          const next = { ...prev };
          found.forEach((s) => (next[s.id] = s));
          return next;
        });
      } catch (error) {
        devLog("snippet fetch failed", error);
      }
    },
    [supabase],
  );

  // ------------------------------------------------------------------ loading

  const reload = useCallback(async () => {
    try {
      const { rows, hasMore } = await fetchLatest(supabase, conversationId);
      dispatch({ type: "loaded", rows, hasMore });
      void resolveSnippets(rows);
      syncReceipts();
    } catch (error) {
      dispatch({ type: "loadFailed", error: friendlyError(error, "load") });
    }
  }, [supabase, conversationId, resolveSnippets, syncReceipts]);

  // This device's copy first, so the chat shows before the network answers.
  useLayoutEffect(() => {
    const cached = readChatCache(conversationId);
    if (cached?.rows.length) dispatch({ type: "cached", rows: cached.rows, hasMore: cached.hasMore });
  }, [conversationId]);

  useEffect(() => {
    // Initial fetch; results land in the reducer asynchronously.
    void reload();
  }, [reload]);

  // Keep the copy fresh (only once the server has answered, never mid-way).
  useEffect(() => {
    if (!state.loaded || state.fromCache) return;
    const t = setTimeout(() => writeChatCache(conversationId, state.messages, state.hasMore), 800);
    return () => clearTimeout(t);
  }, [conversationId, state.loaded, state.fromCache, state.messages, state.hasMore]);

  const loadOlder = useCallback(async () => {
    const oldest = messagesRef.current.find((m) => !m.local);
    if (!oldest || state.loadingOlder || !state.hasMore) return;
    dispatch({ type: "loadingOlder", value: true });
    try {
      const { rows, hasMore } = await fetchOlder(supabase, conversationId, oldest.created_at);
      dispatch({ type: "prepend", rows, hasMore });
      void resolveSnippets(rows);
    } catch (error) {
      devLog("load older failed", error);
      dispatch({ type: "loadingOlder", value: false });
    }
  }, [supabase, conversationId, state.loadingOlder, state.hasMore, resolveSnippets]);

  /** Fill anything missed while disconnected, and refresh recent receipts. */
  const catchUp = useCallback(async () => {
    const confirmed = messagesRef.current.filter((m) => !m.local);
    const newest = confirmed[confirmed.length - 1];
    try {
      const [since, latest] = await Promise.all([
        newest ? fetchSince(supabase, conversationId, newest.created_at) : Promise.resolve([] as MessageRow[]),
        fetchLatest(supabase, conversationId),
      ]);
      dispatch({ type: "upsert", rows: [...latest.rows, ...since] });
      void resolveSnippets(since);
      syncReceipts();
    } catch (error) {
      devLog("catch-up failed", error);
    }
  }, [supabase, conversationId, resolveSnippets, syncReceipts]);

  const ensureLoaded = useCallback(
    async (id: string) => {
      if (messagesRef.current.some((m) => m.id === id)) return true;
      try {
        const target = await fetchMessage(supabase, id);
        if (!target || target.conversation_id !== conversationId) return false;
        const oldest = messagesRef.current.find((m) => !m.local);
        const rows = oldest
          ? await fetchRange(supabase, conversationId, target.created_at, oldest.created_at)
          : [target];
        dispatch({ type: "prepend", rows });
        void resolveSnippets(rows);
        return true;
      } catch (error) {
        devLog("ensureLoaded failed", error);
        return false;
      }
    },
    [supabase, conversationId, resolveSnippets],
  );

  // ------------------------------------------------------------------ sending

  const persist = useCallback(
    async (id: string) => {
      const item = outbox.current.get(id);
      if (!item) return;
      dispatch({ type: "patchLocal", id, local: { status: "sending", error: undefined } });

      try {
        if (item.image && !item.image.uploaded) {
          let lastReported = 0;
          await uploadWithProgress(
            item.row.message_type === "voice" ? "voice" : "chat-images",
            item.row.image_url!,
            item.image.blob,
            item.image.contentType,
            (fraction) => {
              // Throttle re-renders to ~5% steps.
              if (fraction === 1 || fraction - lastReported >= 0.05) {
                lastReported = fraction;
                dispatch({ type: "patchLocal", id, local: { progress: fraction } });
              }
            },
          );
          item.image.uploaded = true;
          dispatch({ type: "patchLocal", id, local: { uploaded: true, progress: 1 } });
        }
      } catch (error) {
        dispatch({ type: "patchLocal", id, local: { status: "failed", error: friendlyError(error, "upload") } });
        return;
      }

      try {
        const saved = await insertMessage(supabase, item.row).catch((error: { code?: string }) => {
          // Database without message styles or effects yet: send it plain instead of failing.
          if ((item.row.style || item.row.effect) && (error?.code === "PGRST204" || error?.code === "42703")) {
            delete item.row.style;
            delete item.row.effect;
            return insertMessage(supabase, item.row);
          }
          throw error;
        });
        outbox.current.delete(id);
        dispatch({ type: "upsert", rows: [saved] });
        playSound("sent");
        haptic("send");
      } catch (error) {
        // Duplicate key: an earlier attempt actually succeeded.
        if ((error as { code?: string })?.code === "23505") {
          const existing = await fetchMessage(supabase, id).catch(() => null);
          if (existing) {
            outbox.current.delete(id);
            dispatch({ type: "upsert", rows: [existing] });
            return;
          }
        }
        dispatch({ type: "patchLocal", id, local: { status: "failed", error: friendlyError(error, "send") } });
      }
    },
    [supabase],
  );

  const stopTyping = useCallback(() => {
    if (!lastTypingSent.current) return;
    lastTypingSent.current = 0;
    void channelRef.current?.send({
      type: "broadcast",
      event: "typing",
      payload: { user_id: session.me.id, typing: false },
    });
  }, [session.me.id]);

  const notifyTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingSent.current < TYPING_SEND_INTERVAL) return;
    lastTypingSent.current = now;
    void channelRef.current?.send({
      type: "broadcast",
      event: "typing",
      payload: { user_id: session.me.id, typing: true },
    });
  }, [session.me.id]);

  const sendText = useCallback(
    (text: string, replyTo: string | null, style?: MessageStyle | null, effect?: MessageEffect | null) => {
      const result = validateMessageText(text);
      if (!result.ok) return false;
      const id = uuid();
      const row: NewMessage = {
        id,
        conversation_id: conversationId,
        content: result.value,
        message_type: "text",
        image_url: null,
        image_width: null,
        image_height: null,
        reply_to: replyTo,
        // Only sent when chosen, so plain messages still work before the database update.
        ...(style ? { style } : {}),
        ...(effect ? { effect } : {}),
      };
      outbox.current.set(id, { row });
      dispatch({
        type: "addLocal",
        message: {
          ...row,
          sender_id: session.me.id,
          created_at: new Date().toISOString(),
          delivered_at: null,
          read_at: null,
          local: { status: "sending" },
        },
      });
      stopTyping();
      void persist(id);
      return true;
    },
    [conversationId, session.me.id, persist, stopTyping],
  );

  // Adds a photo to the chat straight away and to the outbox. `at` keeps a
  // batch in the order it was picked.
  const queueImage = useCallback(
    (image: PreparedImage, caption: string, replyTo: string | null, at = new Date()) => {
      const id = uuid();
      const text = caption.trim().slice(0, 4000);
      const row: NewMessage = {
        id,
        conversation_id: conversationId,
        content: text || null,
        message_type: "image",
        image_url: `${conversationId}/${id}.${image.extension}`,
        image_width: image.width,
        image_height: image.height,
        reply_to: replyTo,
      };
      const previewUrl = URL.createObjectURL(image.blob);
      previews.current.set(id, previewUrl);
      outbox.current.set(id, { row, image: { blob: image.blob, contentType: image.contentType, uploaded: false } });
      dispatch({
        type: "addLocal",
        message: {
          ...row,
          sender_id: session.me.id,
          created_at: at.toISOString(),
          delivered_at: null,
          read_at: null,
          local: { status: "sending", progress: 0, previewUrl },
        },
      });
      return id;
    },
    [conversationId, session.me.id],
  );

  const sendImage = useCallback(
    (image: PreparedImage, caption: string, replyTo: string | null) => {
      const id = queueImage(image, caption, replyTo);
      stopTyping();
      void persist(id);
    },
    [queueImage, persist, stopTyping],
  );

  /**
   * Several photos at once, like WhatsApp: the caption and reply go with the
   * first. They're sent one after another, so they arrive in the order picked.
   */
  const sendImages = useCallback(
    (images: PreparedImage[], caption: string, replyTo: string | null) => {
      if (!images.length) return;
      const start = Date.now();
      const ids = images.map((image, i) =>
        queueImage(image, i === 0 ? caption : "", i === 0 ? replyTo : null, new Date(start + i)),
      );
      stopTyping();
      void (async () => {
        for (const id of ids) await persist(id);
      })();
    },
    [queueImage, persist, stopTyping],
  );

  /** A voice message: shows at once (playable from the phone), uploads, then saves. */
  const sendVoice = useCallback(
    (recording: Recording, replyTo: string | null) => {
      const id = uuid();
      const row: NewMessage = {
        id,
        conversation_id: conversationId,
        content: null,
        message_type: "voice",
        image_url: `${conversationId}/${id}.${recording.extension}`,
        image_width: null,
        image_height: null,
        reply_to: replyTo,
        audio_duration_ms: recording.durationMs,
        audio_peaks: recording.peaks,
      };
      const previewUrl = URL.createObjectURL(recording.blob);
      previews.current.set(id, previewUrl);
      outbox.current.set(id, { row, image: { blob: recording.blob, contentType: recording.contentType, uploaded: false } });
      dispatch({
        type: "addLocal",
        message: {
          ...row,
          sender_id: session.me.id,
          created_at: new Date().toISOString(),
          delivered_at: null,
          read_at: null,
          local: { status: "sending", progress: 0, previewUrl },
        },
      });
      stopTyping();
      void persist(id);
    },
    [conversationId, session.me.id, persist, stopTyping],
  );

  const sendMedia = useCallback(
    (media: MediaToSend, replyTo: string | null) => {
      const id = uuid();
      const row: NewMessage = {
        id,
        conversation_id: conversationId,
        content: media.title?.trim().slice(0, 120) || null,
        message_type: media.type,
        image_url: media.url,
        image_width: media.width,
        image_height: media.height,
        reply_to: replyTo,
      };
      outbox.current.set(id, { row });
      dispatch({
        type: "addLocal",
        message: {
          ...row,
          sender_id: session.me.id,
          created_at: new Date().toISOString(),
          delivered_at: null,
          read_at: null,
          local: { status: "sending" },
        },
      });
      stopTyping();
      void persist(id);
    },
    [conversationId, session.me.id, persist, stopTyping],
  );

  const retry = useCallback((id: string) => void persist(id), [persist]);

  const editMessage = useCallback(
    async (id: string, text: string) => {
      const original = messagesRef.current.find((m) => m.id === id);
      const result = validateMessageText(text);
      if (!original || original.local || !result.ok) return;
      if (result.value === original.content) return;
      dispatch({ type: "upsert", rows: [{ ...original, content: result.value, edited_at: new Date().toISOString() }] });
      try {
        const editedAt = await editMessageRpc(supabase, id, result.value);
        dispatch({ type: "upsert", rows: [{ ...original, content: result.value, edited_at: editedAt }] });
      } catch (error) {
        dispatch({ type: "upsert", rows: [original] });
        throw error;
      }
    },
    [supabase],
  );

  // ------------------------------------------------------------------ reactions
  // Loaded for the messages on screen, and kept live on their own channel so
  // a database without reactions yet doesn't disturb the chat.
  const [reactions, setReactions] = useState<Record<string, Record<string, string>>>({});
  const reactionsAsked = useRef(new Set<string>());
  const reactionsRef = useRef(reactions);
  useEffect(() => {
    reactionsRef.current = reactions;
  }, [reactions]);

  const applyReaction = useCallback((r: Reaction) => {
    setReactions((prev) => {
      const forMessage = { ...(prev[r.message_id] ?? {}) };
      if (r.emoji) forMessage[r.user_id] = r.emoji;
      else delete forMessage[r.user_id];
      return { ...prev, [r.message_id]: forMessage };
    });
  }, []);

  useEffect(() => {
    const ids = state.messages.filter((m) => !m.local && !reactionsAsked.current.has(m.id)).map((m) => m.id);
    if (!ids.length) return;
    ids.forEach((id) => reactionsAsked.current.add(id));
    fetchReactions(supabase, conversationId, ids)
      .then((rows) => rows.forEach(applyReaction))
      .catch((error) => {
        devLog("reactions unavailable", error);
        ids.forEach((id) => reactionsAsked.current.delete(id));
      });
  }, [supabase, conversationId, state.messages, applyReaction]);

  useEffect(() => {
    // postgres_changes only (no broadcast or presence), so it needs no private topic.
    const channel = supabase
      .channel(`reactions:${conversationId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_reactions", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const row = payload.new as Reaction;
          if (!row?.message_id) return;
          applyReaction(row);
          if (row.user_id !== session.me.id && row.emoji) haptic("receive");
        },
      )
      .subscribe();
    // Anything missed while the phone slept: ask again on return.
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const ids = messagesRef.current.filter((m) => !m.local).map((m) => m.id).slice(-200);
      fetchReactions(supabase, conversationId, ids)
        .then((rows) => {
          setReactions((prev) => {
            const next = { ...prev };
            ids.forEach((id) => delete next[id]);
            rows.forEach((r) => (next[r.message_id] = { ...(next[r.message_id] ?? {}), [r.user_id]: r.emoji! }));
            return next;
          });
        })
        .catch((error) => devLog("reactions refresh failed", error));
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [supabase, conversationId, session.me.id, applyReaction]);

  const react = useCallback(
    async (id: string, emoji: string | null) => {
      const previous = reactionsRef.current[id]?.[session.me.id] ?? null;
      applyReaction({ message_id: id, user_id: session.me.id, emoji });
      try {
        await setReactionRpc(supabase, id, emoji);
      } catch (error) {
        applyReaction({ message_id: id, user_id: session.me.id, emoji: previous });
        throw error;
      }
    },
    [supabase, session.me.id, applyReaction],
  );

  const deleteMessage = useCallback(
    async (id: string) => {
      const original = messagesRef.current.find((m) => m.id === id);
      if (!original || original.local) return;
      // Show it gone straight away; put it back if the server says no.
      dispatch({
        type: "upsert",
        rows: [{ ...original, deleted_at: new Date().toISOString(), content: null, image_url: null, image_width: null, image_height: null }],
      });
      try {
        const file = await deleteMessageRpc(supabase, id);
        if (file) await supabase.storage.from(original.message_type === "voice" ? "voice" : "chat-images").remove([file]);
      } catch (error) {
        dispatch({ type: "upsert", rows: [{ ...original, deleted_at: null }] });
        throw error;
      }
    },
    [supabase],
  );

  // Pins and stars load on their own, so a database that hasn't had the
  // pin/star update yet just shows none instead of breaking the chat.
  const [pinned, setPinnedRows] = useState<MessageRow[]>([]);
  const [starred, setStarred] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    let cancelled = false;
    fetchPinned(supabase, conversationId)
      .then((rows) => !cancelled && setPinnedRows(rows))
      .catch((error) => devLog("pins unavailable", error));
    fetchStarIds(supabase)
      .then((ids) => !cancelled && setStarred(new Set(ids)))
      .catch((error) => devLog("stars unavailable", error));
    return () => {
      cancelled = true;
    };
  }, [supabase, conversationId]);

  const trackPin = useCallback((row: MessageRow) => {
    setPinnedRows((prev) => {
      const rest = prev.filter((p) => p.id !== row.id);
      if (!row.pinned_at || row.deleted_at) return rest;
      return [row, ...rest].sort((a, b) => ((a.pinned_at ?? "") < (b.pinned_at ?? "") ? 1 : -1));
    });
  }, []);
  const trackPinRef = useRef(trackPin);

  const setPinned = useCallback(
    async (id: string, pin: boolean) => {
      await pinMessageRpc(supabase, id, pin);
      const row = messagesRef.current.find((m) => m.id === id);
      if (row) trackPin({ ...row, pinned_at: pin ? new Date().toISOString() : null });
    },
    [supabase, trackPin],
  );

  const toggleStar = useCallback(
    async (id: string) => {
      const next = !starred.has(id);
      setStarred((prev) => {
        const s = new Set(prev);
        if (next) s.add(id);
        else s.delete(id);
        return s;
      });
      try {
        await setStar(supabase, id, next);
      } catch (error) {
        setStarred((prev) => {
          const s = new Set(prev);
          if (next) s.delete(id);
          else s.add(id);
          return s;
        });
        throw error;
      }
    },
    [supabase, starred],
  );

  const hideMessage = useCallback(
    async (id: string) => {
      const original = messagesRef.current.find((m) => m.id === id);
      if (!original || original.local) return;
      dispatch({ type: "remove", id });
      try {
        await hideMessageRpc(supabase, id);
      } catch (error) {
        dispatch({ type: "upsert", rows: [original] });
        throw error;
      }
    },
    [supabase],
  );

  const clearHistory = useCallback(async () => {
    await clearChat(supabase, conversationId);
    dispatch({ type: "cleared" });
  }, [supabase, conversationId]);

  const discard = useCallback(
    (id: string) => {
      const item = outbox.current.get(id);
      outbox.current.delete(id);
      dispatch({ type: "remove", id });
      if (item?.image?.uploaded && item.row.image_url) {
        void supabase.storage.from("chat-images").remove([item.row.image_url]);
      }
      const preview = previews.current.get(id);
      if (preview) {
        URL.revokeObjectURL(preview);
        previews.current.delete(id);
      }
    },
    [supabase],
  );

  useEffect(() => {
    const map = previews.current;
    return () => map.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  // ------------------------------------------------------------------ realtime

  useEffect(() => {
    let disposed = false;
    let everSubscribed = false;

    const channel = supabase.channel(`conversation:${conversationId}`, {
      config: {
        private: true,
        broadcast: { self: false },
        presence: { key: session.me.id, enabled: true },
      },
    });
    channelRef.current = channel;

    const emitLive = (table: LiveTable, payload: { eventType: string; new: unknown; old: unknown }) => {
      const type = payload.eventType as LiveChange["type"];
      const row = (type === "DELETE" ? payload.old : payload.new) as Record<string, unknown>;
      liveListeners.current.get(table)?.forEach((listener) => listener({ type, row }));
    };

    const onInsert = (row: MessageRow) => {
      dispatch({ type: "upsert", rows: [row] });
      void resolveSnippets([row]);
      if (row.sender_id !== session.me.id) {
        setPartnerTyping(false);
        const away = document.visibilityState !== "visible" || !chatActiveRef.current;
        playSound("received");
        haptic("receive");
        if (away) {
          const me = meRef.current;
          void showMessageNotification(partnerRef.current.display_name, row, {
            showText: me.notification_preview !== false,
            quiet_start: me.quiet_start ?? null,
            quiet_end: me.quiet_end ?? null,
            time_zone: me.time_zone ?? null,
          });
        }
        syncReceipts();
      }
    };

    const onUpdate = (row: MessageRow) => {
      trackPinRef.current(row);
      // Only refresh rows we already show; never pull random old rows into view.
      if (messagesRef.current.some((m) => m.id === row.id)) dispatch({ type: "upsert", rows: [row] });
    };

    const updatePresence = () => {
      const state = channel.presenceState();
      const online = Boolean(state[partnerRef.current.id]?.length);
      if (partnerOnlineRef.current && !online) setPresenceLeftAt(new Date().toISOString());
      partnerOnlineRef.current = online;
      setPartnerOnline(online);
      if (!online) setPartnerTyping(false);
    };

    channel
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => onInsert(payload.new as MessageRow),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => onUpdate(payload.new as MessageRow),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=in.(${session.me.id},${session.partner.id})` },
        (payload) => {
          const profile = payload.new as Profile;
          if (profile.id === session.me.id) setMe(profile);
          else setPartner(profile);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "bond", filter: `conversation_id=eq.${conversationId}` },
        (payload) => setBond(payload.new as BondRow),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "events", filter: `conversation_id=eq.${conversationId}` }, (payload) =>
        emitLive("events", payload),
      )
      // Shared lists. Deletes can't be filtered by conversation (they carry only
      // the id), so they come unfiltered; screens ignore ids they don't show.
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "lists", filter: `conversation_id=eq.${conversationId}` }, (payload) =>
        emitLive("lists", payload),
      )
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "lists", filter: `conversation_id=eq.${conversationId}` }, (payload) =>
        emitLive("lists", payload),
      )
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "lists" }, (payload) => emitLive("lists", payload))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "list_items", filter: `conversation_id=eq.${conversationId}` }, (payload) =>
        emitLive("list_items", payload),
      )
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "list_items", filter: `conversation_id=eq.${conversationId}` }, (payload) =>
        emitLive("list_items", payload),
      )
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "list_items" }, (payload) => emitLive("list_items", payload))
      .on("postgres_changes", { event: "*", schema: "public", table: "locations", filter: `conversation_id=eq.${conversationId}` }, (payload) =>
        emitLive("locations", payload),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts", filter: `conversation_id=eq.${conversationId}` }, (payload) =>
        emitLive("alerts", payload),
      )
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload?.user_id !== partnerRef.current.id) return;
        if (typingTimer.current) clearTimeout(typingTimer.current);
        if (payload.typing) {
          setPartnerTyping(true);
          typingTimer.current = setTimeout(() => setPartnerTyping(false), TYPING_TIMEOUT);
        } else {
          setPartnerTyping(false);
        }
      })
      .on("presence", { event: "sync" }, updatePresence);

    const trackIfVisible = () => {
      if (document.visibilityState === "visible") {
        void channel.track({ online_at: new Date().toISOString() });
      }
    };

    (async () => {
      // Private channels authorise with the user's JWT.
      await supabase.realtime.setAuth();
      if (disposed) return;
      channel.subscribe((status, err) => {
        if (disposed) return;
        if (status === "SUBSCRIBED") {
          setConnection("online");
          trackIfVisible();
          // One write per (re)connect keeps "last seen" honest even if the
          // tab is later killed without a pagehide. Not a heartbeat.
          void supabase.rpc("touch_last_seen");
          if (everSubscribed) void catchUp();
          everSubscribed = true;
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          devLog(`realtime ${status}`, err);
          setConnection(navigator.onLine ? "reconnecting" : "offline");
          partnerOnlineRef.current = false;
          setPartnerOnline(false);
        }
      });
    })();

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        trackIfVisible();
        void catchUp().then(syncConnection);
      } else {
        void channel.untrack();
        stopTyping();
        void supabase.rpc("touch_last_seen");
      }
    };
    // The socket may survive a short network blip without re-emitting
    // SUBSCRIBED, so derive the state from the channel after coming back.
    const syncConnection = () => {
      if (disposed) return;
      if (!navigator.onLine) setConnection("offline");
      else if (channel.state === "joined" && supabase.realtime.isConnected()) setConnection("online");
      else setConnection("reconnecting");
    };
    const onOffline = () => setConnection("offline");
    const onOnline = () => {
      syncConnection();
      void catchUp().then(syncConnection);
      // Give the socket a moment to notice, then check again.
      setTimeout(syncConnection, 3000);
    };
    const onPageHide = () => void supabase.rpc("touch_last_seen");
    const onFocus = () => syncReceipts();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("focus", onFocus);

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("focus", onFocus);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      if (receiptTimer.current) clearTimeout(receiptTimer.current);
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [supabase, conversationId, session.me.id, session.partner.id, catchUp, resolveSnippets, syncReceipts, stopTyping]);

  // ------------------------------------------------------------------ exposed

  // ------------------------------------------------------------------ presence heartbeat
  // About every 30 s while the app is on screen: keeps "last seen" right even
  // when the phone freezes the app before it can say goodbye, and tells the
  // server you're looking at the chat so it doesn't send you pop-ups for it.
  const beat = useCallback(() => {
    const visible = document.visibilityState === "visible";
    void supabase.rpc("heartbeat", { in_chat: visible && chatActiveRef.current }).then(({ error }) => {
      // Database not updated yet: fall back to the old one-off write.
      if (error) void supabase.rpc("touch_last_seen");
    });
  }, [supabase]);

  useEffect(() => {
    beat();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") beat();
    }, 30_000);
    const onVisibility = () => beat();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onVisibility);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onVisibility);
    };
  }, [beat]);

  // Coming back to the app: the socket may have slept through your partner's
  // updates, so read their profile again (last seen, status, avatar).
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      void supabase
        .from("profiles")
        .select("*")
        .eq("id", session.partner.id)
        .maybeSingle()
        .then(({ data }) => data && setPartner(data));
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("online", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("online", refresh);
    };
  }, [supabase, session.partner.id]);

  const setChatActive = useCallback(
    (active: boolean) => {
      chatActiveRef.current = active;
      if (active) syncReceipts();
      // Entering or leaving the chat changes whether you should get pop-ups: say so now.
      beat();
    },
    [syncReceipts, beat],
  );

  // A lookup table, so finding each reply's quoted message isn't a search
  // through the whole history (that made long chats slower per render).
  const messagesById = useMemo(() => new Map(state.messages.map((m) => [m.id, m])), [state.messages]);
  const getSnippet = useCallback(
    (id: string): ReplySnippet | undefined => messagesById.get(id) ?? snippets[id],
    [messagesById, snippets],
  );

  const localPreview = useCallback((id: string) => previews.current.get(id), []);
  const updateMe = useCallback((patch: Partial<Profile>) => setMe((prev) => ({ ...prev, ...patch })), []);

  // Keep your time zone on your profile, so quiet hours and anniversary
  // pop-ups (09:00) follow your local time, also after travelling.
  const myZone = me.time_zone ?? null;
  useEffect(() => {
    let zone: string | null = null;
    try {
      zone = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
    } catch {
      return;
    }
    if (!zone || zone === myZone) return;
    void supabase
      .from("profiles")
      .update({ time_zone: zone })
      .eq("id", session.me.id)
      .then(({ error }) => {
        if (error) devLog("time zone save failed", error);
        else updateMe({ time_zone: zone });
      });
  }, [myZone, supabase, session.me.id, updateMe]);

  const unreadCount = useMemo(
    () => state.messages.filter((m) => m.sender_id === partner.id && !m.read_at).length,
    [state.messages, partner.id],
  );

  // The number on the app icon follows what's unread, and clears once you've read it.
  useEffect(() => {
    const nav = navigator as Navigator & {
      setAppBadge?: (count?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (!nav.setAppBadge) return;
    const done = unreadCount > 0 ? nav.setAppBadge(unreadCount) : nav.clearAppBadge?.();
    done?.catch(() => {});
  }, [unreadCount]);

  const data = useMemo<ChatData>(
    () => ({
      me,
      partner,
      conversationId,
      messages: state.messages,
      loaded: state.loaded,
      loadError: state.loadError,
      hasMore: state.hasMore,
      loadingOlder: state.loadingOlder,
      unreadCount,
      bond,
      loadOlder,
      reload,
      sendText,
      editMessage,
      reactions,
      react,
      sendImage,
      sendImages,
      sendVoice,
      sendMedia,
      retry,
      deleteMessage,
      clearHistory,
      hideMessage,
      pinned,
      setPinned,
      starred,
      toggleStar,
      discard,
      getSnippet,
      ensureLoaded,
      localPreview,
      setChatActive,
      updateMe,
      setBond,
    }),
    [
      me, partner, conversationId, state, unreadCount, bond, loadOlder, reload, sendText, editMessage, reactions, react, sendImage, sendImages, sendVoice,
      sendMedia, retry, deleteMessage, clearHistory, hideMessage, pinned, setPinned, starred, toggleStar, discard, getSnippet, ensureLoaded, localPreview, setChatActive, updateMe,
    ],
  );

  // The latest proof your partner was here: their profile's last_seen, when we
  // saw them leave, their newest message, or when they read one of yours.
  const partnerLastSeen = useMemo(
    () => latestSeen(partner.last_seen, presenceLeftAt, state.messages, partner.id),
    [partner.last_seen, partner.id, presenceLeftAt, state.messages],
  );

  const presence = useMemo<Presence>(
    () => ({
      partnerOnline,
      partnerTyping,
      partnerLastSeen,
      connection,
      notifyTyping,
      stopTyping,
    }),
    [partnerOnline, partnerTyping, partnerLastSeen, connection, notifyTyping, stopTyping],
  );

  return (
    <ChatDataContext.Provider value={data}>
      <PresenceContext.Provider value={presence}>
        <LiveContext.Provider value={live}>{children}</LiveContext.Provider>
      </PresenceContext.Provider>
    </ChatDataContext.Provider>
  );
}

