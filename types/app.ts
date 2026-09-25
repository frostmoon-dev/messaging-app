import type { Database } from "./database";

type Tables = Database["public"]["Tables"];

export type Profile = Tables["profiles"]["Row"];
export type MessageRow = Tables["messages"]["Row"];
export type BondRow = Tables["bond"]["Row"];
export type MemoryRow = Tables["memories"]["Row"];
export type EventRow = Tables["events"]["Row"];
export type LocationRow = Tables["locations"]["Row"];
export type AlertRow = Tables["alerts"]["Row"];
export type StickerRow = Tables["stickers"]["Row"];
export type ListRow = Tables["lists"]["Row"];
export type ListItemRow = Tables["list_items"]["Row"];

export type MessageType = "text" | "image" | "sticker" | "gif" | "voice";

/** Client-only state layered on top of a stored message. */
export type LocalState = {
  status: "sending" | "failed";
  error?: string;
  /** Object URL for an image that is still uploading. */
  previewUrl?: string;
  /** 0–1 upload progress for image messages. */
  progress?: number;
  /** Upload finished; a retry only needs to insert the row. */
  uploaded?: boolean;
  /** The compressed file, kept so a failed upload can be retried. */
  file?: Blob;
};

export type ChatMessage = MessageRow & { local?: LocalState };

export type ReplySnippet = Pick<MessageRow, "id" | "sender_id" | "content" | "message_type" | "deleted_at">;

export type Session = {
  me: Profile;
  partner: Profile;
  conversationId: string;
};

export type ReceiptState = "sending" | "failed" | "sent" | "delivered" | "read";
