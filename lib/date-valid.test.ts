import { describe, it, expect } from "vitest"
import { isValidDateString } from "./date-valid"

describe("isValidDateString", () => {
  it("รับวันที่จริง รวมปีอธิกสุรทิน", () => {
    expect(isValidDateString("2026-11-04")).toBe(true)
    expect(isValidDateString("2024-02-29")).toBe(true)
    expect(isValidDateString("2026-12-31")).toBe(true)
  })
  it("ปฏิเสธวันที่ที่ไม่มีในปฏิทิน", () => {
    expect(isValidDateString("2026-02-30")).toBe(false)
    expect(isValidDateString("2026-13-01")).toBe(false)
    expect(isValidDateString("2026-00-10")).toBe(false)
    expect(isValidDateString("2025-02-29")).toBe(false)
    expect(isValidDateString("2026-04-31")).toBe(false)
  })
  it("ปฏิเสธรูปแบบผิดและค่าที่ไม่ใช่ string", () => {
    expect(isValidDateString("2026-1-5")).toBe(false)
    expect(isValidDateString("")).toBe(false)
    expect(isValidDateString(null)).toBe(false)
    expect(isValidDateString(undefined)).toBe(false)
    expect(isValidDateString(20261104)).toBe(false)
    expect(isValidDateString(new Date())).toBe(false)
  })
})
