import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : "";
const supabaseWs = supabaseOrigin.replace(/^http/, "ws");

// Pattern from the Next.js "CSP without nonces" guide, narrowed to the one
// backend this app talks to (Supabase REST, Realtime and Storage), plus
// OpenStreetMap tiles for the map screen and GIPHY media (images and video only).
const mapTiles = "https://tile.openstreetmap.org";
// GIFs and stickers from GIPHY (media hosts only; searches go through /api/giphy).
const giphyMedia = "https://*.giphy.com";
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' blob: data: ${supabaseOrigin} ${mapTiles} ${giphyMedia}`,
  // Voice messages play from Supabase Storage (signed links); GIFs from GIPHY.
  `media-src 'self' blob: ${supabaseOrigin} ${giphyMedia}`,
  "font-src 'self'",
  `connect-src 'self' ${supabaseOrigin} ${supabaseWs}`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(supabaseOrigin.startsWith("https:") ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  // Location (map + SOS) and the microphone (voice messages) are allowed for
  // this site only; everything else stays off.
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(self), payment=(), usb=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
