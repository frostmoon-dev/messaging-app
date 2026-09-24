#!/usr/bin/env node
// Checks WCAG 2.2 contrast for every text/surface pair in app/globals.css.
// Run: node scripts/check-contrast.mjs   (exits 1 if any pair fails)
import { readFile } from "node:fs/promises";

const css = await readFile("app/globals.css", "utf8");

function tokens(selector) {
  const start = css.indexOf(`${selector} {`);
  const block = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]));
}

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

// [text, surface, minimum]
const SURFACES = ["background", "background-raised", "panel", "panel-strong"];
const PAIRS = [
  ...SURFACES.map((s) => ["foreground", s, 7]),
  ...SURFACES.map((s) => ["muted", s, 4.5]),
  ...SURFACES.map((s) => ["muted-strong", s, 4.5]),
  ...SURFACES.map((s) => ["danger", s, 4.5]),
  ...SURFACES.map((s) => ["online", s, 3]),
  ...["background", "panel", "background-raised"].map((s) => ["field-border", s, 3]),
  ["foreground", "accent-soft", 4.5],
  ["accent-foreground", "accent", 4.5],
  ["accent-foreground", "accent-hover", 4.5],
  ...SURFACES.map((s) => ["accent-text", s, 4.5]),
  ["incoming-foreground", "incoming", 7],
  ["outgoing-foreground", "outgoing", 4.5],
  ["accent", "background", 3],
  ["accent", "panel", 3],
];

let failed = false;
for (const [name, selector] of [
  ["Ink", '[data-theme="ink"]'],
  ["Paper", '[data-theme="paper"]'],
  ["Phantom", '[data-theme="phantom"]'],
  ["Moon Cell", '[data-theme="mooncell"]'],
]) {
  const t = tokens(selector);
  console.log(`\n${name}`);
  for (const [fg, bg, min] of PAIRS) {
    const r = ratio(t[fg], t[bg]);
    const ok = r >= min;
    if (!ok) failed = true;
    console.log(`${ok ? "ok  " : "FAIL"} ${fg.padEnd(20)} on ${bg.padEnd(18)} ${r.toFixed(2)} (min ${min})`);
  }
  // Eye comfort: pure black pages and pure white body text cause halation.
  for (const [token, banned] of [["background", "#000000"], ["foreground", "#ffffff"], ["background", "#ffffff"], ["foreground", "#000000"]]) {
    if (t[token].toLowerCase() === banned) {
      failed = true;
      console.log(`FAIL ${token} is ${banned}; use an off-white / dark grey instead`);
    }
  }
}
// "Automatic" repeats the Paper values inside a media query; they must match.
const paper = JSON.stringify(tokens('[data-theme="paper"]'));
const system = JSON.stringify(tokens('  [data-theme="system"]'));
if (paper !== system) {
  failed = true;
  console.log('\nFAIL [data-theme="system"] light values differ from [data-theme="paper"]');
}

process.exit(failed ? 1 : 0);
