#!/usr/bin/env node
// Renders the Napyru icon from the ink drawing in scripts/brand/napyru-art.jpg
// to every size PWAs, iOS and notifications need.
// Run: node scripts/generate-icons.mjs  (npm run icons)
//
// The icon: the head-and-cat part of the drawing inside a circle with an ink
// ring, on warm paper. Phones add their own rounded-square or circle mask
// around it. The artist's signature is outside the crop only because it
// can't be read at icon sizes; keep credit to the artist elsewhere.
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";

const SOURCE = "scripts/brand/napyru-art.jpg";
const INK = "#161616";
const PAPER = "#f2f1ef";

// Head, ears and the cat, measured on the 1199×1484 source.
const CROP = { left: 176, top: 96, width: 872, height: 872 };

/** The drawing cleaned up: paper becomes pure white (multiplied away), ink stays dark. */
function art(size) {
  return sharp(SOURCE).extract(CROP).greyscale().linear(1.3, -40).resize(size, size).png().toBuffer();
}

function circleMask(d) {
  return Buffer.from(`<svg width="${d}" height="${d}"><circle cx="${d / 2}" cy="${d / 2}" r="${d / 2}" fill="#fff"/></svg>`);
}

/**
 * Square icon: the drawing in a circle of `disc` × 512 px with an ink ring.
 * `background: null` leaves the outside transparent (favicon, in-app mark).
 */
async function icon({ disc, ring, background = PAPER }) {
  const d = Math.round(512 * disc);
  const off = Math.round((512 - d) / 2);
  const inside = await sharp({ create: { width: d, height: d, channels: 4, background: PAPER } })
    .composite([{ input: await art(d), blend: "multiply" }, { input: circleMask(d), blend: "dest-in" }])
    .png()
    .toBuffer();
  const ringSvg = Buffer.from(
    `<svg width="512" height="512"><circle cx="256" cy="256" r="${d / 2 - ring / 2}" fill="none" stroke="${INK}" stroke-width="${ring}"/></svg>`,
  );
  const base = background
    ? { width: 512, height: 512, channels: 4, background }
    : { width: 512, height: 512, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } };
  return sharp({ create: base })
    .composite([{ input: inside, left: off, top: off }, { input: ringSvg }])
    .png()
    .toBuffer();
}

/** Android notification badge: one colour on transparent (the OS tints it). */
async function badge() {
  const size = 96;
  const d = 88;
  // Ink becomes opaque, paper becomes transparent.
  const alpha = await sharp(SOURCE).extract(CROP).greyscale().negate().linear(1.6, -60).resize(d, d).extractChannel(0).raw().toBuffer();
  const joined = await sharp({ create: { width: d, height: d, channels: 3, background: "#ffffff" } })
    .joinChannel(alpha, { raw: { width: d, height: d, channels: 1 } })
    .png()
    .toBuffer();
  const inkShape = await sharp(joined).composite([{ input: circleMask(d), blend: "dest-in" }]).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: inkShape, left: (size - d) / 2, top: (size - d) / 2 }])
    .png()
    .toBuffer();
}

await mkdir("public/icons", { recursive: true });
const write = (buf, size, out) => sharp(buf).resize(size, size).png({ compressionLevel: 9 }).toFile(out);

const full = await icon({ disc: 0.9, ring: 12 });
// Maskable icons get cut to a circle or squircle; keep the drawing in the safe zone.
const maskable = await icon({ disc: 0.76, ring: 10 });
const mark = await icon({ disc: 1, ring: 16, background: null });

await write(full, 192, "public/icons/icon-192.png");
await write(full, 512, "public/icons/icon-512.png");
await write(maskable, 512, "public/icons/maskable-512.png");
await write(full, 180, "app/apple-icon.png");
await write(mark, 64, "public/brand-mark.png");
await write(mark, 256, "public/brand-mark@4x.png");
await sharp(await badge()).png().toFile("public/icons/badge-96.png");

// Browser tab icon: the round mark, embedded so it works as one file.
const favicon = (await sharp(mark).resize(96, 96).png().toBuffer()).toString("base64");
await writeFile(
  "app/icon.svg",
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><image width="96" height="96" href="data:image/png;base64,${favicon}"/></svg>\n`,
);
console.log("icons written");
