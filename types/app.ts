import type { Database } from "./database";

type Tables = Database["public"]["Tables"];

export type Profile = Tables["profiles"]["Row"];
export type MessageRow = Tables["messages"]["Row"];
export type BondRow = Tables["bond"]["Row"];
export type MemoryRow = Tables["memories"]["Row"];

export type MessageType = "text" | "image";

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

export type ReplySnippet = Pick<MessageRow, "id" | "sender_id" | "content" | "message_type">;

export type Session = {
  me: Profile;
  partner: Profile;
  conversationId: string;
};

export type ReceiptState = "sending" | "failed" | "sent" | "delivered" | "read";
