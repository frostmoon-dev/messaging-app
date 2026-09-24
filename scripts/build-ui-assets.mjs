#!/usr/bin/env node
// Turns the raw game textures in public/assets into small single-colour masks
// in public/ui. The app tints every mask with CSS (`mask-image` + a theme
// colour), so one file works for every theme.
// Run: node scripts/build-ui-assets.mjs
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const SRC = "public/assets";
const OUT = "public/ui";

async function grey(file) {
  return sharp(path.join(SRC, file)).removeAlpha().greyscale().raw().toBuffer({ resolveWithObject: true });
}

// "NIGHT" from the Late-at-Night banner + "TIME" from the Daytime banner.
// Column ranges were measured from the 1024x128 sources.
async function nightTime() {
  const night = await grey("T_UI_Field_Day_Wave_Time_LateAtNight.png");
  const time = await grey("T_UI_Field_Day_Wave_Time_Daytime.png");
  const H = 128;
  const NIGHT = [598, 1020];
  const TIME = [668, 1016];
  const GAP = 5;
  // In Daytime the Y overlaps the T's crossbar at x 668-675; rebuild those
  // columns by mirroring the bar's right end around the stem centre (x 716).
  const timeCol = (x) => (x <= 675 ? 1432 - x : x);
  const width = NIGHT[1] - NIGHT[0] + 1 + GAP + TIME[1] - TIME[0] + 1;
  const out = Buffer.alloc(width * H);
  const copy = (img, fromX, toX) => {
    for (let y = 0; y < H; y++) out[y * width + toX] = img.data[y * img.info.width + fromX];
  };
  let x = 0;
  for (let sx = NIGHT[0]; sx <= NIGHT[1]; sx++) copy(night, sx, x++);
  x += GAP;
  for (let sx = TIME[0]; sx <= TIME[1]; sx++) copy(time, timeCol(sx), x++);
  return sharp(out, { raw: { width, height: H, channels: 1 } });
}

// Where the shape lives in each source file:
//   "alpha" – already transparent PNG, keep its alpha
//   "red"   – red-on-black icon sheet, red channel is the shape
//   "luma"  – white-on-black, brightness is the shape
const JOBS = [
  // Time-of-day banners (header clock). The game's NightTime file is
  // misspelled ("NIGTHTIME"), so that one is rebuilt below from two others.
  ...["Morning", "Daytime", "LunchTime", "Afternoon", "LateAtNight"].map((t) => ({
    src: `T_UI_Field_Day_Wave_Time_${t}.png`,
    out: `time-${t.toLowerCase()}.png`,
    from: "luma",
    height: 64,
  })),
  { src: nightTime, out: "time-nighttime.png", from: "luma", height: 64 },
  // Icons.
  { src: "T_UI_AccessIcon_Talk_01.png", out: "talk.png", from: "red", height: 128 },
  { src: "T_UI_AccessIcon_Quest_01.png", out: "alert.png", from: "red", height: 128 },
  { src: "T_UI_AccessIcon_Commu_00.png", out: "arcana.png", from: "red", height: 128 },
  { src: "T_UI_SaveLoad_Sakura.png", out: "sakura.png", from: "alpha", height: 128 },
];

async function shapeChannel(src, from) {
  const img = typeof src === "function" ? await src() : sharp(path.join(SRC, src));
  if (from === "alpha") return img.ensureAlpha().extractChannel(3);
  if (from === "red") return img.removeAlpha().extractChannel(0);
  return img.removeAlpha().greyscale();
}

await mkdir(OUT, { recursive: true });

for (const job of JOBS) {
  const mask = await (await shapeChannel(job.src, job.from)).raw().toBuffer({ resolveWithObject: true });
  const { width, height } = mask.info;
  // White pixels, shape in the alpha channel. Trim empty space, then resize.
  const out = await sharp({ create: { width, height, channels: 3, background: "#ffffff" } })
    .joinChannel(mask.data, { raw: { width, height, channels: 1 } })
    .png()
    .toBuffer();
  const info = await sharp(out)
    .trim({ threshold: 1 })
    .resize({ height: job.height, withoutEnlargement: true })
    .png({ compressionLevel: 9, palette: true, colours: 64 })
    .toFile(path.join(OUT, job.out));
  console.log(`${job.out.padEnd(22)} ${info.width}x${info.height} ${(info.size / 1024).toFixed(1)}KB`);
}
