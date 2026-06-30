"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"

type Asset = {
  id: string
  name: string
  asset_group: "liquid" | "investment" | "personal"
  value: number
  updated_at: string
}

type Liability = {
  id: string
  name: string
  term: string
  balance: number
  updated_at: string
}

type Transaction = {
  amount: number
  type: string
  category: string
}

const ASSET_GROUPS = [
  { key: "liquid", label: "สินทรัพย์สภาพคล่อง", desc: "เงินสด, บัญชีเงินฝาก, กองทุนรวม" },
  { key: "investment", label: "สินทรัพย์เพื่อการลงทุน", desc: "หุ้น, กองทุน, ประกัน" },
  { key: "personal", label: "สินทรัพย์ส่วนตัว", desc: "บ้าน/ที่ดิน, รถ, เครื่องประดับ" },
]

export default function BalanceSheetPage() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [liabilities, setLiabilities] = useState<Liability[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])

  const [showAssetModal, setShowAssetModal] = useState(false)
  const [showLiabModal, setShowLiabModal] = useState(false)
  const [editAsset, setEditAsset] = useState<Asset | null>(null)
  const [editLiab, setEditLiab] = useState<Liability | null>(null)

  const [assetName, setAssetName] = useState("")
  const [assetGroup, setAssetGroup] = useState<Asset["asset_group"]>("liquid")
  const [assetValue, setAssetValue] = useState("")

  const [liabName, setLiabName] = useState("")
  const [liabBalance, setLiabBalance] = useState("")
  const [liabTerm, setLiabTerm] = useState("ระยะสั้น")

  // รายได้/รายจ่ายต่อเดือน (กรอกเอง) สำหรับคำนวณตัวเลขสุขภาพการเงิน
  const [monthlyIncome, setMonthlyIncome] = useState(0)
  const [monthlyExpense, setMonthlyExpense] = useState(0)
  const [monthlySaving, setMonthlySaving] = useState(0)
  const [occupation, setOccupation] = useState("salaried")
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [incomeInput, setIncomeInput] = useState("")
  const [expenseInput, setExpenseInput] = useState("")
  const [savingInput, setSavingInput] = useState("")
  const [occupationInput, setOccupationInput] = useState("salaried")

  // activeTab ใช้สลับระหว่าง สินทรัพย์ และ หนี้สิน บนมือถือ
  const [activeTab, setActiveTab] = useState<"assets" | "liabilities">("assets")

  const fetchAll = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [{ data: a }, { data: l }, { data: t }, { data: p }] = await Promise.all([
      supabase.from("assets").select("*").eq("user_id", user.id).order("asset_group"),
      supabase.from("liabilities_long").select("*").eq("user_id", user.id),
      supabase.from("transactions").select("amount, type, category").eq("user_id", user.id),
      supabase.from("financial_profile").select("*").eq("user_id", user.id).maybeSingle(),
    ])
    setAssets((a || []) as Asset[])
    setLiabilities((l || []) as Liability[])
    setTransactions((t || []) as Transaction[])
    if (p) {
  setMonthlyIncome(Number(p.monthly_income) || 0)
  setMonthlyExpense(Number(p.monthly_expense) || 0)
  setMonthlySaving(Number(p.monthly_saving) || 0)
  setOccupation(p.occupation || "salaried")
}
  }

  useEffect(() => { fetchAll() }, [])

  const totalAssets = assets.reduce((s, a) => s + Number(a.value), 0)

  // แยกหนี้เป็น 2 กลุ่มตาม term (ไม่ดึงจาก transactions แล้ว)
  const shortTermLiabs = liabilities.filter(l => l.term === "ระยะสั้น")
  const longTermLiabs = liabilities.filter(l => l.term === "ระยะยาว")

  const shortTermDebt = shortTermLiabs.reduce((s, l) => s + Number(l.balance), 0)
  const longTermDebt = longTermLiabs.reduce((s, l) => s + Number(l.balance), 0)
  const totalLiabilities = shortTermDebt + longTermDebt
  const netWorth = totalAssets - totalLiabilities
  const debtRatio = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0

 const savingRate = monthlyIncome > 0 ? (monthlySaving / monthlyIncome) * 100 : 0
  // สัดส่วนหนี้ต่อรายได้ทั้งปี (หนี้สินรวม เทียบ รายได้ทั้งปี)
  const debtToIncome = monthlyIncome > 0 ? (totalLiabilities / (monthlyIncome * 12)) * 100 : 0
  const emergencyMonths = monthlyExpense > 0
    ? assets.filter(a => a.asset_group === "liquid").reduce((s, a) => s + Number(a.value), 0) / monthlyExpense
    : 0

  const healthIndicators = [
    {
      label: "คุณสะสมความมั่งคั่งได้แค่ไหน?",
      sub: "อัตราการออม (เป้า ≥ 10%)",
      value: savingRate, target: 10, unit: "%", higherIsBetter: true,
      tip: savingRate >= 10 ? "ดีมาก! คุณออมเงินได้ตามเป้า" : "ลองลดรายจ่ายเพื่อเพิ่มอัตราออม",
    },
    {
      label: "คุณแบกหนี้หนักเกินไปไหม?",
      sub: "สัดส่วนหนี้ต่อรายได้ (เป้า < 35%)",
      value: debtToIncome, target: 35, unit: "%", higherIsBetter: false,
      tip: debtToIncome < 35 ? "ภาระหนี้อยู่ในระดับที่จัดการได้" : "ภาระหนี้สูงเกินไป ควรเร่งปิดหนี้",
    },
    {
  label: "ถ้าขาดรายได้จะอยู่ได้นานแค่ไหน?",
  sub: `เงินสำรองฉุกเฉิน (เป้า ≥ ${occupation === "freelance" ? "8" : "6"} เดือน)`,
  value: emergencyMonths,
  target: occupation === "freelance" ? 8 : 6,
  unit: " เดือน", higherIsBetter: true,
  tip: emergencyMonths >= (occupation === "freelance" ? 8 : 6)
    ? "มีเงินสำรองเพียงพอแล้ว"
    : `ควรสะสมเงินสำรองให้ถึง ${occupation === "freelance" ? "8-12" : "6-10"} เดือน`,
},
    {
      label: "โดยรวมแล้วรวยขึ้นไหม?",
      sub: "ความมั่งคั่งสุทธิ",
      value: netWorth, target: 0, unit: " ฿", higherIsBetter: true,
      tip: netWorth >= 0 ? "สินทรัพย์มากกว่าหนี้สิน ดีมาก!" : "หนี้สินมากกว่าสินทรัพย์ ควรเร่งลดหนี้",
    },
  ]

  // คืนค่าสีเป็น hex ตรงๆ (แก้ปัญหา Tailwind v4 ไม่ generate สี bg-green-50 ฯลฯ)
  const getSignalColor = (value: number, target: number, higherIsBetter: boolean) => {
    const good = higherIsBetter ? value >= target : value <= target
    const warn = higherIsBetter ? value >= target * 0.5 : value <= target * 1.5
    if (good) return { text: "#1D9E75", bg: "#ECFDF5" }
    if (warn) return { text: "#F59E0B", bg: "#FEFCE8" }
    return { text: "#D85A30", bg: "#FEF2F2" }
  }

  const getBarColor = (value: number, target: number, higherIsBetter: boolean) => {
    const good = higherIsBetter ? value >= target : value <= target
    const warn = higherIsBetter ? value >= target * 0.5 : value <= target * 1.5
    if (good) return "#1D9E75"
    if (warn) return "#F59E0B"
    return "#D85A30"
  }

  const openAddAsset = () => {
    setEditAsset(null)
    setAssetName(""); setAssetGroup("liquid"); setAssetValue("")
    setShowAssetModal(true)
  }

  const openEditAsset = (a: Asset) => {
    setEditAsset(a)
    setAssetName(a.name); setAssetGroup(a.asset_group); setAssetValue(String(a.value))
    setShowAssetModal(true)
  }

  const saveAsset = async () => {
    if (!assetName || !assetValue) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    if (editAsset) {
      await supabase.from("assets").update({ name: assetName, asset_group: assetGroup, value: Number(assetValue), updated_at: new Date().toISOString() }).eq("id", editAsset.id)
    } else {
      await supabase.from("assets").insert({ user_id: user.id, name: assetName, asset_group: assetGroup, value: Number(assetValue) })
    }
    setShowAssetModal(false)
    await fetchAll()
  }

  const deleteAsset = async (id: string) => {
    if (!confirm("ลบสินทรัพย์นี้?")) return
    await supabase.from("assets").delete().eq("id", id)
    await fetchAll()
  }

  const openAddLiab = () => {
    setEditLiab(null)
    setLiabName(""); setLiabBalance(""); setLiabTerm("ระยะสั้น")
    setShowLiabModal(true)
  }

  const openEditLiab = (l: Liability) => {
    setEditLiab(l)
    setLiabName(l.name); setLiabBalance(String(l.balance)); setLiabTerm(l.term || "ระยะสั้น")
    setShowLiabModal(true)
  }

  const saveLiab = async () => {
    if (!liabName || !liabBalance) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return
    }
    if (editLiab) {
      await supabase.from("liabilities_long").update({
        name: liabName, term: liabTerm,
        balance: Number(liabBalance), updated_at: new Date().toISOString()
      }).eq("id", editLiab.id)
    } else {
      await supabase.from("liabilities_long").insert({
        user_id: user.id, name: liabName, term: liabTerm, balance: Number(liabBalance)
      })
    }
    setShowLiabModal(false)
    await fetchAll()
  }

  const deleteLiab = async (id: string) => {
    if (!confirm("ลบหนี้สินนี้?")) return
    await supabase.from("liabilities_long").delete().eq("id", id)
    await fetchAll()
  }

  // เปิด modal กรอกรายได้/รายจ่ายต่อเดือน — เอาค่าปัจจุบันมาใส่ช่องกรอก
  const openProfileModal = () => {
  setIncomeInput(monthlyIncome > 0 ? String(monthlyIncome) : "")
  setExpenseInput(monthlyExpense > 0 ? String(monthlyExpense) : "")
  setSavingInput(monthlySaving > 0 ? String(monthlySaving) : "")
  setOccupationInput(occupation)
  setShowProfileModal(true)
}

  // บันทึกรายได้/รายจ่ายต่อเดือนลง financial_profile
  const saveProfile = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from("financial_profile").upsert({
    user_id: user.id,
    monthly_income: Number(incomeInput) || 0,
    monthly_expense: Number(expenseInput) || 0,
    monthly_saving: Number(savingInput) || 0,
    occupation: occupationInput,
    updated_at: new Date().toISOString(),
  })
  setShowProfileModal(false)
  await fetchAll()
}

  // Section สินทรัพย์ — แยกออกมาเป็น component เพื่อใช้ซ้ำใน desktop และ mobile tab
  const AssetsSection = () => (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700">สินทรัพย์</h2>
        <button onClick={openAddAsset} className="text-xs bg-[#1D9E75] text-white px-3 py-1.5 rounded-lg hover:bg-[#178a64]">
          + เพิ่ม
        </button>
      </div>
      {ASSET_GROUPS.map(group => {
        const groupAssets = assets.filter(a => a.asset_group === group.key)
        const groupTotal = groupAssets.reduce((s, a) => s + Number(a.value), 0)
        return (
          <div key={group.key}>
            <div className="px-5 py-2 bg-gray-50 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500">{group.label}</p>
              <p className="text-xs text-gray-400">{group.desc}</p>
            </div>
            {groupAssets.length === 0 ? (
              <p className="px-5 py-3 text-xs text-gray-300">ยังไม่มีรายการ</p>
            ) : (
              groupAssets.map(a => (
                <div key={a.id} className="flex items-center justify-between px-5 py-3 border-b border-gray-50">
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="text-sm text-gray-800 truncate">{a.name}</p>
                    <p className="text-xs text-gray-400">อัปเดต {new Date(a.updated_at).toLocaleDateString("th-TH")}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <p className="text-sm font-semibold text-[#1D9E75]">฿{Number(a.value).toLocaleString()}</p>
                    <button onClick={() => openEditAsset(a)} className="text-xs text-[#378ADD] hover:underline">แก้ไข</button>
                    <button onClick={() => deleteAsset(a.id)} className="text-xs text-[#D85A30] hover:underline">ลบ</button>
                  </div>
                </div>
              ))
            )}
            <div className="flex justify-between px-5 py-2 bg-green-50">
              <p className="text-xs font-semibold text-gray-600">รวม{group.label}</p>
              <p className="text-xs font-semibold text-[#1D9E75]">฿{groupTotal.toLocaleString()}</p>
            </div>
          </div>
        )
      })}
      <div className="flex justify-between px-5 py-3 bg-[#1D9E75]">
        <p className="text-sm font-bold text-white">สินทรัพย์รวม</p>
        <p className="text-sm font-bold text-white">฿{totalAssets.toLocaleString()}</p>
      </div>
    </div>
  )

  // ฟังก์ชันย่อย: แสดงรายการหนี้ 1 ตัว (ใช้ซ้ำทั้งกลุ่มสั้น/ยาว)
  const renderLiabRow = (l: Liability) => (
    <div key={l.id} className="flex items-center justify-between px-5 py-3 border-b border-gray-50">
      <div className="flex-1 min-w-0 mr-3">
        <p className="text-sm text-gray-800 truncate">{l.name}</p>
        <p className="text-xs text-gray-400">
          อัปเดต {new Date(l.updated_at).toLocaleDateString("th-TH")}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <p className="text-sm font-semibold text-[#D85A30]">฿{Number(l.balance).toLocaleString()}</p>
        <button onClick={() => openEditLiab(l)} className="text-xs text-[#378ADD] hover:underline">แก้ไข</button>
        <button onClick={() => deleteLiab(l.id)} className="text-xs text-[#D85A30] hover:underline">ลบ</button>
      </div>
    </div>
  )

  const LiabilitiesSection = () => (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700">หนี้สิน</h2>
        <button onClick={openAddLiab} className="text-xs bg-[#D85A30] text-white px-3 py-1.5 rounded-lg hover:bg-red-600">
          + เพิ่ม
        </button>
      </div>

      {/* กลุ่มหนี้ระยะสั้น */}
      <div className="px-5 py-2 bg-gray-50 border-b border-gray-100">
        <p className="text-xs font-semibold text-gray-500">หนี้ระยะสั้น</p>
        <p className="text-xs text-gray-400">ผ่อนหมดภายใน 1 ปี เช่น บัตรเครดิต, หนี้นอกระบบ</p>
      </div>
      {shortTermLiabs.length === 0 ? (
        <p className="px-5 py-3 text-xs text-gray-300">ยังไม่มีรายการ</p>
      ) : (
        shortTermLiabs.map(renderLiabRow)
      )}
      <div className="flex justify-between px-5 py-2 bg-red-50">
        <p className="text-xs font-semibold text-gray-600">รวมหนี้ระยะสั้น</p>
        <p className="text-xs font-semibold text-[#D85A30]">฿{shortTermDebt.toLocaleString()}</p>
      </div>

      {/* กลุ่มหนี้ระยะยาว */}
      <div className="px-5 py-2 bg-gray-50 border-b border-gray-100">
        <p className="text-xs font-semibold text-gray-500">หนี้ระยะยาว</p>
        <p className="text-xs text-gray-400">ผ่อนนานกว่า 1 ปี เช่น บ้าน, รถ, กยศ.</p>
      </div>
      {longTermLiabs.length === 0 ? (
        <p className="px-5 py-3 text-xs text-gray-300">ยังไม่มีรายการ</p>
      ) : (
        longTermLiabs.map(renderLiabRow)
      )}
      <div className="flex justify-between px-5 py-2 bg-red-50">
        <p className="text-xs font-semibold text-gray-600">รวมหนี้ระยะยาว</p>
        <p className="text-xs font-semibold text-[#D85A30]">฿{longTermDebt.toLocaleString()}</p>
      </div>

      {/* หนี้สินรวมทั้งหมด */}
      <div className="flex justify-between px-5 py-3 bg-[#D85A30]">
        <p className="text-sm font-bold text-white">หนี้สินรวม</p>
        <p className="text-sm font-bold text-white">฿{totalLiabilities.toLocaleString()}</p>
      </div>
    </div>
  )

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">งบแสดงสถานะการเงิน</h1>

      {/* Summary Cards — ปรับ font เล็กลงบน mobile */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        {[
          { label: "สินทรัพย์", value: totalAssets, color: "text-[#1D9E75]" },
          { label: "หนี้สิน", value: totalLiabilities, color: "text-[#D85A30]" },
          { label: "มั่งคั่งสุทธิ", value: netWorth, color: netWorth >= 0 ? "text-[#1D9E75]" : "text-[#D85A30]" },
          { label: "หนี้/สินทรัพย์", value: debtRatio, color: "text-[#378ADD]", unit: "%" },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl p-3 md:p-4 shadow-sm">
            <p className="text-xs text-gray-500 mb-1">{card.label}</p>
            <p className={`text-base md:text-xl font-bold ${card.color} truncate`}>
              {card.unit ? `${debtRatio.toFixed(1)}%` : `฿${Number(card.value).toLocaleString()}`}
            </p>
          </div>
        ))}
      </div>

      {/* Health Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {healthIndicators.map((ind) => {
          const signal = getSignalColor(ind.value, ind.target, ind.higherIsBetter)
          const barColor = getBarColor(ind.value, ind.target, ind.higherIsBetter)
          return (
            <div key={ind.label} className="rounded-xl p-4 shadow-sm" style={{ color: signal.text, backgroundColor: signal.bg }}>
              <p className="text-sm font-semibold mb-1">{ind.label}</p>
              <p className="text-xs opacity-70 mb-2">{ind.sub}</p>
              <p className="text-2xl font-bold mb-2">
                {ind.unit === " ฿" ? `฿${ind.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : `${ind.value.toFixed(1)}${ind.unit}`}
              </p>
              <div className="h-2 bg-white/50 rounded-full mb-2">
                <div
                  className="h-2 rounded-full"
                  style={{
                    width: `${Math.min(100, ind.unit === " ฿" ? (ind.value > 0 ? 100 : 0) : (ind.value / (ind.target * 2)) * 100)}%`,
                    backgroundColor: barColor,
                  }}
                />
              </div>
              <p className="text-xs opacity-80">{ind.tip}</p>
            </div>
          )
        })}
      </div>

      {/* Section รายได้-รายจ่ายต่อเดือน */}
      <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">รายได้-รายจ่ายต่อเดือน</h2>
          <button onClick={openProfileModal} className="text-xs bg-[#378ADD] text-white px-3 py-1.5 rounded-lg hover:bg-blue-600">
            แก้ไข
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
  <div className="bg-green-50 rounded-xl p-3 text-center">
    <p className="text-xs text-gray-500 mb-1">รายได้/เดือน</p>
    <p className="text-sm md:text-base font-bold text-[#1D9E75]">฿{monthlyIncome.toLocaleString()}</p>
  </div>
  <div className="bg-red-50 rounded-xl p-3 text-center">
    <p className="text-xs text-gray-500 mb-1">รายจ่าย/เดือน</p>
    <p className="text-sm md:text-base font-bold text-[#D85A30]">฿{monthlyExpense.toLocaleString()}</p>
  </div>
  <div className="bg-gray-50 rounded-xl p-3 text-center">
    <p className="text-xs text-gray-500 mb-1">เหลือ/เดือน</p>
    <p className={`text-sm md:text-base font-bold ${(monthlyIncome - monthlyExpense) >= 0 ? "text-[#1D9E75]" : "text-[#D85A30]"}`}>
      ฿{(monthlyIncome - monthlyExpense).toLocaleString()}
    </p>
  </div>
  <div className="bg-blue-50 rounded-xl p-3 text-center">
    <p className="text-xs text-gray-500 mb-1">ออม/เดือน</p>
    <p className="text-sm md:text-base font-bold text-[#378ADD]">฿{monthlySaving.toLocaleString()}</p>
  </div>
</div>
</div>
      {/* เลือกอาชีพ — เลือกครั้งเดียว save ทันที */}
<div className="bg-white rounded-xl shadow-sm p-5 mb-6">
  <h2 className="text-sm font-semibold text-gray-700 mb-3">ประเภทอาชีพ</h2>
  <div className="flex gap-3">
    <button onClick={async () => {
      setOccupation("salaried")
      const { data: { user } } = await supabase.auth.getUser()
      if (user) await supabase.from("financial_profile").upsert({ user_id: user.id, occupation: "salaried", updated_at: new Date().toISOString() })
    }}
      className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${occupation === "salaried" ? "bg-[#1D9E75] text-white border-[#1D9E75]" : "border-gray-200 text-gray-600"}`}>
      งานประจำ
    </button>
    <button onClick={async () => {
      setOccupation("freelance")
      const { data: { user } } = await supabase.auth.getUser()
      if (user) await supabase.from("financial_profile").upsert({ user_id: user.id, occupation: "freelance", updated_at: new Date().toISOString() })
    }}
      className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${occupation === "freelance" ? "bg-[#378ADD] text-white border-[#378ADD]" : "border-gray-200 text-gray-600"}`}>
      ฟรีแลนซ์
    </button>
  </div>
  <p className="text-xs text-gray-400 mt-2">
    {occupation === "salaried"
      ? "งานประจำ: แนะนำเงินสำรองฉุกเฉิน 6-10 เดือน"
      : "ฟรีแลนซ์: แนะนำเงินสำรองฉุกเฉิน 8-12 เดือน"}
  </p>
</div>
      {/* Mobile — Tab สลับสินทรัพย์/หนี้สิน */}
      <div className="md:hidden mb-4">
        <div className="flex bg-white border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setActiveTab("assets")}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${activeTab === "assets" ? "bg-[#1D9E75] text-white" : "text-gray-500"}`}
          >
            สินทรัพย์ ฿{totalAssets.toLocaleString()}
          </button>
          <button
            onClick={() => setActiveTab("liabilities")}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${activeTab === "liabilities" ? "bg-[#D85A30] text-white" : "text-gray-500"}`}
          >
            หนี้สิน ฿{totalLiabilities.toLocaleString()}
          </button>
        </div>
      </div>

      {/* Mobile — แสดง tab ที่เลือก */}
      <div className="md:hidden">
        {activeTab === "assets" ? <AssetsSection /> : <LiabilitiesSection />}
      </div>

      {/* Desktop — แสดง 2 คอลัมน์เคียงกัน */}
      <div className="hidden md:grid md:grid-cols-2 gap-6">
        <AssetsSection />
        <LiabilitiesSection />
      </div>

      {/* Asset Modal */}
      {showAssetModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">{editAsset ? "แก้ไขสินทรัพย์" : "เพิ่มสินทรัพย์"}</h2>
            <div className="flex flex-col gap-3">
              <input placeholder="ชื่อสินทรัพย์" value={assetName} onChange={e => setAssetName(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75] text-gray-800" />
              <select value={assetGroup} onChange={e => setAssetGroup(e.target.value as Asset["asset_group"])}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none text-gray-800">
                {ASSET_GROUPS.map(g => <option key={g.key} value={g.key}>{g.label}</option>)}
              </select>
              <input placeholder="มูลค่า (฿)" type="number" value={assetValue} onChange={e => setAssetValue(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75] text-gray-800" />
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowAssetModal(false)} className="flex-1 border border-gray-200 rounded-lg py-2 text-sm hover:bg-gray-50 text-gray-700">ยกเลิก</button>
              <button onClick={saveAsset} className="flex-1 bg-[#1D9E75] text-white rounded-lg py-2 text-sm hover:bg-[#178a64]">บันทึก</button>
            </div>
          </div>
        </div>
      )}

      {/* Liability Modal */}
      {showLiabModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">{editLiab ? "แก้ไขหนี้สิน" : "เพิ่มหนี้สิน"}</h2>
            <div className="flex flex-col gap-3">
              <input placeholder="ชื่อหนี้สิน เช่น บัตรเครดิต KBank" value={liabName} onChange={e => setLiabName(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75] text-gray-800" />

              {/* Toggle ระยะสั้น / ระยะยาว */}
              <div className="flex gap-3">
                <button onClick={() => setLiabTerm("ระยะสั้น")}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${liabTerm === "ระยะสั้น" ? "bg-[#D85A30] text-white border-[#D85A30]" : "border-gray-200 text-gray-600"}`}>
                  ระยะสั้น
                </button>
                <button onClick={() => setLiabTerm("ระยะยาว")}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${liabTerm === "ระยะยาว" ? "bg-[#D85A30] text-white border-[#D85A30]" : "border-gray-200 text-gray-600"}`}>
                  ระยะยาว
                </button>
              </div>

              {/* ข้อความแนะนำว่าหนี้แบบไหนคือสั้น/ยาว */}
              <div className="bg-blue-50 rounded-lg p-3 text-xs text-gray-600 leading-relaxed">
                <p className="font-semibold text-[#378ADD] mb-1">💡 หนี้ระยะไหน?</p>
                <p><span className="font-medium">ระยะสั้น</span> = ผ่อนหมดภายใน 1 ปี เช่น บัตรเครดิต, หนี้นอกระบบ, ผ่อนสินค้า</p>
                <p><span className="font-medium">ระยะยาว</span> = ผ่อนนานกว่า 1 ปี เช่น บ้าน, รถ, กยศ.</p>
              </div>

              <input placeholder="ยอดคงเหลือ (฿)" type="number" value={liabBalance} onChange={e => setLiabBalance(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75] text-gray-800" />
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowLiabModal(false)} className="flex-1 border border-gray-200 rounded-lg py-2 text-sm hover:bg-gray-50 text-gray-700">ยกเลิก</button>
              <button onClick={saveLiab} className="flex-1 bg-[#D85A30] text-white rounded-lg py-2 text-sm hover:bg-red-600">บันทึก</button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Modal — กรอกรายได้/รายจ่ายต่อเดือน */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-semibold text-gray-800 mb-1">รายได้/รายจ่ายต่อเดือน</h2>
            <p className="text-xs text-gray-400 mb-4">ใช้คำนวณอัตราการออม เงินสำรอง และภาระหนี้</p>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">รายได้เฉลี่ยต่อเดือน (฿)</label>
                <input type="number" value={incomeInput} onChange={e => setIncomeInput(e.target.value)}
                  placeholder="เช่น 30000"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75] text-gray-800" />
              </div>
              <div>
  <label className="text-xs text-gray-500 mb-1 block">รายจ่ายเฉลี่ยต่อเดือน (฿)</label>
  <input type="number" value={expenseInput} onChange={e => setExpenseInput(e.target.value)}
    placeholder="เช่น 20000"
    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75] text-gray-800" />
</div>

              <div>
  <label className="text-xs text-gray-500 mb-1 block">เงินออมต่อเดือน (฿)</label>
  <input type="number" value={savingInput} onChange={e => setSavingInput(e.target.value)}
    placeholder="เช่น 5000"
    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75] text-gray-800" />
  {incomeInput && Number(incomeInput) > 0 && (
    <div className="bg-green-50 rounded-lg p-2 mt-2 text-xs text-gray-600">
      <p className="font-semibold text-[#1D9E75] mb-1">💡 แนะนำเป้าออม</p>
      <p>ขั้นต่ำ 10% = ฿{(Number(incomeInput) * 0.1).toLocaleString()}/เดือน</p>
      <p>เหมาะสม 20% = ฿{(Number(incomeInput) * 0.2).toLocaleString()}/เดือน</p>
      {savingInput && Number(savingInput) > 0 && (
        <p className="mt-1 font-semibold text-[#1D9E75]">
          ออมอยู่ {((Number(savingInput) / Number(incomeInput)) * 100).toFixed(1)}% ของรายได้
        </p>
      )}
    </div>
  )}
</div>

            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowProfileModal(false)} className="flex-1 border border-gray-200 rounded-lg py-2 text-sm hover:bg-gray-50 text-gray-700">ยกเลิก</button>
              <button onClick={saveProfile} className="flex-1 bg-[#378ADD] text-white rounded-lg py-2 text-sm hover:bg-blue-600">บันทึก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}