"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { CloseIcon, ImageIcon } from "@/components/ui/icons";
import { useChat } from "@/components/providers/ChatProvider";
import { createClient } from "@/lib/supabase/client";
import { ImageValidationError, prepareImage, type PreparedImage } from "@/lib/storage/image";
import { uploadWithProgress } from "@/lib/storage/upload";
import { friendlyError, MESSAGES } from "@/lib/errors";
import { todayDateOnly } from "@/lib/time";
import { uuid } from "@/lib/utils";
import type { MemoryRow } from "@/types/app";
import { fieldClass as inputClass, labelClass } from "@/components/ui/field";


export function MemoryForm({ onClose, onCreated }: { onClose: () => void; onCreated: (m: MemoryRow) => void }) {
  const { conversationId } = useChat();
  const fileRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<PreparedImage | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayDateOnly());
  const [caption, setCaption] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Remember a finished upload so "try again" only re-inserts the row.
  const uploaded = useRef<{ path: string } | null>(null);

  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  const pick = async (file: File) => {
    setError(null);
    setPreparing(true);
    uploaded.current = null;
    try {
      const prepared = await prepareImage(file);
      setImage(prepared);
      setPreview(URL.createObjectURL(prepared.blob));
    } catch (err) {
      setError(err instanceof ImageValidationError ? err.message : MESSAGES.upload);
    } finally {
      setPreparing(false);
    }
  };

  const busy = progress !== null;
  const valid = Boolean(image) && title.trim().length > 0 && title.length <= 80 && caption.length <= 280 && Boolean(date);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!image || !valid || busy) return;
    setError(null);
    setProgress(0);

    const id = uuid();
    let path = uploaded.current?.path;
    if (!path) {
      path = `${conversationId}/${id}.${image.extension}`;
      try {
        await uploadWithProgress("memories", path, image.blob, image.contentType, setProgress);
        uploaded.current = { path };
      } catch (err) {
        setProgress(null);
        setError(friendlyError(err, "upload"));
        return;
      }
    }

    const { data, error: err } = await createClient()
      .from("memories")
      .insert({
        id,
        conversation_id: conversationId,
        title: title.trim(),
        caption: caption.trim() || null,
        memory_date: date,
        image_path: path,
        image_width: image.width,
        image_height: image.height,
      })
      .select("*")
      .single();
    setProgress(null);
    if (err) {
      setError(friendlyError(err, "save"));
      return;
    }
    onCreated(data);
  };

  return (
    <Dialog onClose={busy ? () => {} : onClose} label="Add a memory" className="w-full sm:w-[460px]">
      <form onSubmit={submit} className="max-h-[90dvh] overflow-y-auto rounded-t-[20px] bg-background-raised p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-[20px]">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-title font-bold">New memory</h2>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="-mt-1 -mr-2 flex size-11 items-center justify-center rounded-full text-muted-strong hover:bg-panel-strong hover:text-foreground" aria-label="Close">
            <CloseIcon size={20} />
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void pick(f);
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-card border-2 border-dashed border-field-border bg-panel transition-colors hover:bg-panel-strong"
          aria-label={image ? "Change photo" : "Choose a photo"}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- local blob preview
            <img src={preview} alt="Selected photo" className="size-full object-cover" />
          ) : preparing ? (
            <span className="skeleton absolute inset-0" />
          ) : (
            <span className="flex flex-col items-center gap-2 text-muted-strong">
              <ImageIcon size={28} />
              <span className="font-semibold">Choose a photo</span>
            </span>
          )}
        </button>

        <div className="mt-4">
          <label htmlFor="memory-title" className={labelClass}>Title</label>
          <input id="memory-title" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} className={inputClass} required />
        </div>
        <div className="mt-4">
          <label htmlFor="memory-date" className={labelClass}>Date</label>
          <input id="memory-date" type="date" value={date} max={todayDateOnly()} onChange={(e) => setDate(e.target.value)} className={inputClass} required />
        </div>
        <div className="mt-4">
          <label htmlFor="memory-caption" className={labelClass}>Caption (optional)</label>
          <textarea
            id="memory-caption"
            value={caption}
            maxLength={280}
            rows={3}
            onChange={(e) => setCaption(e.target.value)}
            className={`${inputClass} resize-none`}
          />
          <p className="mt-1 text-right font-mono text-meta text-muted">{caption.length}/280</p>
        </div>

        {progress !== null && (
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-panel-strong" role="progressbar" aria-label="Upload progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
            <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        )}
        {error && <p className="mt-3 text-small text-danger" role="alert">{error}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" disabled={!valid || busy || preparing}>
            {busy ? "Saving…" : "Save memory"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
