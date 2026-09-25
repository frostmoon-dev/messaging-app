// Opening chat links in their own app (YouTube, Spotify, Instagram…) instead
// of the in-app browser. Only needed on iPhone when Napyru runs from the Home
// Screen: iOS doesn't hand a home-screen web app's links to other apps.

export type AppLink = {
  /** Shown if the app doesn't open, e.g. "Couldn't open YouTube". */
  app: string;
  /** What to open instead of the web page. */
  url: string;
};

const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com"]);
const YOUTUBE_ID = /^[\w-]{11}$/;
const SPOTIFY_TYPES = new Set(["track", "album", "artist", "playlist", "show", "episode"]);

/**
 * Apps that take over their links once the link is in real Safari. We send
 * the link there with `x-safari-https:` (iOS 17 and later).
 */
const SAFARI_HANDOFF: Array<[app: string, hosts: string[]]> = [
  ["Instagram", ["instagram.com"]],
  ["TikTok", ["tiktok.com"]],
  ["X", ["x.com", "twitter.com"]],
  ["Facebook", ["facebook.com", "fb.watch"]],
  ["Threads", ["threads.net", "threads.com"]],
  ["Pinterest", ["pinterest.com", "pin.it"]],
  ["Reddit", ["reddit.com"]],
  ["Spotify", ["spotify.link"]],
  ["Google Maps", ["maps.app.goo.gl", "maps.google.com"]],
];

function matchesHost(host: string, domain: string) {
  return host === domain || host.endsWith(`.${domain}`);
}

function youtubeId(url: URL) {
  let id: string | null = null;
  if (url.hostname === "youtu.be") id = url.pathname.split("/")[1] ?? null;
  else if (YOUTUBE_HOSTS.has(url.hostname)) {
    const [, first, second] = url.pathname.split("/");
    if (first === "watch") id = url.searchParams.get("v");
    else if (first === "shorts" || first === "live" || first === "embed") id = second ?? null;
  }
  return id && YOUTUBE_ID.test(id) ? id : null;
}

function spotifyPath(url: URL) {
  if (url.hostname !== "open.spotify.com") return null;
  // "/intl-en/track/ID" or "/track/ID"
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0]?.startsWith("intl-")) parts.shift();
  const [type, id] = parts;
  return type && SPOTIFY_TYPES.has(type) && id && /^[A-Za-z0-9]+$/.test(id) ? `${type}/${id}` : null;
}

/** The app version of a web link, or null to open it as a normal web page. */
export function appLinkFor(href: string): AppLink | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase();

  const video = youtubeId(url);
  if (video) return { app: "YouTube", url: `vnd.youtube://${video}` };

  const spotify = spotifyPath(url);
  if (spotify) return { app: "Spotify", url: `spotify://${spotify}` };

  if (host === "www.google.com" && url.pathname.startsWith("/maps")) {
    return { app: "Google Maps", url: `x-safari-https://${url.host}${url.pathname}${url.search}${url.hash}` };
  }
  for (const [app, hosts] of SAFARI_HANDOFF) {
    if (hosts.some((domain) => matchesHost(host, domain))) {
      return { app, url: `x-safari-https://${url.host}${url.pathname}${url.search}${url.hash}` };
    }
  }
  return null;
}

/** True when running from the iPhone/iPad Home Screen. */
export function isIOSHomeScreenApp() {
  if (typeof navigator === "undefined") return false;
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export const LINK_FALLBACK_EVENT = "napyru:link-fallback";
export type LinkFallbackDetail = { app: string; href: string };

/**
 * Tries the app. If Napyru is still on screen shortly after (the app isn't
 * installed, or the phone refused), asks the chat to offer the web page.
 */
export function openInApp(link: AppLink, href: string) {
  let left = false;
  const onHide = () => {
    if (document.visibilityState === "hidden") left = true;
  };
  const onPageHide = () => {
    left = true;
  };
  document.addEventListener("visibilitychange", onHide);
  window.addEventListener("pagehide", onPageHide);
  window.location.href = link.url;
  window.setTimeout(() => {
    document.removeEventListener("visibilitychange", onHide);
    window.removeEventListener("pagehide", onPageHide);
    if (left || document.visibilityState === "hidden") return;
    window.dispatchEvent(new CustomEvent<LinkFallbackDetail>(LINK_FALLBACK_EVENT, { detail: { app: link.app, href } }));
  }, 1600);
}
