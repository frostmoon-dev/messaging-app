"use client";

import { useState } from "react";
import { useSignedUrl } from "@/lib/hooks/useSignedUrl";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/text";
import { activeStatus } from "@/lib/status";
import type { Profile } from "@/types/app";

const SIZES = { xs: "size-7 text-[11px]", sm: "size-9 text-xs", md: "size-11 text-sm", lg: "size-16 text-lg", xl: "size-28 text-3xl" };

type Props = {
  profile: Pick<Profile, "display_name" | "avatar_url" | "status_emoji" | "status_text" | "status_updated_at">;
  size?: keyof typeof SIZES;
  online?: boolean;
  showStatus?: boolean;
  className?: string;
};

/** Slanted frame avatar. Image comes from the private `avatars` bucket. */
export function Avatar({ profile, size = "md", online, showStatus = false, className }: Props) {
  const { url } = useSignedUrl("avatars", profile.avatar_url);
  const [broken, setBroken] = useState<string | null>(null);
  const showImage = url && broken !== url;
  const status = showStatus ? activeStatus(profile) : null;

  return (
    <span className={cn("relative inline-flex shrink-0", SIZES[size], className)}>
      <span className="shape-tag absolute inset-0 bg-accent" aria-hidden="true" />
      <span className="shape-tag absolute inset-[2px] overflow-hidden bg-panel-strong">
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
          <span className="text-display flex size-full items-center justify-center text-foreground">
            {initials(profile.display_name)}
          </span>
        )}
      </span>
      {online !== undefined && (
        <span
          className={cn(
            "absolute -right-0.5 -bottom-0.5 h-2.5 w-3.5 -skew-x-12 border-2 border-background",
            online ? "bg-accent-strong" : "bg-muted",
          )}
          aria-hidden="true"
        />
      )}
      {status?.emoji && (
        <span
          className="absolute -top-1.5 -right-2 flex size-5 items-center justify-center rounded-full border border-border bg-background text-[11px] leading-none"
          aria-hidden="true"
        >
          {status.emoji}
        </span>
      )}
    </span>
  );
}
