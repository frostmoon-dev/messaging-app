"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useChat } from "@/components/providers/ChatProvider";
import { NAV_ITEMS, isActive } from "./nav-items";
import { playSound } from "@/lib/sound";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const pathname = usePathname();
  const { unreadCount } = useChat();

  return (
    <nav
      aria-label="Main"
      className="bottom-nav relative z-20 shrink-0 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="grid grid-cols-4">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);
          const badge = href === "/chat" && !active && unreadCount > 0 ? unreadCount : 0;
          return (
            <li key={href}>
              <Link
                href={href}
                onClick={() => playSound("navigate")}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-14 flex-col items-center justify-center gap-0.5 transition-colors",
                  active ? "text-accent-foreground" : "text-muted hover:text-foreground",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="bottom-nav-active"
                    className="shape-slant absolute inset-x-2 inset-y-1.5 bg-accent"
                    transition={{ duration: 0.22, ease: [0.2, 0.9, 0.1, 1] }}
                    aria-hidden="true"
                  />
                )}
                <Icon size={20} className="relative" />
                <span className="text-display relative text-[10px] tracking-[0.18em]">{label}</span>
                {badge > 0 && (
                  <span className="absolute top-1.5 right-[22%] min-w-5 bg-accent px-1 text-center text-[10px] font-bold text-accent-foreground">
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
  );
}
