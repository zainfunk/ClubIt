// Rasterize public/icons/icon.svg into the PNG sizes the web manifest and iOS
// reference. Run with: node scripts/generate-icons.mjs
// Requires sharp (dev-only): npm install --no-save sharp
import sharp from 'sharp'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const iconsDir = join(root, 'public', 'icons')
const svg = readFileSync(join(iconsDir, 'icon.svg'))

// Indigo used as the opaque backdrop for icons that must not be transparent.
const OPAQUE_BG = { r: 79, g: 70, b: 229, alpha: 1 } // #4f46e5

const jobs = [
  // PWA manifest icons (transparency in the rounded corners is fine).
  { name: 'icon-192x192.png', size: 192, flatten: false },
  { name: 'icon-512x512.png', size: 512, flatten: false },
  // Apple touch icon (web) + App Store master must be fully opaque.
  { name: 'apple-touch-icon.png', size: 180, flatten: true },
  { name: 'icon-1024.png', size: 1024, flatten: true }, // App Store marketing icon
]

for (const job of jobs) {
  let pipeline = sharp(svg, { density: 384 }).resize(job.size, job.size)
  if (job.flatten) pipeline = pipeline.flatten({ background: OPAQUE_BG })
  await pipeline.png().toFile(join(iconsDir, job.name))
  console.log(`wrote ${job.name} (${job.size}x${job.size}${job.flatten ? ', opaque' : ''})`)
}
