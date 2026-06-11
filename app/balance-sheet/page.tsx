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
  type: string
  balance: number
  updated_at: string
}

const LIABILITY_TYPES = [
  { key: "บัตรเครดิต", label: "บัตรเครดิต", term: "ระยะสั้น" },
  { key: "สินเชื่อส่วนบุคคล", label: "สินเชื่อส่วนบุคคล", term: "ระยะกลาง" },
  { key: "ผ่อนรถ", label: "ผ่อนรถ", term: "ระยะยาว" },
  { key: "ผ่อนบ้าน/คอนโด", label: "ผ่อนบ้าน/คอนโด", term: "ระยะยาว" },
  { key: "กู้การศึกษา", label: "กู้การศึกษา (กยศ.)", term: "ระยะยาว" },
  { key: "หนี้นอกระบบ", label: "หนี้นอกระบบ", term: "ระยะสั้น" },
  { key: "อื่นๆ", label: "อื่นๆ", term: "ระยะสั้น" },
]

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
  const [liabType, setLiabType] = useState("บัตรเครดิต")

  // activeTab ใช้สลับระหว่าง สินทรัพย์ และ หนี้สิน บนมือถือ
  const [activeTab, setActiveTab] = useState<"assets" | "liabilities">("assets")

  const fetchAll = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [{ data: a }, { data: l }, { data: t }] = await Promise.all([
      supabase.from("assets").select("*").eq("user_id", user.id).order("asset_group"),
      supabase.from("liabilities_long").select("*").eq("user_id", user.id),
      supabase.from("transactions").select("amount, type, category").eq("user_id", user.id),
    ])
    setAssets((a || []) as Asset[])
    setLiabilities((l || []) as Liability[])
    setTransactions((t || []) as Transaction[])
  }

  useEffect(() => { fetchAll() }, [])

  const totalAssets = assets.reduce((s, a) => s + Number(a.value), 0)

  const shortTermDebt = transactions
    .filter(t => t.type === "expense" && ["ชำระหนี้", "บัตรเครดิต", "fintech", "ผ่อนสินค้า"].includes(t.category))
    .reduce((s, t) => s + Number(t.amount), 0)

  const longTermDebt = liabilities.reduce((s, l) => s + Number(l.balance), 0)
  const totalLiabilities = shortTermDebt + longTermDebt
  const netWorth = totalAssets - totalLiabilities
  const debtRatio = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0

  const monthlyIncome = transactions
    .filter(t => t.type === "income")
    .reduce((s, t) => s + Number(t.amount), 0)
  const monthlyExpense = transactions
    .filter(t => t.type === "expense")
    .reduce((s, t) => s + Number(t.amount), 0)
  const savingRate = monthlyIncome > 0 ? ((monthlyIncome - monthlyExpense) / monthlyIncome) * 100 : 0
  const debtToIncome = monthlyIncome > 0 ? (shortTermDebt / monthlyIncome) * 100 : 0
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
      sub: "เงินสำรองฉุกเฉิน (เป้า ≥ 6 เดือน)",
      value: emergencyMonths, target: 6, unit: " เดือน", higherIsBetter: true,
      tip: emergencyMonths >= 6 ? "มีเงินสำรองเพียงพอแล้ว" : "ควรสะสมเงินสำรองให้ถึง 6 เดือน",
    },
    {
      label: "โดยรวมแล้วรวยขึ้นไหม?",
      sub: "ความมั่งคั่งสุทธิ",
      value: netWorth, target: 0, unit: " ฿", higherIsBetter: true,
      tip: netWorth >= 0 ? "สินทรัพย์มากกว่าหนี้สิน ดีมาก!" : "หนี้สินมากกว่าสินทรัพย์ ควรเร่งลดหนี้",
    },
  ]

  const getSignalColor = (value: number, target: number, higherIsBetter: boolean) => {
    const good = higherIsBetter ? value >= target : value <= target
    const warn = higherIsBetter ? value >= target * 0.5 : value <= target * 1.5
    if (good) return "text-[#1D9E75] bg-green-50"
    if (warn) return "text-[#F59E0B] bg-yellow-50"
    return "text-[#D85A30] bg-red-50"
  }

  const getBarColor = (value: number, target: number, higherIsBetter: boolean) => {
    const good = higherIsBetter ? value >= target : value <= target
    const warn = higherIsBetter ? value >= target * 0.5 : value <= target * 1.5
    if (good) return "bg-[#1D9E75]"
    if (warn) return "bg-[#F59E0B]"
    return "bg-[#D85A30]"
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
    fetchAll()
  }

  const deleteAsset = async (id: string) => {
    if (!confirm("ลบสินทรัพย์นี้?")) return
    await supabase.from("assets").delete().eq("id", id)
    fetchAll()
  }

 const openAddLiab = () => {
    setEditLiab(null)
    setLiabName(""); setLiabBalance(""); setLiabType("บัตรเครดิต")
    setShowLiabModal(true)
  }

  const openEditLiab = (l: Liability) => {
    setEditLiab(l)
    setLiabName(l.name); setLiabBalance(String(l.balance)); setLiabType(l.type || "อื่นๆ")
    setShowLiabModal(true)
  }

  const saveLiab = async () => {
    if (!liabName || !liabBalance) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    if (editLiab) {
      await supabase.from("liabilities_long").update({
        name: liabName, type: liabType,
        balance: Number(liabBalance), updated_at: new Date().toISOString()
      }).eq("id", editLiab.id)
    } else {
      await supabase.from("liabilities_long").insert({
        user_id: user.id, name: liabName, type: liabType, balance: Number(liabBalance)
      })
    }
    setShowLiabModal(false)
    fetchAll()
  }

  const deleteLiab = async (id: string) => {
    if (!confirm("ลบหนี้สินนี้?")) return
    await supabase.from("liabilities_long").delete().eq("id", id)
    fetchAll()
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
                    {/* shrink-0 ป้องกันปุ่มถูกบีบ */}
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

  // Section หนี้สิน
  const LiabilitiesSection = () => (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700">หนี้สิน</h2>
        <button onClick={openAddLiab} className="text-xs bg-[#D85A30] text-white px-3 py-1.5 rounded-lg hover:bg-red-600">
          + เพิ่ม
        </button>
      </div>
      <div className="px-5 py-2 bg-gray-50 border-b border-gray-100">
        <p className="text-xs font-semibold text-gray-500">หนี้ระยะสั้น</p>
        <p className="text-xs text-gray-400">คำนวณจากรายการชำระหนี้ใน Transactions</p>
      </div>
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-50">
        <p className="text-sm text-gray-800">ยอดชำระหนี้สะสม</p>
        <p className="text-sm font-semibold text-[#D85A30]">฿{shortTermDebt.toLocaleString()}</p>
      </div>
      <div className="px-5 py-2 bg-gray-50 border-b border-gray-100">
        <p className="text-xs font-semibold text-gray-500">หนี้ระยะยาว</p>
        <p className="text-xs text-gray-400">บ้าน, รถ, กู้การศึกษา (กรอกเองเป็นระยะ)</p>
      </div>
      {liabilities.length === 0 ? (
        <p className="px-5 py-3 text-xs text-gray-300">ยังไม่มีรายการ</p>
      ) : (
        liabilities.map(l => (
          <div key={l.id} className="flex items-center justify-between px-5 py-3 border-b border-gray-50">
            <div className="flex-1 min-w-0 mr-3">
              <p className="text-sm text-gray-800 truncate">{l.name}</p>
              <p className="text-xs text-gray-400">
                {l.type || "อื่นๆ"} · อัปเดต {new Date(l.updated_at).toLocaleDateString("th-TH")}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <p className="text-sm font-semibold text-[#D85A30]">฿{Number(l.balance).toLocaleString()}</p>
              <button onClick={() => openEditLiab(l)} className="text-xs text-[#378ADD] hover:underline">แก้ไข</button>
              <button onClick={() => deleteLiab(l.id)} className="text-xs text-[#D85A30] hover:underline">ลบ</button>
            </div>
          </div>
        ))
      )}
      <div className="flex justify-between px-5 py-3 bg-red-50">
        <p className="text-xs font-semibold text-gray-600">รวมหนี้ระยะยาว</p>
        <p className="text-xs font-semibold text-[#D85A30]">฿{longTermDebt.toLocaleString()}</p>
      </div>
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
              {/* truncate ป้องกันตัวเลขยาวล้น card */}
              {card.unit ? `${debtRatio.toFixed(1)}%` : `฿${Number(card.value).toLocaleString()}`}
            </p>
          </div>
        ))}
      </div>

      {/* Health Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {healthIndicators.map((ind) => (
          <div key={ind.label} className={`rounded-xl p-4 shadow-sm ${getSignalColor(ind.value, ind.target, ind.higherIsBetter)}`}>
            <p className="text-sm font-semibold mb-1">{ind.label}</p>
            <p className="text-xs opacity-70 mb-2">{ind.sub}</p>
            <p className="text-2xl font-bold mb-2">
              {ind.unit === " ฿" ? `฿${ind.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : `${ind.value.toFixed(1)}${ind.unit}`}
            </p>
            <div className="h-2 bg-white/50 rounded-full mb-2">
              <div
                className={`h-2 rounded-full ${getBarColor(ind.value, ind.target, ind.higherIsBetter)}`}
                style={{ width: `${Math.min(100, ind.unit === " ฿" ? (ind.value > 0 ? 100 : 0) : (ind.value / (ind.target * 2)) * 100)}%` }}
              />
            </div>
            <p className="text-xs opacity-80">{ind.tip}</p>
          </div>
        ))}
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

      {/* Desktop — แสดง 2 คอลัมน์เหมือนเดิม */}
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
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]" />
              <select value={assetGroup} onChange={e => setAssetGroup(e.target.value as Asset["asset_group"])}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                {ASSET_GROUPS.map(g => <option key={g.key} value={g.key}>{g.label}</option>)}
              </select>
              <input placeholder="มูลค่า (฿)" type="number" value={assetValue} onChange={e => setAssetValue(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]" />
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowAssetModal(false)} className="flex-1 border border-gray-200 rounded-lg py-2 text-sm hover:bg-gray-50">ยกเลิก</button>
              <button onClick={saveAsset} className="flex-1 bg-[#1D9E75] text-white rounded-lg py-2 text-sm hover:bg-[#178a64]">บันทึก</button>
            </div>
          </div>
        </div>
      )}

      {/* Liability Modal */}
      {showLiabModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">{editLiab ? "แก้ไขหนี้สิน" : "เพิ่มหนี้สินระยะยาว"}</h2>
            <div className="flex flex-col gap-3">
              <input placeholder="ชื่อหนี้สิน เช่น บัตรเครดิต KBank" value={liabName} onChange={e => setLiabName(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]" />
              <select value={liabType} onChange={e => setLiabType(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                {LIABILITY_TYPES.map(t => (
                  <option key={t.key} value={t.key}>{t.label} ({t.term})</option>
                ))}
              </select>
              <input placeholder="ยอดคงเหลือ (฿)" type="number" value={liabBalance} onChange={e => setLiabBalance(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]" />
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowLiabModal(false)} className="flex-1 border border-gray-200 rounded-lg py-2 text-sm hover:bg-gray-50">ยกเลิก</button>
              <button onClick={saveLiab} className="flex-1 bg-[#D85A30] text-white rounded-lg py-2 text-sm hover:bg-red-600">บันทึก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}