// รายการไอคอน Lucide ที่ใช้เลือกเป็นไอคอนหมวดหมู่ (categories.icon เก็บ key แบบ kebab-case เป็น text)
import {
  Utensils,
  Coffee,
  ShoppingCart,
  ShoppingBag,
  Car,
  Bus,
  Fuel,
  House,
  Zap,
  Droplet,
  Smartphone,
  Wifi,
  HeartPulse,
  Shield,
  GraduationCap,
  Film,
  Plane,
  Gift,
  PawPrint,
  CreditCard,
  PiggyBank,
  Wallet,
  Coins,
  Tag,
  type LucideIcon,
} from "lucide-react"

export type CategoryIconEntry = {
  key: string
  label: string
  Icon: LucideIcon
}

// เรียงลำดับตามที่ตกลงกับผู้ใช้ (spec เฟส 0 ข้อ 8b)
export const CATEGORY_ICONS: CategoryIconEntry[] = [
  { key: "utensils", label: "อาหาร", Icon: Utensils },
  { key: "coffee", label: "เครื่องดื่ม", Icon: Coffee },
  { key: "shopping-cart", label: "ของใช้", Icon: ShoppingCart },
  { key: "shopping-bag", label: "ช้อปปิ้ง", Icon: ShoppingBag },
  { key: "car", label: "รถยนต์", Icon: Car },
  { key: "bus", label: "ขนส่งสาธารณะ", Icon: Bus },
  { key: "fuel", label: "น้ำมัน", Icon: Fuel },
  { key: "house", label: "ที่พัก", Icon: House },
  { key: "zap", label: "ค่าไฟ", Icon: Zap },
  { key: "droplet", label: "ค่าน้ำ", Icon: Droplet },
  { key: "smartphone", label: "มือถือ", Icon: Smartphone },
  { key: "wifi", label: "อินเทอร์เน็ต", Icon: Wifi },
  { key: "heart-pulse", label: "สุขภาพ", Icon: HeartPulse },
  { key: "shield", label: "ประกัน", Icon: Shield },
  { key: "graduation-cap", label: "การศึกษา", Icon: GraduationCap },
  { key: "film", label: "บันเทิง", Icon: Film },
  { key: "plane", label: "ท่องเที่ยว", Icon: Plane },
  { key: "gift", label: "ของขวัญ", Icon: Gift },
  { key: "paw-print", label: "สัตว์เลี้ยง", Icon: PawPrint },
  { key: "credit-card", label: "ชำระหนี้", Icon: CreditCard },
  { key: "piggy-bank", label: "ออมเงิน", Icon: PiggyBank },
  { key: "wallet", label: "เงินเดือน", Icon: Wallet },
  { key: "coins", label: "รายได้เสริม", Icon: Coins },
  { key: "tag", label: "อื่นๆ", Icon: Tag },
]

// หา entry จาก key — คืน undefined ถ้าไม่ตรง (เช่น legacy emoji หรือค่าว่าง)
export function getCategoryIcon(key?: string | null): CategoryIconEntry | undefined {
  if (!key) return undefined
  return CATEGORY_ICONS.find((entry) => entry.key === key)
}
