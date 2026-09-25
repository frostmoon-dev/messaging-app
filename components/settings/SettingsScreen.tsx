"use client";

import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { useChat } from "@/components/providers/ChatProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { LogoutIcon } from "@/components/ui/icons";
import { StatusPicker } from "@/components/profile/StatusPicker";
import { StatusIcon } from "@/components/ui/StatusIcon";
import { createClient } from "@/lib/supabase/client";
import { signOut, setTheme } from "@/lib/auth/actions";
import { THEMES, SCHEME_COLORS, THEME_COLORS, type ThemeId, isThemeId, DEFAULT_THEME } from "@/lib/themes";
import { isSoundEnabled, playSound, setSoundEnabled } from "@/lib/sound";
import { haptic, isHapticsEnabled, setHapticsEnabled } from "@/lib/haptics";
import {
  notificationPermission,
  notificationsEnabled,
  requestNotificationPermission,
  setNotificationsMuted,
} from "@/lib/notifications";
import { cropImage, ImageValidationError, prepareImage, type PreparedImage } from "@/lib/storage/image";
import { CENTERED, cropRect, type Crop } from "@/lib/storage/crop";
import { ImageCropper } from "@/components/ui/ImageCropper";
import { Dialog } from "@/components/ui/Dialog";
import { uploadWithProgress } from "@/lib/storage/upload";
import { clearSignedUrlCache } from "@/lib/storage/signed-urls";
import { clearChatCaches } from "@/lib/messages/cache";
import { friendlyError, MESSAGES } from "@/lib/errors";
import { activeStatus } from "@/lib/status";
import { cn, devLog } from "@/lib/utils";
import { disablePush, enablePush, pushSupported } from "@/lib/push";
import { PageHeader } from "@/components/ui/PageHeader";
import { fieldClass, labelClass } from "@/components/ui/field";
import type { Profile } from "@/types/app";
import { Panel } from "./Panel";
import { ChatBackgroundSection } from "./ChatBackgroundSection";
import { ChatHistorySection } from "./ChatHistorySection";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function SettingsScreen() {
  return (
    <div className="scroll-area h-full overflow-y-auto pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8">
        <PageHeader title="Settings" />
        <ProfileSection />
        <ThemeSection />
        <ChatBackgroundSection />
        <ChatHistorySection />
        <AlertsSection />
        <InstallSection />
        <SignOutSection />
      </div>
    </div>
  );
}


// ---------------------------------------------------------------------------

function ProfileSection() {
  const { me, updateMe } = useChat();
  const [name, setName] = useState(me.display_name);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const status = activeStatus(me);

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = name.trim();
    if (!value || value.length > 40 || value === me.display_name) return;
    setSaving(true);
    const { error } = await createClient().from("profiles").update({ display_name: value }).eq("id", me.id);
    setSaving(false);
    if (error) setMessage({ tone: "error", text: friendlyError(error, "save") });
    else {
      updateMe({ display_name: value });
      setMessage({ tone: "ok", text: "Saved." });
    }
  };

  // Picking a photo opens the cropper; saving crops, uploads and swaps it in.
  const [pending, setPending] = useState<{ image: PreparedImage; url: string } | null>(null);
  const [crop, setCrop] = useState<Crop>(CENTERED);

  const closeCropper = () => {
    if (pending) URL.revokeObjectURL(pending.url);
    setPending(null);
  };

  const pickAvatar = async (file: File) => {
    setMessage(null);
    try {
      const image = await prepareImage(file);
      if (image.contentType === "image/gif") throw new ImageValidationError("Use a JPG, PNG or WebP for your avatar.");
      setCrop(CENTERED);
      setPending({ image, url: URL.createObjectURL(image.blob) });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof ImageValidationError ? error.message : MESSAGES.upload });
    }
  };

  const saveAvatar = async () => {
    if (!pending) return;
    setUploading(true);
    setMessage(null);
    try {
      const { image: source } = pending;
      const image = await cropImage(source, cropRect(crop, source.width, source.height, 1), 512);
      const path = `${me.id}/avatar-${Date.now()}.${image.extension}`;
      await uploadWithProgress("avatars", path, image.blob, image.contentType);
      const supabase = createClient();
      const { error } = await supabase.from("profiles").update({ avatar_url: path }).eq("id", me.id);
      if (error) throw error;
      const previous = me.avatar_url;
      updateMe({ avatar_url: path });
      if (previous && previous.startsWith(`${me.id}/`)) await supabase.storage.from("avatars").remove([previous]);
      closeCropper();
      setMessage({ tone: "ok", text: "Avatar updated." });
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof ImageValidationError ? error.message : friendlyError(error, "upload"),
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Panel title="Profile">
      <div className="flex items-center gap-4">
        <Avatar profile={me} size="lg" showStatus />
        <div className="flex flex-col items-start gap-1">
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
              if (f) void pickAvatar(f);
            }}
          />
          <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? "Uploading…" : "Change avatar"}
          </Button>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="flex min-h-11 items-center gap-2 text-left text-small text-muted-strong underline-offset-2 hover:text-foreground hover:underline"
          >
            {status?.icon && <StatusIcon icon={status.icon} />}
            {status ? `${status.text} (change)` : "Set a status"}
          </button>
        </div>
      </div>

      <form onSubmit={saveName} className="mt-5 flex items-end gap-3">
        <div className="flex-1">
          <label htmlFor="display-name" className={labelClass}>
            Display name
          </label>
          <input
            id="display-name"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            className={fieldClass}
          />
        </div>
        <Button type="submit" disabled={saving || !name.trim() || name.trim() === me.display_name}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </form>
      {message && (
        <p className={cn("mt-3 text-small", message.tone === "error" ? "text-danger" : "text-muted-strong")} role="status">
          {message.text}
        </p>
      )}
      {pickerOpen && <StatusPicker onClose={() => setPickerOpen(false)} />}
      {pending && (
        <Dialog onClose={uploading ? () => {} : closeCropper} label="Crop your avatar" className="w-full sm:w-[420px]">
          <div className="bg-background-raised p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <h2 className="mb-4 text-title font-bold">Crop your avatar</h2>
            <ImageCropper
              src={pending.url}
              width={pending.image.width}
              height={pending.image.height}
              aspect={1}
              crop={crop}
              onCropChange={setCrop}
              round
              label="Crop avatar"
            />
            {message?.tone === "error" && (
              <p className="mt-3 text-small text-danger" role="alert">
                {message.text}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-3">
              <Button variant="ghost" onClick={closeCropper} disabled={uploading}>
                Cancel
              </Button>
              <Button onClick={() => void saveAvatar()} disabled={uploading}>
                {uploading ? "Saving…" : "Save avatar"}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------

const subscribeNoop = () => () => {};

function applyTheme(id: ThemeId) {
  document.documentElement.setAttribute("data-theme", id);
  const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
  const fixed = id === "system" ? SCHEME_COLORS[prefersLight ? "light" : "dark"] : THEME_COLORS[id];
  // The server may have rendered one tag or a light/dark pair. Pairs keep
  // their media query when following the system; otherwise all get one colour.
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    const media = meta.getAttribute("media");
    const own = id === "system" && media ? SCHEME_COLORS[media.includes("light") ? "light" : "dark"] : fixed;
    meta.setAttribute("content", own);
  });
}

function currentTheme(): ThemeId {
  const t = document.documentElement.dataset.theme;
  return isThemeId(t) ? t : DEFAULT_THEME;
}

function ThemeSection() {
  const hydrated = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const [chosen, setChosen] = useState<ThemeId | null>(null);
  const theme = chosen ?? (hydrated ? currentTheme() : DEFAULT_THEME);
  const [, startTransition] = useTransition();

  const choose = (id: ThemeId) => {
    setChosen(id);
    applyTheme(id);
    startTransition(() => void setTheme(id));
  };

  return (
    <Panel title="Theme">
      <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Theme">
        {THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={theme === t.id}
            onClick={() => choose(t.id)}
            className={cn(
              "flex min-h-11 flex-col gap-0.5 rounded-xl border-2 p-3 text-left transition-colors",
              theme === t.id ? "border-accent bg-accent-soft" : "border-field-border hover:bg-panel-strong",
            )}
          >
            <span className="font-semibold">{t.name}</span>
            <span className="text-small text-muted-strong">{t.description}</span>
          </button>
        ))}
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------

function Toggle({ id, label, description, checked, onChange, disabled }: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div>
        <label htmlFor={id} className="font-semibold">{label}</label>
        <p className="text-small text-muted-strong">{description}</p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-8 w-13 shrink-0 rounded-full border-2 transition-colors disabled:cursor-not-allowed disabled:border-border disabled:bg-panel-strong",
          checked ? "border-accent bg-accent" : "border-field-border bg-panel-strong",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 size-6 rounded-full transition-transform duration-150",
            checked ? "translate-x-5 bg-accent-foreground" : "translate-x-0 bg-muted-strong",
          )}
          aria-hidden="true"
        />
      </button>
    </div>
  );
}

type AlertSettings = Partial<Pick<Profile, "notify_reactions" | "quiet_start" | "quiet_end" | "time_zone">>;

// Quiet hours are stored as minutes after local midnight.
const DEFAULT_QUIET = { start: 23 * 60, end: 7 * 60 };

function toClock(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function fromClock(value: string): number | null {
  const match = /^(\d{2}):(\d{2})/.exec(value);
  if (!match) return null;
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return minutes >= 0 && minutes < 1440 ? minutes : null;
}

function localTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

function AlertsSection() {
  const { partner, me, updateMe } = useChat();
  // Read browser-only values after hydration without an effect.
  const hydrated = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const [sound, setSound] = useState<boolean | null>(null);
  const [haptics, setHaptics] = useState<boolean | null>(null);
  const hapticsValue = haptics ?? (!hydrated || isHapticsEnabled());
  const previewOn = me.notification_preview !== false;
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Stored on your profile, because the server writes the pop-ups.
  const togglePreview = async (next: boolean) => {
    setPreviewError(null);
    updateMe({ notification_preview: next });
    const { error } = await createClient().from("profiles").update({ notification_preview: next }).eq("id", me.id);
    if (error) {
      updateMe({ notification_preview: !next });
      setPreviewError(friendlyError(error, "save"));
    }
  };
  // Reactions and quiet hours live on your profile too.
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveProfile = async (next: AlertSettings, previous: AlertSettings) => {
    setSaveError(null);
    updateMe(next);
    const { error } = await createClient().from("profiles").update(next).eq("id", me.id);
    if (error) {
      updateMe(previous);
      setSaveError(friendlyError(error, "save"));
    }
  };
  const quietOn = me.quiet_start != null && me.quiet_end != null;
  const saveQuiet = (start: number | null, end: number | null) =>
    void saveProfile(
      { quiet_start: start, quiet_end: end, time_zone: localTimeZone() },
      { quiet_start: me.quiet_start ?? null, quiet_end: me.quiet_end ?? null, time_zone: me.time_zone ?? null },
    );

  const [permission, setPermission] = useState<ReturnType<typeof notificationPermission> | null>(null);
  const [notifyOn, setNotifyOn] = useState<boolean | null>(null);

  const soundValue = sound ?? (hydrated && isSoundEnabled());
  const permissionValue = permission ?? (hydrated ? notificationPermission() : "default");
  const notifyValue = notifyOn ?? (hydrated && notificationsEnabled());

  const [pushError, setPushError] = useState<string | null>(null);

  const toggleNotifications = async (next: boolean) => {
    setPushError(null);
    if (next && permissionValue !== "granted") {
      const result = await requestNotificationPermission();
      setPermission(result);
      setNotifyOn(result === "granted");
      if (result !== "granted") return;
    } else {
      setNotificationsMuted(!next);
      setNotifyOn(next);
    }
    if (!next) {
      await disablePush();
      return;
    }
    // Ask the server to wake this device too, so alerts arrive when the app is closed.
    try {
      await enablePush();
    } catch (error) {
      devLog("push subscribe failed", error);
      setPushError("Alerts work while the app is open. Alerts when it's closed couldn't be turned on. Try again later.");
    }
  };

  return (
    <Panel title="Alerts">
      <Toggle
        id="toggle-notify"
        label="Notifications"
        description={
          permissionValue === "unsupported"
            ? "Not available here. On iPhone, add the app to your Home Screen first."
            : permissionValue === "denied"
              ? "Blocked in your browser settings."
              : hydrated && pushSupported()
                ? `A pop-up when ${partner.display_name} writes, even when the app is closed. Never while you're in the chat.`
                : `A pop-up when ${partner.display_name} writes while the app is open in the background.`
        }
        checked={Boolean(notifyValue)}
        disabled={permissionValue === "unsupported" || permissionValue === "denied"}
        onChange={(next) => void toggleNotifications(next)}
      />
      {pushError && (
        <p className="text-small text-danger" role="alert">
          {pushError}
        </p>
      )}
      <Toggle
        id="toggle-preview"
        label="Show message text"
        description="The pop-up shows what they wrote. Turn off to show only “Sent you a message” on your lock screen. Photos, GIFs and stickers still say what they are."
        checked={previewOn}
        onChange={(next) => void togglePreview(next)}
      />
      {previewError && (
        <p className="text-small text-danger" role="alert">
          {previewError}
        </p>
      )}
      <Toggle
        id="toggle-reactions"
        label="Reactions"
        description={`A pop-up when ${partner.display_name} reacts to your message.`}
        checked={me.notify_reactions === true}
        onChange={(next) => void saveProfile({ notify_reactions: next }, { notify_reactions: !next })}
      />
      <Toggle
        id="toggle-quiet"
        label="Quiet hours"
        description="Messages and reactions still arrive, without sound or vibration. SOS, alerts and reminders always ring."
        checked={quietOn}
        onChange={(next) => (next ? saveQuiet(DEFAULT_QUIET.start, DEFAULT_QUIET.end) : saveQuiet(null, null))}
      />
      {quietOn && (
        <div className="grid grid-cols-2 gap-3 pb-2">
          <div className="min-w-0">
            <label htmlFor="quiet-start" className={labelClass}>
              From
            </label>
            <input
              id="quiet-start"
              type="time"
              value={toClock(me.quiet_start ?? DEFAULT_QUIET.start)}
              onChange={(e) => {
                const start = fromClock(e.target.value);
                if (start !== null) saveQuiet(start, me.quiet_end ?? DEFAULT_QUIET.end);
              }}
              className={fieldClass}
            />
          </div>
          <div className="min-w-0">
            <label htmlFor="quiet-end" className={labelClass}>
              To
            </label>
            <input
              id="quiet-end"
              type="time"
              value={toClock(me.quiet_end ?? DEFAULT_QUIET.end)}
              onChange={(e) => {
                const end = fromClock(e.target.value);
                if (end !== null) saveQuiet(me.quiet_start ?? DEFAULT_QUIET.start, end);
              }}
              className={fieldClass}
            />
          </div>
        </div>
      )}
      {saveError && (
        <p className="text-small text-danger" role="alert">
          {saveError}
        </p>
      )}
      <Toggle
        id="toggle-haptics"
        label="Haptics"
        description="A soft heartbeat you feel when you send, react or press. On iPhone, only when you tap."
        checked={Boolean(hapticsValue)}
        onChange={(next) => {
          setHapticsEnabled(next);
          setHaptics(next);
          if (next) haptic("heart");
        }}
      />
      <Toggle
        id="toggle-sound"
        label="Sounds"
        description="Short cues for sent and received messages. Off by default."
        checked={Boolean(soundValue)}
        onChange={(next) => {
          setSoundEnabled(next);
          setSound(next);
          if (next) playSound("received");
        }}
      />
    </Panel>
  );
}

// ---------------------------------------------------------------------------

function InstallSection() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const hydrated = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const standalone = hydrated && window.matchMedia("(display-mode: standalone)").matches;
  const ios = hydrated && /iphone|ipad|ipod/i.test(navigator.userAgent);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (standalone) return null;

  return (
    <Panel title="Install">
      {promptEvent ? (
        <Button
          onClick={async () => {
            await promptEvent.prompt();
            setPromptEvent(null);
          }}
        >
          Add to Home Screen
        </Button>
      ) : ios ? (
        <p className="text-small text-muted-strong">
          In Safari, tap <strong className="text-foreground">Share</strong>, then{" "}
          <strong className="text-foreground">Add to Home Screen</strong>. It then opens full-screen.
        </p>
      ) : (
        <p className="text-small text-muted-strong">Open your browser menu and choose <strong className="text-foreground">Install app</strong>.</p>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------

function SignOutSection() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="flex flex-col items-start gap-2 pt-2">
      <Button
        variant="danger"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            try {
              // Stop pushes to this device before the session ends.
              await disablePush();
              await createClient().rpc("touch_last_seen");
              clearSignedUrlCache();
              clearChatCaches();
              await signOut();
            } catch (err) {
              // redirect() throws on purpose; anything else is a real failure.
              if ((err as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw err;
              setError(MESSAGES.generic);
            }
          })
        }
      >
        <LogoutIcon size={18} /> {pending ? "Signing out…" : "Sign out"}
      </Button>
      {error && <p className="text-small text-danger" role="alert">{error}</p>}
    </section>
  );
}
