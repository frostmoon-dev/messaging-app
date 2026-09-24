"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useChat, usePresence } from "@/components/providers/ChatProvider";
import { Avatar } from "@/components/ui/Avatar";
import { StatusPicker } from "@/components/profile/StatusPicker";
import { StatusIcon } from "@/components/ui/StatusIcon";
import { NAV_ITEMS, isActive } from "./nav-items";
import { activeStatus } from "@/lib/status";
import { formatLastSeen } from "@/lib/time";
import { playSound } from "@/lib/sound";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();
  const { me, partner, bond, unreadCount } = useChat();
  const { partnerOnline, partnerLastSeen } = usePresence();
  const [pickerOpen, setPickerOpen] = useState(false);
  const partnerStatus = activeStatus(partner);
  const myStatus = activeStatus(me);

  return (
    <aside className="hidden w-[288px] shrink-0 flex-col gap-6 overflow-y-auto border-r border-border bg-background-raised p-4 lg:flex">
      <section aria-label={`${partner.display_name}'s profile`} className="card bg-background p-4">
        <div className="flex items-center gap-3">
          <Avatar profile={partner} size="lg" online={partnerOnline} />
          <div className="min-w-0">
            <p className="truncate text-title font-bold">{partner.display_name}</p>
            <p className={cn("text-small", partnerOnline ? "text-online" : "text-muted")}>
              {partnerOnline ? "Online" : formatLastSeen(partnerLastSeen)}
            </p>
          </div>
        </div>
        {partnerStatus && (
          <p className="mt-3 flex items-center gap-2 text-small text-muted-strong">
            {partnerStatus.icon && <StatusIcon icon={partnerStatus.icon} />}
            {partnerStatus.text}
          </p>
        )}
      </section>

      <nav aria-label="Main">
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map(({ href, label, Icon }) => {
            const active = isActive(pathname, href);
            const badge = href === "/chat" && !active ? unreadCount : 0;
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => playSound("navigate")}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-12 items-center gap-3 rounded-full px-4 text-body transition-colors",
                    active ? "nav-current font-bold" : "text-muted-strong hover:bg-panel-strong hover:text-foreground",
                  )}
                >
                  <Icon size={20} />
                  <span>{label}</span>
                  {badge > 0 && (
                    <span className="ml-auto min-w-6 rounded-full bg-accent px-2 text-center font-mono text-meta leading-6 font-bold text-accent-foreground">
                      {badge > 99 ? "99+" : badge}
                      <span className="sr-only"> unread</span>
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {bond && (
        <Link
          href="/bond"
          className="card block bg-background p-4 transition-colors hover:bg-panel-strong"
          aria-label={`Bond rank ${bond.level}, ${bond.title}, ${bond.progress}% to the next rank`}
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-small text-muted-strong">Bond rank</span>
            <span className="font-mono text-title font-bold">{bond.level}</span>
          </div>
          <p className="truncate text-small font-semibold">{bond.title}</p>
          <div className="mt-2 h-2 overflow-hidden bg-panel-strong">
            <div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${bond.progress}%` }} />
          </div>
        </Link>
      )}

      <div className="mt-auto flex items-center gap-3 border-t border-border px-1 pt-4">
        <Avatar profile={me} size="sm" showStatus />
        <div className="min-w-0 flex-1">
          <p className="truncate text-small font-semibold">{me.display_name}</p>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="flex min-h-6 max-w-full items-center gap-1.5 text-left text-meta text-muted-strong underline-offset-2 hover:text-foreground hover:underline"
          >
            {myStatus?.icon && <StatusIcon icon={myStatus.icon} className="size-4" />}
            <span className="truncate">{myStatus ? myStatus.text : "Set a status"}</span>
          </button>
        </div>
      </div>
      {pickerOpen && <StatusPicker onClose={() => setPickerOpen(false)} />}
    </aside>
  );
}
