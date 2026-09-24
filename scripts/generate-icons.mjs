#!/usr/bin/env node
// Renders the app icon SVG to the PNG sizes PWAs and iOS need.
// Run: node scripts/generate-icons.mjs
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";

const RED = "#e5102b";
const WHITE = "#ffffff";

// Mark: a red field with a white "H" drawn as two uprights and a crossbar
// (two people and the line between them). The OS adds its own corner mask.
const icon = (padding = 0) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${RED}"/>
  <g transform="translate(${padding} ${padding}) scale(${(512 - padding * 2) / 512})">
    <path d="M150 128v256M362 128v256M150 256h212" stroke="${WHITE}" stroke-width="64" stroke-linecap="square" fill="none"/>
  </g>
</svg>`;

// Notification badge: monochrome, the OS tints it.
const badge = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
  <path d="M28 20v56M68 20v56M28 48h40" stroke="#fff" stroke-width="14" stroke-linecap="square" fill="none"/>
</svg>`;

await mkdir("public/icons", { recursive: true });
const render = (svg, size, out) => sharp(Buffer.from(svg)).resize(size, size).png().toFile(out);

await render(icon(), 192, "public/icons/icon-192.png");
await render(icon(), 512, "public/icons/icon-512.png");
await render(icon(56), 512, "public/icons/maskable-512.png");
await render(icon(), 180, "app/apple-icon.png");
await render(badge, 96, "public/icons/badge-96.png");
await writeFile("app/icon.svg", icon().trim() + "\n");
console.log("icons written");
