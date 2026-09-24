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
import { THEMES, SCHEME_COLORS, type ThemeId, isThemeId, DEFAULT_THEME, themeScheme } from "@/lib/themes";
import { isSoundEnabled, playSound, setSoundEnabled } from "@/lib/sound";
import {
  notificationPermission,
  notificationsEnabled,
  requestNotificationPermission,
  setNotificationsMuted,
} from "@/lib/notifications";
import { ImageValidationError, prepareImage } from "@/lib/storage/image";
import { uploadWithProgress } from "@/lib/storage/upload";
import { clearSignedUrlCache } from "@/lib/storage/signed-urls";
import { friendlyError, MESSAGES } from "@/lib/errors";
import { activeStatus } from "@/lib/status";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { fieldClass, labelClass } from "@/components/ui/field";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function SettingsScreen() {
  return (
    <div className="scroll-area h-full overflow-y-auto pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex max-w-xl flex-col gap-6 px-5 py-8 sm:px-8">
        <PageHeader title="Settings" />
        <ProfileSection />
        <ThemeSection />
        <AlertsSection />
        <InstallSection />
        <SignOutSection />
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="p5-panel bg-panel p-4 sm:p-5" aria-labelledby={`section-${title}`}>
      <h2 id={`section-${title}`} className="mb-4 flex items-center gap-2.5 text-title font-bold">
        <span className="p5-button h-5 w-2.5 bg-accent" aria-hidden="true" />
        {title}
      </h2>
      {children}
    </section>
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

  const uploadAvatar = async (file: File) => {
    setUploading(true);
    setMessage(null);
    try {
      const image = await prepareImage(file);
      if (image.contentType === "image/gif") throw new ImageValidationError("Use a JPG, PNG or WebP for your avatar.");
      const path = `${me.id}/avatar-${Date.now()}.${image.extension}`;
      await uploadWithProgress("avatars", path, image.blob, image.contentType);
      const supabase = createClient();
      const { error } = await supabase.from("profiles").update({ avatar_url: path }).eq("id", me.id);
      if (error) throw error;
      const previous = me.avatar_url;
      updateMe({ avatar_url: path });
      if (previous && previous.startsWith(`${me.id}/`)) await supabase.storage.from("avatars").remove([previous]);
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
              if (f) void uploadAvatar(f);
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
    </Panel>
  );
}

// ---------------------------------------------------------------------------

const subscribeNoop = () => () => {};

function applyTheme(id: ThemeId) {
  document.documentElement.setAttribute("data-theme", id);
  const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
  const scheme = id === "system" ? (prefersLight ? "light" : "dark") : themeScheme(id);
  // The server may have rendered one tag or a light/dark pair. Pairs keep
  // their media query when following the system; otherwise all get one colour.
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    const media = meta.getAttribute("media");
    const own = id === "system" && media ? (media.includes("light") ? "light" : "dark") : scheme;
    meta.setAttribute("content", SCHEME_COLORS[own]);
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
      <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Theme">
        {THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={theme === t.id}
            onClick={() => choose(t.id)}
            className={cn(
              "flex min-h-11 flex-col gap-0.5 border-2 p-3 text-left transition-colors",
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

function AlertsSection() {
  const { partner } = useChat();
  // Read browser-only values after hydration without an effect.
  const hydrated = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const [sound, setSound] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<ReturnType<typeof notificationPermission> | null>(null);
  const [notifyOn, setNotifyOn] = useState<boolean | null>(null);

  const soundValue = sound ?? (hydrated && isSoundEnabled());
  const permissionValue = permission ?? (hydrated ? notificationPermission() : "default");
  const notifyValue = notifyOn ?? (hydrated && notificationsEnabled());

  const toggleNotifications = async (next: boolean) => {
    if (next && permissionValue !== "granted") {
      const result = await requestNotificationPermission();
      setPermission(result);
      setNotifyOn(result === "granted");
      return;
    }
    setNotificationsMuted(!next);
    setNotifyOn(next);
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
              : `A quiet ping when ${partner.display_name} writes while you're away. No message text is shown.`
        }
        checked={Boolean(notifyValue)}
        disabled={permissionValue === "unsupported" || permissionValue === "denied"}
        onChange={(next) => void toggleNotifications(next)}
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
              await createClient().rpc("touch_last_seen");
              clearSignedUrlCache();
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
