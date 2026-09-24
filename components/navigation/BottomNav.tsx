"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
      className="bottom-nav relative z-20 shrink-0 border-t border-border bg-background-raised pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="grid grid-cols-5">
        {NAV_ITEMS.filter((item) => item.phone).map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);
          const badge = href === "/chat" && !active && unreadCount > 0 ? unreadCount : 0;
          return (
            <li key={href}>
              <Link
                href={href}
                onClick={() => playSound("navigate")}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-16 flex-col items-center justify-center gap-1 px-0.5 transition-colors",
                  active ? "text-foreground" : "text-muted-strong hover:text-foreground",
                )}
              >
                {/* Selected tab: a soft pill behind the icon. */}
                <span className={cn("flex h-8 w-14 items-center justify-center", active && "nav-current")}>
                  <Icon size={22} />
                </span>
                <span className={cn("text-meta", active && "font-bold")}>{label}</span>
                {badge > 0 && (
                  <span className="absolute top-1.5 left-1/2 ml-2 min-w-5 rounded-full bg-accent px-1.5 text-center font-mono text-meta leading-5 font-bold text-accent-foreground">
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
