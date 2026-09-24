"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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
  insertMessage,
  markDelivered,
  markRead,
  type NewMessage,
} from "@/lib/messages/api";
import { chatReducer, initialChatState } from "@/lib/messages/store";
import { validateMessageText } from "@/lib/messages/validation";
import { uploadWithProgress } from "@/lib/storage/upload";
import type { PreparedImage } from "@/lib/storage/image";
import { friendlyError } from "@/lib/errors";
import { devLog, uuid } from "@/lib/utils";
import { playSound } from "@/lib/sound";
import { showMessageNotification } from "@/lib/notifications";
import type { BondRow, ChatMessage, MessageRow, Profile, ReplySnippet, Session } from "@/types/app";

// ---------------------------------------------------------------------------
// Context shapes
// ---------------------------------------------------------------------------

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
  sendText: (text: string, replyTo: string | null) => boolean;
  sendImage: (image: PreparedImage, caption: string, replyTo: string | null) => void;
  retry: (id: string) => void;
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

export type LiveTable = "events" | "locations" | "alerts";
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
  const partnerOnlineRef = useRef(false);

  useEffect(() => {
    messagesRef.current = state.messages;
  }, [state.messages]);
  useEffect(() => {
    partnerRef.current = partner;
  }, [partner]);

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

  useEffect(() => {
    // Initial fetch; results land in the reducer asynchronously.
    void reload();
  }, [reload]);

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
            "chat-images",
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
        const saved = await insertMessage(supabase, item.row);
        outbox.current.delete(id);
        dispatch({ type: "upsert", rows: [saved] });
        playSound("sent");
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
    (text: string, replyTo: string | null) => {
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

  const sendImage = useCallback(
    (image: PreparedImage, caption: string, replyTo: string | null) => {
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

  const retry = useCallback((id: string) => void persist(id), [persist]);

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
        if (away) void showMessageNotification(partnerRef.current.display_name);
        syncReceipts();
      }
    };

    const onUpdate = (row: MessageRow) => {
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

  const setChatActive = useCallback(
    (active: boolean) => {
      chatActiveRef.current = active;
      if (active) syncReceipts();
    },
    [syncReceipts],
  );

  const getSnippet = useCallback(
    (id: string): ReplySnippet | undefined => state.messages.find((m) => m.id === id) ?? snippets[id],
    [state.messages, snippets],
  );

  const localPreview = useCallback((id: string) => previews.current.get(id), []);
  const updateMe = useCallback((patch: Partial<Profile>) => setMe((prev) => ({ ...prev, ...patch })), []);

  const unreadCount = useMemo(
    () => state.messages.filter((m) => m.sender_id === partner.id && !m.read_at).length,
    [state.messages, partner.id],
  );

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
      sendImage,
      retry,
      discard,
      getSnippet,
      ensureLoaded,
      localPreview,
      setChatActive,
      updateMe,
      setBond,
    }),
    [
      me, partner, conversationId, state, unreadCount, bond, loadOlder, reload, sendText, sendImage,
      retry, discard, getSnippet, ensureLoaded, localPreview, setChatActive, updateMe,
    ],
  );

  const partnerLastSeen = useMemo(() => {
    const stored = partner.last_seen;
    if (!presenceLeftAt) return stored;
    if (!stored) return presenceLeftAt;
    return stored > presenceLeftAt ? stored : presenceLeftAt;
  }, [partner.last_seen, presenceLeftAt]);

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

