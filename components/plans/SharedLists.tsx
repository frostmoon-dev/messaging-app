"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat, useLiveTable } from "@/components/providers/ChatProvider";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, CloseIcon, PlusIcon } from "@/components/ui/icons";
import { fieldClass } from "@/components/ui/field";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/errors";
import { haptic } from "@/lib/haptics";
import { cn, uuid } from "@/lib/utils";
import type { ListItemRow, ListRow } from "@/types/app";

// Suggested first lists (plain names; you can also type your own).
const SUGGESTIONS = ["Groceries", "To-do", "Bucket list", "Date ideas"];

const byCreated = <T extends { created_at: string }>(a: T, b: T) => a.created_at.localeCompare(b.created_at);

/**
 * Shared lists (Plans → Lists): groceries, to-dos, a bucket list. Either of
 * you can add, tick or remove anything, and it changes live on both phones.
 */
export function SharedLists() {
  const { conversationId, me, partner } = useChat();
  const [lists, setLists] = useState<ListRow[] | null>(null);
  const [items, setItems] = useState<ListItemRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const supabase = createClient();
    const [l, i] = await Promise.all([
      supabase.from("lists").select("*").eq("conversation_id", conversationId).order("created_at"),
      supabase.from("list_items").select("*").eq("conversation_id", conversationId).order("created_at").limit(5000),
    ]);
    if (l.error || i.error) {
      setError(friendlyError(l.error ?? i.error, "load"));
      return;
    }
    setLists(l.data);
    setItems(i.data);
  }, [conversationId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount
    void load();
  }, [load]);

  // Live from the other phone (and echoes of our own writes, merged by id).
  useLiveTable("lists", (change) => {
    const row = change.row as ListRow;
    setLists((prev) => {
      if (!prev) return prev;
      const rest = prev.filter((l) => l.id !== row.id);
      return change.type === "DELETE" ? rest : [...rest, row].sort(byCreated);
    });
    if (change.type === "DELETE") setItems((prev) => prev.filter((i) => i.list_id !== row.id));
  });
  useLiveTable("list_items", (change) => {
    const row = change.row as ListItemRow;
    setItems((prev) => {
      const rest = prev.filter((i) => i.id !== row.id);
      return change.type === "DELETE" ? rest : [...rest, row].sort(byCreated);
    });
  });

  const open = lists?.find((l) => l.id === openId) ?? null;
  const who = (id: string | null) => (id === me.id ? "You" : id === partner.id ? partner.display_name : "");

  // Every write shows at once and is undone if the server says no.
  const run = async (apply: () => void, undo: () => void, write: () => PromiseLike<{ error: unknown }>) => {
    setError(null);
    apply();
    const { error: err } = await write();
    if (err) {
      undo();
      setError(friendlyError(err, "save"));
    }
  };

  const createList = (title: string) => {
    const row: ListRow = {
      id: uuid(),
      conversation_id: conversationId,
      title: title.trim().slice(0, 40),
      emoji: null,
      created_by: me.id,
      created_at: new Date().toISOString(),
    };
    if (!row.title) return;
    void run(
      () => {
        setLists((prev) => [...(prev ?? []), row]);
        setOpenId(row.id);
      },
      () => {
        setLists((prev) => prev?.filter((l) => l.id !== row.id) ?? null);
        setOpenId(null);
      },
      () => createClient().from("lists").insert({ id: row.id, conversation_id: row.conversation_id, title: row.title }),
    );
  };

  const deleteList = (list: ListRow) => {
    const kept = items.filter((i) => i.list_id === list.id);
    void run(
      () => {
        setLists((prev) => prev?.filter((l) => l.id !== list.id) ?? null);
        setItems((prev) => prev.filter((i) => i.list_id !== list.id));
        setOpenId(null);
      },
      () => {
        setLists((prev) => [...(prev ?? []), list].sort(byCreated));
        setItems((prev) => [...prev, ...kept].sort(byCreated));
      },
      () => createClient().from("lists").delete().eq("id", list.id),
    );
  };

  const addItem = (listId: string, text: string) => {
    const row: ListItemRow = {
      id: uuid(),
      list_id: listId,
      conversation_id: conversationId,
      text: text.trim().slice(0, 200),
      done_at: null,
      done_by: null,
      created_by: me.id,
      created_at: new Date().toISOString(),
    };
    if (!row.text) return;
    void run(
      () => setItems((prev) => [...prev, row]),
      () => setItems((prev) => prev.filter((i) => i.id !== row.id)),
      () => createClient().from("list_items").insert({ id: row.id, list_id: listId, text: row.text }),
    );
  };

  const toggleItem = (item: ListItemRow) => {
    const done = !item.done_at;
    haptic(done ? "send" : "press");
    const next = { ...item, done_at: done ? new Date().toISOString() : null, done_by: done ? me.id : null };
    void run(
      () => setItems((prev) => prev.map((i) => (i.id === item.id ? next : i))),
      () => setItems((prev) => prev.map((i) => (i.id === item.id ? item : i))),
      () => createClient().from("list_items").update({ done_at: next.done_at }).eq("id", item.id),
    );
  };

  const removeItems = (gone: ListItemRow[]) => {
    const ids = new Set(gone.map((i) => i.id));
    void run(
      () => setItems((prev) => prev.filter((i) => !ids.has(i.id))),
      () => setItems((prev) => [...prev, ...gone].sort(byCreated)),
      () => createClient().from("list_items").delete().in("id", [...ids]),
    );
  };

  if (lists === null && !error) {
    return (
      <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading lists">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-[18px]" />
        ))}
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="card flex items-center justify-between gap-3 bg-panel p-4" role="alert">
          <span className="text-small text-muted-strong">{error}</span>
          <Button variant="secondary" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      )}

      {open ? (
        <ListDetail
          list={open}
          items={items.filter((i) => i.list_id === open.id)}
          who={who}
          onBack={() => setOpenId(null)}
          onAdd={(text) => addItem(open.id, text)}
          onToggle={toggleItem}
          onRemove={(item) => removeItems([item])}
          onClearDone={(done) => removeItems(done)}
          onDelete={() => deleteList(open)}
        />
      ) : (
        <ListOverview lists={lists ?? []} items={items} onOpen={setOpenId} onCreate={createList} />
      )}
    </>
  );
}

function ListOverview({
  lists,
  items,
  onOpen,
  onCreate,
}: {
  lists: ListRow[];
  items: ListItemRow[];
  onOpen: (id: string) => void;
  onCreate: (title: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const counts = useMemo(() => {
    const map = new Map<string, { left: number; total: number }>();
    for (const i of items) {
      const c = map.get(i.list_id) ?? { left: 0, total: 0 };
      c.total++;
      if (!i.done_at) c.left++;
      map.set(i.list_id, c);
    }
    return map;
  }, [items]);
  const taken = new Set(lists.map((l) => l.title.toLowerCase()));
  const suggestions = SUGGESTIONS.filter((t) => !taken.has(t.toLowerCase()));

  const create = (title: string) => {
    onCreate(title);
    setName("");
    setAdding(false);
  };

  return (
    <section aria-label="Lists" className="flex flex-col gap-4">
      <div className="card overflow-hidden bg-panel">
        {lists.length === 0 && !adding && <p className="px-4 pt-4 pb-1 text-small text-muted-strong">No lists yet.</p>}
        <ul className="divide-y divide-border">
          {lists.map((l) => {
            const c = counts.get(l.id) ?? { left: 0, total: 0 };
            return (
              <li key={l.id}>
                <button
                  type="button"
                  onClick={() => onOpen(l.id)}
                  className="flex min-h-14 w-full items-center gap-3 px-4 text-left transition-colors hover:bg-panel-strong"
                >
                  <span className="min-w-0 flex-1 truncate font-semibold">{l.title}</span>
                  <span className="shrink-0 text-small text-muted">{c.total === 0 ? "Empty" : c.left === 0 ? "All done" : `${c.left} left`}</span>
                  <ChevronRightIcon size={18} className="shrink-0 text-muted" />
                </button>
              </li>
            );
          })}
          <li>
            {adding ? (
              <form
                className="flex items-center gap-2 p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  create(name);
                }}
              >
                <label htmlFor="new-list" className="sr-only">
                  List name
                </label>
                <input
                  id="new-list"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={40}
                  placeholder="List name"
                  className={fieldClass}
                  autoComplete="off"
                  autoFocus
                />
                <Button type="submit" disabled={!name.trim()}>
                  Create
                </Button>
                <button
                  type="button"
                  onClick={() => setAdding(false)}
                  className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-strong hover:bg-panel-strong"
                  aria-label="Cancel"
                >
                  <CloseIcon size={16} />
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="flex min-h-14 w-full items-center gap-3 px-4 text-left font-semibold text-accent-text transition-colors hover:bg-panel-strong"
              >
                <PlusIcon size={18} /> New list
              </button>
            )}
          </li>
        </ul>
      </div>

      {suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-small text-muted-strong">Suggestions:</span>
          {suggestions.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => create(t)}
              className="pill min-h-10 border border-border px-3.5 text-small font-semibold text-muted-strong hover:bg-panel-strong hover:text-foreground"
            >
              {t}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function ListDetail({
  list,
  items,
  who,
  onBack,
  onAdd,
  onToggle,
  onRemove,
  onClearDone,
  onDelete,
}: {
  list: ListRow;
  items: ListItemRow[];
  who: (id: string | null) => string;
  onBack: () => void;
  onAdd: (text: string) => void;
  onToggle: (item: ListItemRow) => void;
  onRemove: (item: ListItemRow) => void;
  onClearDone: (done: ListItemRow[]) => void;
  onDelete: () => void;
}) {
  const [text, setText] = useState("");
  const [confirming, setConfirming] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const todo = items.filter((i) => !i.done_at);
  const done = items.filter((i) => i.done_at).sort((a, b) => (b.done_at ?? "").localeCompare(a.done_at ?? ""));

  return (
    <section aria-labelledby="list-title" className="flex flex-col gap-4">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onBack}
          className="-ml-2.5 flex size-11 items-center justify-center rounded-full hover:bg-panel-strong"
          aria-label="All lists"
        >
          <ChevronLeftIcon size={22} />
        </button>
        <h2 id="list-title" className="min-w-0 flex-1 truncate text-title font-bold">
          {list.title}
        </h2>
      </div>

      {/* Stays open after each item, for quick lists like groceries. */}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onAdd(text);
          setText("");
          inputRef.current?.focus();
        }}
      >
        <label htmlFor="new-item" className="sr-only">
          Add to {list.title}
        </label>
        <input
          ref={inputRef}
          id="new-item"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={200}
          placeholder="Add an item"
          className={fieldClass}
          autoComplete="off"
          enterKeyHint="done"
        />
        <Button type="submit" disabled={!text.trim()} aria-label="Add item">
          <PlusIcon size={18} />
        </Button>
      </form>

      {items.length === 0 ? (
        <p className="text-small text-muted-strong">Nothing on this list yet.</p>
      ) : (
        todo.length > 0 && (
          <ul className="card divide-y divide-border overflow-hidden bg-panel">
            {todo.map((item) => (
              <Item key={item.id} item={item} who={who} onToggle={onToggle} onRemove={onRemove} />
            ))}
          </ul>
        )
      )}

      {done.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h3 className="text-small font-semibold text-muted-strong">Done ({done.length})</h3>
            <button type="button" onClick={() => onClearDone(done)} className="min-h-11 px-2 text-small font-semibold text-muted-strong hover:text-foreground">
              Clear
            </button>
          </div>
          <ul className="card divide-y divide-border overflow-hidden bg-panel">
            {done.map((item) => (
              <Item key={item.id} item={item} who={who} onToggle={onToggle} onRemove={onRemove} />
            ))}
          </ul>
        </div>
      )}

      <div className="pt-2">
        {confirming ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-small">Delete this list for both of you?</span>
            <Button variant="danger" onClick={onDelete}>
              Delete
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} className="min-h-11 text-small font-semibold text-danger">
            Delete list
          </button>
        )}
      </div>
    </section>
  );
}

function Item({
  item,
  who,
  onToggle,
  onRemove,
}: {
  item: ListItemRow;
  who: (id: string | null) => string;
  onToggle: (item: ListItemRow) => void;
  onRemove: (item: ListItemRow) => void;
}) {
  const done = Boolean(item.done_at);
  return (
    <li className="flex items-center">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        onClick={() => onToggle(item)}
        className="flex min-h-12 min-w-0 flex-1 items-center gap-3 py-2.5 pl-4 text-left"
      >
        <span
          className={cn(
            "flex size-[22px] shrink-0 items-center justify-center rounded-full border-2 transition-colors",
            done ? "border-love bg-love text-love-foreground" : "border-field-border",
          )}
          aria-hidden="true"
        >
          {done && <CheckIcon size={13} strokeWidth={3} />}
        </span>
        <span className="min-w-0">
          <span className={cn("block break-words", done && "text-muted line-through")}>{item.text}</span>
          {done && item.done_by && <span className="block text-meta text-muted">Ticked by {who(item.done_by)}</span>}
        </span>
      </button>
      <button
        type="button"
        onClick={() => onRemove(item)}
        className="mr-1 flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-panel-strong hover:text-foreground"
        aria-label={`Remove ${item.text}`}
      >
        <CloseIcon size={14} />
      </button>
    </li>
  );
}
