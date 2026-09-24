"use client";

import { useState } from "react";
import { useSignedUrl } from "@/lib/hooks/useSignedUrl";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/text";
import { activeStatus } from "@/lib/status";
import type { Profile } from "@/types/app";

const SIZES = {
  xs: "size-7 text-meta",
  sm: "size-9 text-meta",
  md: "size-11 text-small",
  lg: "size-16 text-title",
  xl: "size-24 text-heading",
};

type Props = {
  profile: Pick<Profile, "display_name" | "avatar_url" | "status_emoji" | "status_text" | "status_updated_at">;
  size?: keyof typeof SIZES;
  online?: boolean;
  showStatus?: boolean;
  className?: string;
};

/** Round avatar. Image comes from the private `avatars` bucket. */
export function Avatar({ profile, size = "md", online, showStatus = false, className }: Props) {
  const { url } = useSignedUrl("avatars", profile.avatar_url);
  const [broken, setBroken] = useState<string | null>(null);
  const showImage = url && broken !== url;
  const status = showStatus ? activeStatus(profile) : null;

  return (
    <span className={cn("relative inline-flex shrink-0", SIZES[size], className)}>
      <span className="flex size-full items-center justify-center overflow-hidden rounded-full bg-panel-strong font-bold text-muted-strong">
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from a private bucket
          <img
            src={url}
            alt=""
            className="size-full object-cover"
            onError={() => setBroken(url)}
            draggable={false}
          />
        ) : (
          initials(profile.display_name)
        )}
      </span>
      {online && (
        <span
          className="absolute right-0 bottom-0 size-[28%] min-h-2.5 min-w-2.5 rounded-full border-2 border-background bg-online"
          aria-hidden="true"
        />
      )}
      {status?.emoji && (
        <span
          className="absolute -top-1 -right-1.5 flex size-5 items-center justify-center rounded-full border border-border bg-background text-[12px] leading-none"
          aria-hidden="true"
        >
          {status.emoji}
        </span>
      )}
    </span>
  );
}
