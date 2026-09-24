"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { useChat, usePresence } from "@/components/providers/ChatProvider";
import { Avatar } from "@/components/ui/Avatar";
import { StatusPicker } from "@/components/profile/StatusPicker";
import { NAV_ITEMS, isActive } from "./nav-items";
import { activeStatus } from "@/lib/status";
import { formatLastSeen } from "@/lib/time";
import { toRoman } from "@/lib/roman";
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
    <aside className="hidden w-[300px] shrink-0 flex-col gap-6 overflow-y-auto border-r border-border bg-background-raised/80 p-5 lg:flex">
      <section
        aria-label={`${partner.display_name}'s profile`}
        className="cut-corners relative bg-panel p-4"
      >
        <span className="halftone absolute top-0 right-0 h-16 w-24 opacity-25" aria-hidden="true" />
        <div className="relative flex items-center gap-3">
          <Avatar profile={partner} size="lg" online={partnerOnline} />
          <div className="min-w-0">
            <p className="text-display truncate text-2xl">{partner.display_name}</p>
            <p className={cn("text-display text-[11px] tracking-[0.2em]", partnerOnline ? "text-accent-strong" : "text-muted")}>
              {partnerOnline ? "Online" : formatLastSeen(partnerLastSeen)}
            </p>
          </div>
        </div>
        {partnerStatus && (
          <p className="relative mt-3 text-sm text-muted-strong">
            <span aria-hidden="true">{partnerStatus.emoji}</span> {partnerStatus.text}
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
                    "group relative flex min-h-12 items-center gap-3 px-4 transition-colors",
                    active ? "text-accent-foreground" : "text-muted-strong hover:text-foreground",
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="sidebar-active"
                      className="shape-slant absolute inset-0 bg-accent"
                      transition={{ duration: 0.22, ease: [0.2, 0.9, 0.1, 1] }}
                      aria-hidden="true"
                    />
                  )}
                  <Icon size={20} className="relative" />
                  <span className="text-display relative text-xl tracking-wider transition-transform group-hover:translate-x-1">
                    {label}
                  </span>
                  {badge > 0 && (
                    <span className="relative ml-auto bg-accent px-1.5 text-xs font-bold text-accent-foreground">
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
        <Link href="/bond" className="group block" aria-label={`Bond level ${bond.level}`}>
          <p className="text-display text-[11px] tracking-[0.3em] text-muted">Bond</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-display text-sm tracking-widest text-muted-strong">Lv.</span>
            <span className="text-display text-3xl text-accent-strong">{toRoman(bond.level)}</span>
            <span className="truncate text-xs text-muted-strong">{bond.title}</span>
          </div>
          <div className="mt-2 h-2 -skew-x-12 bg-panel-strong">
            <div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${bond.progress}%` }} />
          </div>
        </Link>
      )}

      <div className="mt-auto flex items-center gap-3 border-t border-border pt-4">
        <Avatar profile={me} size="sm" showStatus />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{me.display_name}</p>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="block max-w-full truncate text-left text-xs text-muted hover:text-foreground"
          >
            {myStatus ? `${myStatus.emoji} ${myStatus.text}` : "Set a status"}
          </button>
        </div>
      </div>
      {pickerOpen && <StatusPicker onClose={() => setPickerOpen(false)} />}
    </aside>
  );
}
