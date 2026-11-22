// D95: renders the PWA icons from the mark's SVG master (public/icons/getfit.svg). Run `pnpm icons` after changing it.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const dir = join(import.meta.dirname, '..', 'public', 'icons');
const master = readFileSync(join(dir, 'getfit.svg'));

/** A full-bleed tile with the "G" scaled into the maskable safe zone (the inner 80%), so no platform crops it. */
const maskable = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#2F5BEA"/>
  <g transform="translate(256 256) scale(0.72) translate(-256 -256)">
    <path d="M346 149 A140 140 0 1 0 396 256 L280 256" fill="none" stroke="#FFFFFF" stroke-width="64" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`);

const outputs: [Buffer, number, string][] = [
  [master, 192, 'icon-192.png'],
  [master, 512, 'icon-512.png'],
  [maskable, 512, 'maskable-512.png'],
  // iOS adds its own rounding, so the touch icon is the full-bleed tile.
  [maskable, 180, 'apple-touch-icon.png'],
];
for (const [svg, size, name] of outputs) {
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(join(dir, name));
  console.log(`icons: ${name} (${size} px)`);
}
