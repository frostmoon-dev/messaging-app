"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { ChevronLeftIcon, CloseIcon, PlusIcon } from "@/components/ui/icons";
import { ImageCropper } from "@/components/ui/ImageCropper";
import { useChat, type MediaToSend } from "@/components/providers/ChatProvider";
import { useSignedUrl } from "@/lib/hooks/useSignedUrl";
import { CENTERED, cropRect, type Crop } from "@/lib/storage/crop";
import { ImageValidationError, prepareImage, type PreparedImage } from "@/lib/storage/image";
import { addSticker, listStickers, removeSticker } from "@/lib/stickers";
import { friendlyError, MESSAGES } from "@/lib/errors";
import type { GiphyItem, GiphyKind, GiphyPage } from "@/lib/giphy";
import { cn } from "@/lib/utils";
import type { StickerRow } from "@/types/app";

type Tab = "ours" | GiphyKind;
const TABS: { id: Tab; label: string }[] = [
  { id: "ours", label: "Ours" },
  { id: "gifs", label: "GIFs" },
  { id: "stickers", label: "Stickers" },
];

const REDUCE = "(prefers-reduced-motion: reduce)";
function subscribeMotion(onChange: () => void) {
  const q = window.matchMedia(REDUCE);
  q.addEventListener("change", onChange);
  return () => q.removeEventListener("change", onChange);
}

/** Stickers you made, and GIFs and stickers from GIPHY. Picking one sends it right away. */
export function StickerPicker({ onPick, onClose }: { onPick: (media: MediaToSend) => void; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("ours");

  return (
    <Dialog onClose={onClose} label="Stickers and GIFs" className="w-full sm:w-[480px]">
      <div className="relative flex h-[min(75dvh,600px)] flex-col bg-background-raised pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center gap-3 px-4 pt-4 pb-3">
          <div role="tablist" aria-label="Stickers and GIFs" className="flex flex-1 gap-1 rounded-full bg-panel-strong p-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`picker-tab-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls="picker-panel"
                onClick={() => setTab(t.id)}
                className={cn(
                  "min-h-9 flex-1 rounded-full text-small font-semibold transition-colors",
                  tab === t.id ? "bg-accent text-accent-foreground" : "text-muted-strong hover:text-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-strong hover:bg-panel-strong hover:text-foreground"
            aria-label="Close"
          >
            <CloseIcon size={20} />
          </button>
        </div>

        <div id="picker-panel" role="tabpanel" aria-labelledby={`picker-tab-${tab}`} className="flex min-h-0 flex-1 flex-col">
          {tab === "ours" ? <OurStickers onPick={onPick} /> : <GiphyTab key={tab} kind={tab} onPick={onPick} />}
        </div>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Your own pack

function OurStickers({ onPick }: { onPick: (media: MediaToSend) => void }) {
  const { conversationId, me } = useChat();
  const fileRef = useRef<HTMLInputElement>(null);
  const [stickers, setStickers] = useState<StickerRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState<{ image: PreparedImage; url: string } | null>(null);
  const [crop, setCrop] = useState<Crop>(CENTERED);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setStickers(await listStickers(conversationId));
    } catch (err) {
      setError(friendlyError(err, "load"));
    }
  }, [conversationId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch when the tab opens
    void load();
  }, [load]);

  const closeCropper = () => {
    if (pending) URL.revokeObjectURL(pending.url);
    setPending(null);
  };

  const pick = async (file: File) => {
    setError(null);
    try {
      const image = await prepareImage(file);
      setCrop(CENTERED);
      setPending({ image, url: URL.createObjectURL(image.blob) });
    } catch (err) {
      setError(err instanceof ImageValidationError ? err.message : MESSAGES.upload);
    }
  };

  const save = async () => {
    if (!pending) return;
    setSaving(true);
    setError(null);
    try {
      const { image } = pending;
      const rect = image.contentType === "image/gif" ? null : cropRect(crop, image.width, image.height, 1);
      const row = await addSticker(conversationId, image, rect);
      setStickers((prev) => [row, ...(prev ?? [])]);
      closeCropper();
    } catch (err) {
      setError(err instanceof ImageValidationError ? err.message : friendlyError(err, "upload"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    const before = stickers;
    setStickers((prev) => prev?.filter((s) => s.id !== id) ?? null);
    try {
      await removeSticker(id);
    } catch (err) {
      setStickers(before);
      setError(friendlyError(err, "save"));
    }
  };

  if (pending) {
    const gif = pending.image.contentType === "image/gif";
    return (
      // Covers the whole sheet (tabs included) so making a sticker is one clear step.
      <div className="absolute inset-0 z-10 flex flex-col bg-background-raised pb-[env(safe-area-inset-bottom)]" role="group" aria-labelledby="new-sticker-title">
        <div className="flex items-center gap-2 px-4 pt-4 pb-2">
          <button
            type="button"
            onClick={closeCropper}
            disabled={saving}
            className="-ml-2.5 flex size-11 items-center justify-center rounded-full text-muted-strong hover:bg-panel-strong hover:text-foreground"
            aria-label="Back to stickers"
          >
            <ChevronLeftIcon size={22} />
          </button>
          <h2 id="new-sticker-title" className="text-title font-bold">
            New sticker
          </h2>
        </div>

        <div className="scroll-area min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          <p className="mb-3 text-small text-muted-strong">
            {gif ? "GIFs are added as they are, so they keep moving." : "Stickers are square. Frame the part you want."}
          </p>
          {gif ? (
            // eslint-disable-next-line @next/next/no-img-element -- local blob preview
            <img src={pending.url} alt="New sticker" className="mx-auto max-h-56 rounded-2xl object-contain" />
          ) : (
            <ImageCropper
              src={pending.url}
              width={pending.image.width}
              height={pending.image.height}
              aspect={1}
              crop={crop}
              onCropChange={setCrop}
              label="Crop sticker"
              maxHeightRatio={0.38}
            />
          )}
          {error && (
            <p className="mt-3 text-small text-danger" role="alert">
              {error}
            </p>
          )}
        </div>

        {/* Always visible, whatever the screen height. */}
        <div className="flex gap-3 border-t border-border px-4 pt-3 pb-4">
          <Button variant="ghost" className="flex-1" onClick={closeCropper} disabled={saving}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={() => void save()} disabled={saving}>
            {saving ? "Adding…" : "Add to our stickers"}
          </Button>
        </div>
      </div>
    );
  }

  const mine = stickers?.filter((s) => s.created_by === me.id).length ?? 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/webp,image/gif,image/jpeg,image/heic,image/heif"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void pick(f);
        }}
      />
      <div className="flex items-center justify-between px-4 pb-2">
        <p className="text-small text-muted-strong">Shared by the two of you.</p>
        {mine > 0 && (
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            aria-pressed={editing}
            className="min-h-11 rounded-full px-3 text-small font-semibold text-muted-strong hover:bg-panel-strong hover:text-foreground"
          >
            {editing ? "Done" : "Remove"}
          </button>
        )}
      </div>
      {error && (
        <p className="px-4 pb-2 text-small text-danger" role="alert">
          {error}
        </p>
      )}
      <div className="scroll-area min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <ul className="grid grid-cols-4 gap-2">
          <li>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-field-border text-muted-strong hover:bg-panel-strong hover:text-foreground"
            >
              <PlusIcon size={20} />
              <span className="text-meta font-semibold">Add</span>
            </button>
          </li>
          {stickers === null && !error
            ? Array.from({ length: 7 }, (_, i) => (
                <li key={i}>
                  <span className="skeleton block aspect-square w-full rounded-2xl" aria-hidden="true" />
                </li>
              ))
            : stickers?.map((s) => (
                <OurSticker
                  key={s.id}
                  sticker={s}
                  removable={editing && s.created_by === me.id}
                  onPick={() => onPick({ type: "sticker", url: s.image_path, width: s.image_width ?? 512, height: s.image_height ?? 512 })}
                  onRemove={() => void remove(s.id)}
                />
              ))}
        </ul>
        {stickers?.length === 0 && (
          <p className="mt-6 text-center text-small text-muted-strong">Make stickers from your photos. Transparent PNGs work best.</p>
        )}
      </div>
    </div>
  );
}

function OurSticker({ sticker, removable, onPick, onRemove }: { sticker: StickerRow; removable: boolean; onPick: () => void; onRemove: () => void }) {
  const { url } = useSignedUrl("stickers", sticker.image_path);
  return (
    <li className="relative">
      <button
        type="button"
        onClick={removable ? onRemove : onPick}
        className={cn("block aspect-square w-full rounded-2xl p-1.5 hover:bg-panel-strong", removable && "animate-pulse")}
        aria-label={removable ? "Remove this sticker" : "Send this sticker"}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed URL
          <img src={url} alt="" className="size-full object-contain" draggable={false} />
        ) : (
          <span className="skeleton block size-full rounded-xl" aria-hidden="true" />
        )}
      </button>
      {removable && (
        <span className="pointer-events-none absolute -top-1 -right-1 flex size-6 items-center justify-center rounded-full bg-danger text-background" aria-hidden="true">
          <CloseIcon size={14} />
        </span>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// GIPHY

function GiphyTab({ kind, onPick }: { kind: GiphyKind; onPick: (media: MediaToSend) => void }) {
  const reduce = useSyncExternalStore(subscribeMotion, () => window.matchMedia(REDUCE).matches, () => false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<GiphyItem[]>([]);
  const [next, setNext] = useState<number | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "off">("loading");
  const [message, setMessage] = useState("");
  const request = useRef(0);

  const fetchPage = useCallback(
    async (q: string, offset: number) => {
      const id = ++request.current;
      if (offset === 0) setStatus("loading");
      try {
        const res = await fetch(`/api/giphy?${new URLSearchParams({ kind, q, offset: String(offset) })}`);
        const body = (await res.json().catch(() => ({}))) as Partial<GiphyPage> & { error?: string };
        if (id !== request.current) return;
        if (res.status === 503) {
          setStatus("off");
          return;
        }
        if (!res.ok || !body.items) {
          setStatus("error");
          setMessage(body.error === "rate_limited" ? "GIPHY needs a short break. Try again in a few minutes." : "Couldn't reach GIPHY. Try again.");
          return;
        }
        setItems((prev) => (offset === 0 ? body.items! : [...prev, ...body.items!]));
        setNext(body.next ?? null);
        setStatus("ready");
      } catch {
        if (id === request.current) {
          setStatus("error");
          setMessage("Couldn't reach GIPHY. Check your connection.");
        }
      }
    },
    [kind],
  );

  // Trending straight away; searches wait for a pause in typing (saves the key's hourly quota).
  useEffect(() => {
    const t = setTimeout(() => void fetchPage(query.trim(), 0), query ? 450 : 0);
    return () => clearTimeout(t);
  }, [query, fetchPage]);

  if (status === "off") {
    return (
      <p className="px-6 py-10 text-center text-small text-muted-strong">
        GIFs aren&apos;t set up yet. Add a GIPHY key (GIPHY_API_KEY) to the app&apos;s settings to turn them on.
      </p>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-4 pb-3">
        <label htmlFor="giphy-search" className="sr-only">
          Search {kind === "gifs" ? "GIFs" : "stickers"}
        </label>
        <input
          id="giphy-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={kind === "gifs" ? "Search GIFs" : "Search stickers"}
          enterKeyHint="search"
          autoComplete="off"
          className="block min-h-11 w-full rounded-full border-2 border-field-border bg-panel px-4 text-body placeholder:text-muted focus:border-accent focus:outline-none"
        />
      </div>

      <div className="scroll-area min-h-0 flex-1 overflow-y-auto px-4" aria-busy={status === "loading"}>
        {status === "error" && (
          <div className="flex flex-col items-center gap-3 py-8 text-center" role="alert">
            <p className="text-small text-muted-strong">{message}</p>
            <Button variant="secondary" onClick={() => void fetchPage(query.trim(), 0)}>
              Try again
            </Button>
          </div>
        )}
        {status === "loading" && (
          <ul className="grid grid-cols-3 gap-2" aria-hidden="true">
            {Array.from({ length: 9 }, (_, i) => (
              <li key={i} className="skeleton aspect-square rounded-2xl" />
            ))}
          </ul>
        )}
        {status === "ready" && items.length === 0 && (
          <p className="py-8 text-center text-small text-muted-strong">Nothing found for “{query.trim()}”.</p>
        )}
        {status === "ready" && items.length > 0 && (
          <ul className="grid grid-cols-3 gap-2">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onPick({ type: kind === "gifs" ? "gif" : "sticker", url: item.send, width: item.width, height: item.height, title: item.title })}
                  className={cn("block aspect-square w-full overflow-hidden rounded-2xl", kind === "gifs" ? "bg-panel-strong" : "p-1.5 hover:bg-panel-strong")}
                  aria-label={`Send ${item.title || (kind === "gifs" ? "GIF" : "sticker")}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- GIPHY media */}
                  <img
                    src={reduce ? item.still : item.preview}
                    alt=""
                    loading="lazy"
                    className={cn("size-full", kind === "gifs" ? "object-cover" : "object-contain")}
                    draggable={false}
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
        {status === "ready" && next !== null && (
          <div className="flex justify-center py-3">
            <Button variant="ghost" onClick={() => void fetchPage(query.trim(), next)}>
              Show more
            </Button>
          </div>
        )}
      </div>

      {/* GIPHY's terms ask for this wherever their results are shown. */}
      <p className="px-4 pt-2 pb-3 text-center text-meta font-bold tracking-wide text-muted">Powered by GIPHY</p>
    </div>
  );
}
