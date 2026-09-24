"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { ImageIcon } from "@/components/ui/icons";
import { ImageCropper } from "@/components/ui/ImageCropper";
import { ChatBackdrop, useChatBackground } from "@/components/chat/ChatBackdrop";
import {
  blobToDataUrl,
  DEFAULT_DIM,
  MAX_DIM,
  MIN_DIM,
  PATTERNS,
  setChatBackground,
  type ChatBackground,
} from "@/lib/chat-background";
import { CENTERED, cropRect, type Crop } from "@/lib/storage/crop";
import { cropImage, ImageValidationError, prepareImage, type PreparedImage } from "@/lib/storage/image";
import { MESSAGES } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { Panel } from "./Panel";

// Phone-screen shape; on wider screens the photo covers and centres.
const PHOTO_ASPECT = 9 / 16;
// Small enough to keep in this browser's storage (a few hundred KB).
const PHOTO_MAX_SIDE = 1280;

type Option = { id: string; name: string; value: ChatBackground };
const OPTIONS: Option[] = [
  { id: "none", name: "Plain", value: { kind: "none" } },
  ...PATTERNS.map((p) => ({ id: p.id, name: p.name, value: { kind: "pattern", pattern: p.id } as ChatBackground })),
];

function optionId(bg: ChatBackground) {
  return bg.kind === "pattern" ? bg.pattern : bg.kind;
}

export function ChatBackgroundSection() {
  const current = useChatBackground();
  const selected = optionId(current);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ image: PreparedImage; url: string } | null>(null);
  const [crop, setCrop] = useState<Crop>(CENTERED);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const closeCropper = () => {
    if (pending) URL.revokeObjectURL(pending.url);
    setPending(null);
  };

  const pick = async (file: File) => {
    setError(null);
    try {
      const image = await prepareImage(file);
      if (image.contentType === "image/gif") throw new ImageValidationError("Use a JPG, PNG or WebP for the background.");
      setCrop(CENTERED);
      setPending({ image, url: URL.createObjectURL(image.blob) });
    } catch (err) {
      setError(err instanceof ImageValidationError ? err.message : MESSAGES.upload);
    }
  };

  const savePhoto = async () => {
    if (!pending) return;
    setSaving(true);
    setError(null);
    try {
      const { image } = pending;
      const cropped = await cropImage(image, cropRect(crop, image.width, image.height, PHOTO_ASPECT), PHOTO_MAX_SIDE);
      const src = await blobToDataUrl(cropped.blob);
      const dim = current.kind === "photo" ? current.dim : DEFAULT_DIM;
      if (!setChatBackground({ kind: "photo", src, dim })) {
        setError("This browser couldn't save that photo. Try a smaller one.");
        return;
      }
      closeCropper();
    } catch (err) {
      setError(err instanceof ImageValidationError ? err.message : MESSAGES.upload);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel title="Chat background">
      <p className="-mt-2 mb-4 text-small text-muted-strong">Only on this device. Your photo stays on this phone.</p>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5" role="radiogroup" aria-label="Chat background">
        {OPTIONS.map((o) => (
          <Swatch key={o.id} name={o.name} checked={selected === o.id} onSelect={() => setChatBackground(o.value)}>
            <ChatBackdrop background={o.value} />
          </Swatch>
        ))}
        <Swatch
          name={current.kind === "photo" ? "Photo" : "Your photo"}
          checked={selected === "photo"}
          onSelect={() => fileRef.current?.click()}
        >
          {current.kind === "photo" ? (
            <ChatBackdrop background={current} />
          ) : (
            <span className="absolute inset-x-0 bottom-2 flex justify-center text-muted-strong">
              <ImageIcon size={22} />
            </span>
          )}
        </Swatch>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void pick(f);
        }}
      />

      {current.kind === "photo" && (
        <div className="mt-4 flex flex-col gap-2">
          <label className="flex items-center gap-3 text-small font-semibold text-muted-strong">
            Dim
            <input
              type="range"
              min={MIN_DIM}
              max={MAX_DIM}
              step={0.05}
              value={current.dim}
              onChange={(e) => setChatBackground({ ...current, dim: Number(e.target.value) })}
              className="h-11 flex-1 accent-[var(--accent)]"
            />
          </label>
          <Button variant="ghost" className="self-start" onClick={() => fileRef.current?.click()}>
            <ImageIcon size={18} /> Choose another photo
          </Button>
        </div>
      )}

      {error && !pending && (
        <p className="mt-3 text-small text-danger" role="alert">
          {error}
        </p>
      )}

      {pending && (
        <Dialog onClose={saving ? () => {} : closeCropper} label="Crop chat background" className="w-full sm:w-[420px]">
          <div className="max-h-[92dvh] overflow-y-auto bg-background-raised p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <h2 className="mb-4 text-title font-bold">Chat background</h2>
            <ImageCropper
              src={pending.url}
              width={pending.image.width}
              height={pending.image.height}
              aspect={PHOTO_ASPECT}
              crop={crop}
              onCropChange={setCrop}
              label="Crop background"
            />
            {error && (
              <p className="mt-3 text-small text-danger" role="alert">
                {error}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-3">
              <Button variant="ghost" onClick={closeCropper} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={() => void savePhoto()} disabled={saving}>
                {saving ? "Saving…" : "Use photo"}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </Panel>
  );
}

function Swatch({ name, checked, onSelect, children }: { name: string; checked: boolean; onSelect: () => void; children: React.ReactNode }) {
  return (
    <button type="button" role="radio" aria-checked={checked} onClick={onSelect} className="group flex flex-col items-center gap-1.5">
      <span
        className={cn(
          "relative block aspect-[3/4] w-full overflow-hidden rounded-xl border-2 bg-background transition-colors",
          checked ? "border-accent" : "border-field-border group-hover:border-muted-strong",
        )}
      >
        {children}
        {/* Two tiny bubbles so each swatch reads as a chat. */}
        <span className="absolute top-[30%] left-2 h-2.5 w-[45%] rounded-full bg-incoming ring-1 ring-incoming-shadow" aria-hidden="true" />
        <span className="absolute top-[52%] right-2 h-2.5 w-[40%] rounded-full bg-outgoing" aria-hidden="true" />
      </span>
      <span className={cn("text-small", checked ? "font-bold text-foreground" : "text-muted-strong")}>{name}</span>
    </button>
  );
}
