// One-off: convert the reference book pages to WebP for the web build.
// Originals (JPG + PDF) are kept in /assets (not shipped); only WebP goes to /public.
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const SRC = 'assets/mindmaps_reference';
const OUT = 'public/assets/mindmaps_reference';
fs.mkdirSync(OUT, { recursive: true });

let before = 0;
let after = 0;
for (const f of fs.readdirSync(SRC)) {
  if (!f.toLowerCase().endsWith('.jpg')) continue;
  const src = path.join(SRC, f);
  const dst = path.join(OUT, f.replace(/\.jpg$/i, '.webp'));
  const meta = await sharp(src).metadata();
  await sharp(src)
    .resize({ width: Math.min(meta.width ?? 1400, 1400), withoutEnlargement: true })
    .webp({ quality: 78 })
    .toFile(dst);
  before += fs.statSync(src).size;
  after += fs.statSync(dst).size;
}
console.log(`JPG ${(before / 1048576).toFixed(1)} MB -> WebP ${(after / 1048576).toFixed(1)} MB`);
