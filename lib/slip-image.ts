// ย่อรูปสลิปก่อนส่ง (ใช้ในเบราว์เซอร์เท่านั้น) — กัน request ใหญ่เกินขีดจำกัดของ Vercel (~4.5MB)

const MAX_SIDE = 1800
const JPEG_QUALITY = 0.9

export type PreparedSlip = { base64: string; mimeType: "image/jpeg" | "image/png" }

function readOriginal(file: File): Promise<PreparedSlip> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== "string") {
        reject(new Error("read failed"))
        return
      }
      resolve({
        base64: result.split(",")[1] ?? "",
        mimeType: file.type === "image/png" ? "image/png" : "image/jpeg",
      })
    }
    reader.onerror = () => reject(reader.error ?? new Error("read failed"))
    reader.readAsDataURL(file)
  })
}

async function loadBitmap(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; release: () => void }> {
  if (typeof createImageBitmap === "function") {
    const bmp = await createImageBitmap(file)
    return { source: bmp, width: bmp.width, height: bmp.height, release: () => bmp.close() }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error("image load failed"))
      img.src = url
    })
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) }
  } catch (err) {
    URL.revokeObjectURL(url)
    throw err
  }
}

export async function prepareSlipImage(file: File): Promise<PreparedSlip> {
  try {
    const loaded = await loadBitmap(file)
    try {
      if (!loaded.width || !loaded.height) throw new Error("empty image")
      const scale = Math.min(1, MAX_SIDE / Math.max(loaded.width, loaded.height))
      const w = Math.max(1, Math.round(loaded.width * scale))
      const h = Math.max(1, Math.round(loaded.height * scale))
      const canvas = document.createElement("canvas")
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("no canvas")
      // พื้นขาว กัน PNG โปร่งใสกลายเป็นดำเมื่อแปลงเป็น JPEG
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, w, h)
      ctx.drawImage(loaded.source, 0, 0, w, h)
      const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY)
      const base64 = dataUrl.split(",")[1]
      if (!base64) throw new Error("export failed")
      return { base64, mimeType: "image/jpeg" }
    } finally {
      loaded.release()
    }
  } catch {
    return readOriginal(file)
  }
}
