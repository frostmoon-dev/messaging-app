import { createClient } from "@/lib/supabase/server";
import { normalizeGif, type GiphyKind, type GiphyPage } from "@/lib/giphy";

// Searches GIPHY for the picker. The key stays on the server, only signed-in
// people can use it, and repeated searches are answered from a short cache so
// two people stay well inside a free (beta) key's hourly limit.
const PAGE = 24;
const TTL_MS = 10 * 60_000;
const cache = new Map<string, { at: number; page: GiphyPage }>();

export async function GET(request: Request) {
  const key = process.env.GIPHY_API_KEY;
  if (!key) return Response.json({ error: "not_configured" }, { status: 503 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "signed_out" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const kind: GiphyKind = params.get("kind") === "stickers" ? "stickers" : "gifs";
  const q = (params.get("q") ?? "").trim().slice(0, 50);
  const offset = Math.min(Math.max(Number(params.get("offset")) || 0, 0), 480);

  const cacheKey = `${kind}|${q.toLowerCase()}|${offset}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL_MS) return Response.json(hit.page);

  const url = new URL(`https://api.giphy.com/v1/${kind}/${q ? "search" : "trending"}`);
  url.search = new URLSearchParams({
    api_key: key,
    limit: String(PAGE),
    offset: String(offset),
    rating: "pg-13",
    ...(q ? { q, lang: "en" } : {}),
  }).toString();

  let body: { data?: unknown[]; pagination?: { total_count?: number; count?: number; offset?: number } };
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!res.ok) return Response.json({ error: res.status === 429 ? "rate_limited" : "upstream" }, { status: 502 });
    body = await res.json();
  } catch {
    return Response.json({ error: "upstream" }, { status: 502 });
  }

  const items = (body.data ?? []).flatMap((raw) => normalizeGif(raw as Parameters<typeof normalizeGif>[0], kind) ?? []);
  const seen = offset + (body.pagination?.count ?? items.length);
  const total = body.pagination?.total_count ?? seen;
  const page: GiphyPage = { items, next: seen < total && seen < 500 ? seen : null };

  if (cache.size > 200) cache.clear();
  cache.set(cacheKey, { at: Date.now(), page });
  return Response.json(page, { headers: { "Cache-Control": "private, max-age=300" } });
}
