#!/usr/bin/env node
// Renders the Napyru mark to every icon size PWAs, iOS and notifications need.
// Run: node scripts/generate-icons.mjs  (npm run icons)
//
// The mark: one disc split by a single curve. The left part is a crescent
// moon, the right part is the sun, with rays only on the sun's open side.
// Flat colours, no gradients. Night blue + cream + warm gold is a
// complementary pair (blue / orange) with a neutral in between.
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";

const NIGHT = "#1c2140";
const MOON = "#f1e7cc";
const SUN = "#f0a93b";

function rays(cx, cy, r0, r1, angles, halfWidth) {
  return angles
    .map((deg) => {
      const a = (deg * Math.PI) / 180;
      const p = (rad, off) => `${(cx + rad * Math.cos(a + off)).toFixed(1)} ${(cy + rad * Math.sin(a + off)).toFixed(1)}`;
      return `M${p(r0, -halfWidth)}L${p(r1, 0)}L${p(r0, halfWidth)}Z`;
    })
    .join("");
}

// Disc (256,256,r120) split by the circle (300,256,r100); they meet at
// (328,160) and (328,352). Shifted left 16px so the rays don't pull the
// mark off-centre.
const RAYS = rays(256, 256, 136, 170, [-60, -30, 0, 30, 60], 0.1);
const CRESCENT = "M328 160A120 120 0 1 0 328 352A100 100 0 1 1 328 160Z";
const DIVIDER = "M328 352A100 100 0 1 1 328 160";

const mark = (colors) => `
  <g transform="translate(-16 0)">
    <clipPath id="disc"><circle cx="256" cy="256" r="120"/></clipPath>
    <circle cx="256" cy="256" r="120" fill="${colors.sun}"/>
    <path fill="${colors.moon}" d="${CRESCENT}"/>
    <path fill="none" stroke="${colors.gap}" stroke-width="10" clip-path="url(#disc)" d="${DIVIDER}"/>
    <path fill="${colors.sun}" d="${RAYS}"/>
  </g>`;

const full = { moon: MOON, sun: SUN, gap: NIGHT };

const icon = (padding = 0) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${NIGHT}"/>
  <g transform="translate(${padding} ${padding}) scale(${(512 - padding * 2) / 512})">${mark(full)}</g>
</svg>`;

// Notification badge (Android): one colour on transparent; the OS tints it.
// The divider is cut out so the two halves still read at 24px.
const badge = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <mask id="cut"><rect width="512" height="512" fill="#000"/>${mark({ moon: "#fff", sun: "#fff", gap: "#000" }).replace(/stroke-width="10"/, 'stroke-width="18"')}</mask>
  <rect width="512" height="512" fill="#fff" mask="url(#cut)"/>
</svg>`;

await mkdir("public/icons", { recursive: true });
const render = (svg, size, out) => sharp(Buffer.from(svg)).resize(size, size).png().toFile(out);

await render(icon(), 192, "public/icons/icon-192.png");
await render(icon(), 512, "public/icons/icon-512.png");
// Maskable icons get cropped to a circle; keep the mark inside the safe zone.
await render(icon(56), 512, "public/icons/maskable-512.png");
await render(icon(), 180, "app/apple-icon.png");
await render(badge, 96, "public/icons/badge-96.png");
await writeFile("app/icon.svg", icon().trim() + "\n");
await writeFile("public/brand-mark.svg", icon().trim() + "\n");
console.log("icons written");
