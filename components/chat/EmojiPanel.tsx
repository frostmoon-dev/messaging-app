"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SearchIcon } from "@/components/ui/icons";
import { readPref, writePref } from "@/lib/prefs";
import { cn } from "@/lib/utils";
import type { EmojiGroup } from "@/lib/emoji-data";

const RECENT_KEY = "emoji-recent";
const RECENT_MAX = 24;
// The picture on each category tab.
const TAB_ICONS: Record<string, string> = {
  recent: "🕘",
  smileys: "😀",
  people: "👋",
  nature: "🐻",
  food: "🍓",
  activities: "⚽",
  travel: "✈️",
  objects: "💡",
  symbols: "❤️",
  flags: "🏳️",
};

type Section = { id: string; name: string; emoji: string[] };

function readRecent(): string[] {
  try {
    const list = JSON.parse(readPref(RECENT_KEY) ?? "[]");
    return Array.isArray(list) ? list.filter((e) => typeof e === "string").slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

/** Remembers an emoji as recently used (shared by the panel and reactions). */
export function rememberEmoji(emoji: string) {
  const next = [emoji, ...readRecent().filter((e) => e !== emoji)].slice(0, RECENT_MAX);
  writePref(RECENT_KEY, JSON.stringify(next));
  return next;
}

/**
 * Emoji by category, like the iPhone keyboard: recents first, search on top,
 * category tabs underneath. The list loads only when the panel first opens.
 */
export function EmojiPanel({ onPick, className }: { onPick: (emoji: string) => void; className?: string }) {
  const [groups, setGroups] = useState<EmojiGroup[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>(readRecent);
  const [active, setActive] = useState<string>("recent");
  const scrollRef = useRef<HTMLDivElement>(null);
  const recentTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(recentTimer.current), []);

  useEffect(() => {
    let cancelled = false;
    import("@/lib/emoji-data")
      .then((m) => !cancelled && setGroups(m.EMOJI_GROUPS))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const sections = useMemo<Section[]>(() => {
    if (!groups) return [];
    const all = groups.map((g) => ({ id: g.id, name: g.name, lines: g.items.split("\n") }));
    const q = query.trim().toLowerCase();
    if (q) {
      const hits = all.flatMap((g) => g.lines.filter((line) => line.slice(line.indexOf(" ")).includes(` ${q}`)));
      return [{ id: "search", name: hits.length ? "Results" : "No emoji found", emoji: hits.map((l) => l.split(" ")[0]).slice(0, 160) }];
    }
    const list = all.map((g) => ({ id: g.id, name: g.name, emoji: g.lines.map((l) => l.split(" ")[0]) }));
    return recent.length ? [{ id: "recent", name: "Recently used", emoji: recent }, ...list] : list;
  }, [groups, query, recent]);

  const pick = (emoji: string) => {
    onPick(emoji);
    // Keep the grid still while you tap several: recents update after a pause.
    const next = rememberEmoji(emoji);
    window.clearTimeout(recentTimer.current);
    recentTimer.current = window.setTimeout(() => setRecent(next), 1200);
  };
  const jump = (id: string) => {
    setQuery("");
    setActive(id);
    requestAnimationFrame(() => {
      const target = scrollRef.current?.querySelector<HTMLElement>(`[data-section="${id}"]`);
      if (target && scrollRef.current) scrollRef.current.scrollTo({ top: target.offsetTop - 4 });
    });
  };

  // The tab under the section at the top of the list lights up.
  const onScroll = () => {
    const root = scrollRef.current;
    if (!root || query) return;
    const top = root.scrollTop + 8;
    let current = sections[0]?.id ?? "recent";
    for (const el of root.querySelectorAll<HTMLElement>("[data-section]")) {
      if (el.offsetTop <= top) current = el.dataset.section!;
    }
    if (current !== active) setActive(current);
  };

  const tabs = [...(recent.length ? ["recent"] : []), ...(groups ?? []).map((g) => g.id)];

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="relative px-3 pt-2">
        <SearchIcon size={16} className="pointer-events-none absolute top-1/2 left-6 mt-1 -translate-y-1/2 text-muted" />
        <label htmlFor="emoji-search" className="sr-only">
          Search emoji
        </label>
        <input
          id="emoji-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search emoji"
          autoComplete="off"
          className="h-10 w-full rounded-full border border-field-border bg-background pr-3 pl-9 text-body outline-none placeholder:text-muted focus:border-accent focus-visible:outline-none"
        />
      </div>

      <div ref={scrollRef} onScroll={onScroll} className="scroll-area relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2">
        {!groups && !failed && <p className="p-4 text-center text-small text-muted">Loading emoji…</p>}
        {failed && <p className="p-4 text-center text-small text-danger">Emoji didn&apos;t load. Check your connection.</p>}
        {sections.map((section) => (
          <section key={section.id} data-section={section.id} aria-label={section.name} className="[content-visibility:auto]">
            <h3 className="px-1.5 pt-3 pb-1 text-meta font-bold text-muted-strong uppercase">{section.name}</h3>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(2.625rem,1fr))]">
              {section.emoji.map((emoji, i) => (
                <button
                  key={`${emoji}-${i}`}
                  type="button"
                  // Keep the keyboard (or the caret) where it is.
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => pick(emoji)}
                  className="flex aspect-square items-center justify-center rounded-xl text-[1.75rem] leading-none transition-transform hover:bg-panel-strong active:scale-90"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>

      {groups && (
        <nav className="flex shrink-0 justify-between gap-0.5 border-t border-border px-2 py-1" aria-label="Emoji categories">
          {tabs.map((id) => (
            <button
              key={id}
              type="button"
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => jump(id)}
              className={cn(
                "flex size-9 items-center justify-center rounded-full text-lg transition-opacity",
                active === id && !query ? "bg-panel-strong opacity-100" : "opacity-55 hover:opacity-100",
              )}
              aria-label={id === "recent" ? "Recently used" : groups.find((g) => g.id === id)?.name}
              aria-current={active === id && !query ? "true" : undefined}
            >
              {TAB_ICONS[id]}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
