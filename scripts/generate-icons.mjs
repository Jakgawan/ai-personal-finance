// สร้างไฟล์ PNG ทั้งหมดจาก public/icons/icon.svg  (รันด้วย: npm run icons)
import sharp from "sharp"
import { readFile } from "node:fs/promises"

const svg = await readFile(new URL("../public/icons/icon.svg", import.meta.url))
const out = (p) => new URL(`../${p}`, import.meta.url).pathname

const targets = [
  ["public/icons/icon-192.png", 192],
  ["public/icons/icon-512.png", 512],
  ["public/icons/icon-maskable-512.png", 512],
  ["app/apple-icon.png", 180],
]

for (const [file, size] of targets) {
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(out(file))
  console.log("wrote", file)
}
