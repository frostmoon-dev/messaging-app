"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useChat, usePresence } from "@/components/providers/ChatProvider";
import { Avatar } from "@/components/ui/Avatar";
import { StatusPicker } from "@/components/profile/StatusPicker";
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
    <aside className="hidden w-72 shrink-0 flex-col gap-6 overflow-y-auto border-r border-border bg-background-raised p-4 lg:flex">
      <section aria-label={`${partner.display_name}'s profile`} className="flex items-center gap-3 px-2 pt-2">
        <Avatar profile={partner} size="lg" online={partnerOnline} />
        <div className="min-w-0">
          <p className="truncate text-title font-bold">{partner.display_name}</p>
          <p className={cn("text-small", partnerOnline ? "text-online" : "text-muted")}>
            {partnerOnline ? "Online" : formatLastSeen(partnerLastSeen)}
          </p>
          {partnerStatus && (
            <p className="truncate text-small text-muted-strong">
              <span aria-hidden="true">{partnerStatus.emoji}</span> {partnerStatus.text}
            </p>
          )}
        </div>
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
                    "flex min-h-11 items-center gap-3 rounded-control px-3 transition-colors",
                    active ? "bg-accent-soft font-bold text-foreground" : "text-muted-strong hover:bg-panel-strong hover:text-foreground",
                  )}
                >
                  <Icon size={20} className={active ? "text-accent-strong" : undefined} />
                  <span>{label}</span>
                  {badge > 0 && (
                    <span className="ml-auto min-w-6 rounded-full bg-accent px-2 text-center text-meta leading-6 font-bold text-accent-foreground">
                      {badge}
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
          className="block rounded-card border border-border p-3 transition-colors hover:bg-panel-strong"
          aria-label={`Bond level ${bond.level}, ${bond.title}, ${bond.progress}% to the next level`}
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-small text-muted">Bond level</span>
            <span className="font-mono text-title font-bold">{bond.level}</span>
          </div>
          <p className="truncate text-small font-semibold">{bond.title}</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-panel-strong">
            <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${bond.progress}%` }} />
          </div>
        </Link>
      )}

      <div className="mt-auto flex items-center gap-3 border-t border-border px-2 pt-4">
        <Avatar profile={me} size="sm" showStatus />
        <div className="min-w-0 flex-1">
          <p className="truncate text-small font-semibold">{me.display_name}</p>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="block max-w-full truncate text-left text-meta text-muted underline-offset-2 hover:text-foreground hover:underline"
          >
            {myStatus ? `${myStatus.emoji} ${myStatus.text}` : "Set a status"}
          </button>
        </div>
      </div>
      {pickerOpen && <StatusPicker onClose={() => setPickerOpen(false)} />}
    </aside>
  );
}
