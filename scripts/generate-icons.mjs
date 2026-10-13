// Generates the PWA PNG icons from public/favicon.svg.
// Run with `npm run icons` after changing the SVG; the PNG outputs are committed.
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const BACKGROUND = '#0f172a';
const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
const iconsDir = fileURLToPath(new URL('../public/icons/', import.meta.url));

const svg = await readFile(`${publicDir}favicon.svg`);
await mkdir(iconsDir, { recursive: true });

for (const size of [192, 512]) {
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(`${iconsDir}icon-${size}.png`);
}

// Maskable icon: full-bleed background with the artwork inside the 80% safe zone.
const maskableSize = 512;
const artworkSize = Math.round(maskableSize * 0.7);
const artwork = await sharp(svg, { density: 384 })
  .resize(artworkSize, artworkSize)
  .png()
  .toBuffer();
const offset = Math.round((maskableSize - artworkSize) / 2);

await sharp({
  create: { width: maskableSize, height: maskableSize, channels: 4, background: BACKGROUND },
})
  .composite([{ input: artwork, top: offset, left: offset }])
  .png()
  .toFile(`${iconsDir}icon-maskable-512.png`);

console.log('Icons generated in public/icons/');
