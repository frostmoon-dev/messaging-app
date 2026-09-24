import { createClient } from "@/lib/supabase/client";
import { cropImage, ImageValidationError, type PreparedImage } from "@/lib/storage/image";
import type { Rect } from "@/lib/storage/crop";
import { uploadWithProgress } from "@/lib/storage/upload";
import { uuid } from "@/lib/utils";
import type { StickerRow } from "@/types/app";

/** Stickers are small: 512px on the long side is sharp at chat size on any phone. */
export const STICKER_SIZE = 512;

export async function listStickers(conversationId: string): Promise<StickerRow[]> {
  const { data, error } = await createClient()
    .from("stickers")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

/** Matches the `stickers` bucket limit. */
const MAX_STICKER_BYTES = 2 * 1024 * 1024;

/** Crops, uploads and adds a sticker to the pack you share. GIFs are kept as they are so they stay animated. */
export async function addSticker(conversationId: string, image: PreparedImage, rect: Rect | null): Promise<StickerRow> {
  const sticker = image.contentType === "image/gif" || !rect ? image : await cropImage(image, rect, STICKER_SIZE);
  if (sticker.blob.size > MAX_STICKER_BYTES) throw new ImageValidationError("Stickers must be under 2 MB.");
  const id = uuid();
  const path = `${conversationId}/${id}.${sticker.extension}`;
  await uploadWithProgress("stickers", path, sticker.blob, sticker.contentType);
  const supabase = createClient();
  const { data, error } = await supabase
    .from("stickers")
    .insert({ id, conversation_id: conversationId, image_path: path, image_width: sticker.width, image_height: sticker.height })
    .select("*")
    .single();
  if (error) {
    // Best effort: don't leave an orphan file behind.
    await supabase.storage.from("stickers").remove([path]);
    throw error;
  }
  return data;
}

/** Removes it from the pack. The file stays so stickers already sent keep showing. */
export async function removeSticker(id: string) {
  const { error } = await createClient().from("stickers").delete().eq("id", id);
  if (error) throw error;
}
