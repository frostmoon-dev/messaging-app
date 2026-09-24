#!/usr/bin/env node
// Renders the app icon SVG to the PNG sizes PWAs and iOS need.
// Run: node scripts/generate-icons.mjs
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";

const RED = "#e3162f";
const BLACK = "#0a0a0b";
const WHITE = "#f6f3ee";

// Original mark: a black field, a red slab cut on a diagonal, and a white
// "H" built from two slanted bars and a crossbar.
const icon = (padding = 0) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${BLACK}"/>
  <g transform="translate(${padding} ${padding}) scale(${(512 - padding * 2) / 512})">
    <polygon points="0,340 512,120 512,330 0,512" fill="${RED}"/>
    <polygon points="138,96 214,96 176,416 100,416" fill="${WHITE}"/>
    <polygon points="336,96 412,96 374,416 298,416" fill="${WHITE}"/>
    <polygon points="150,226 380,208 372,276 142,294" fill="${WHITE}"/>
  </g>
</svg>`;

const badge = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
  <polygon points="26,14 42,14 34,82 18,82" fill="#fff"/>
  <polygon points="62,14 78,14 70,82 54,82" fill="#fff"/>
  <polygon points="28,40 72,36 70,52 26,56" fill="#fff"/>
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
