"use client";

import { useState } from "react";
import { useSignedUrl } from "@/lib/hooks/useSignedUrl";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/text";
import { activeStatus } from "@/lib/status";
import { StatusIcon } from "./StatusIcon";
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

/**
 * Round portrait with a thin ring. Image comes from the private `avatars` bucket.
 */
export function Avatar({ profile, size = "md", online, showStatus = false, className }: Props) {
  const { url } = useSignedUrl("avatars", profile.avatar_url);
  const [broken, setBroken] = useState<string | null>(null);
  const showImage = url && broken !== url;
  const status = showStatus ? activeStatus(profile) : null;

  return (
    <span className={cn("relative inline-flex shrink-0", SIZES[size], className)}>
      <span className="portrait flex size-full bg-frame p-[1.5px]">
        <span className="portrait flex size-full items-center justify-center overflow-hidden bg-panel-strong font-bold text-foreground">
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
      </span>
      {online && (
        <span
          className="absolute -right-0.5 -bottom-0.5 size-[30%] min-h-3 min-w-3 rounded-full border-2 border-background bg-online"
          aria-hidden="true"
        />
      )}
      {status?.icon && (
        <span
          className="absolute -top-1 -right-1.5 flex size-[42%] min-h-4 min-w-4 items-center justify-center rounded-full border-2 border-background bg-incoming"
          aria-hidden="true"
        >
          <StatusIcon icon={status.icon} className="size-[70%]" />
        </span>
      )}
    </span>
  );
}
