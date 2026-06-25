"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { GraduationCap, Megaphone } from "lucide-react"

type Course = {
  id: string
  creator_name: string
  title: string
  description: string
  price: number
  is_free: boolean
  is_sponsored: boolean
  tags: string[]
  rating: number
  url: string
}

const CATEGORIES = ["ทั้งหมด", "การลงทุน", "ออมเงิน", "จัดการหนี้", "ภาษี", "วางแผนชีวิต", "มือใหม่"]

const MOCK_COURSES: Course[] = [
  { id: "1", creator_name: "Money Coach Thailand", title: "เริ่มต้นออมเงินสำหรับมือใหม่", description: "เรียนรู้หลักการออมเงินขั้นพื้นฐาน วางแผนการเงินให้มีประสิทธิภาพ", price: 0, is_free: true, is_sponsored: true, tags: ["มือใหม่", "ออมเงิน"], rating: 4.8, url: "#" },
  { id: "2", creator_name: "Invest Thai", title: "ลงทุนหุ้นไทย เริ่มต้นอย่างไร", description: "คอร์สลงทุนหุ้นสำหรับผู้เริ่มต้น เข้าใจง่าย ลงทุนได้จริง", price: 990, is_free: false, is_sponsored: true, tags: ["การลงทุน"], rating: 4.6, url: "#" },
  { id: "3", creator_name: "Debt Free Club", title: "ปลดหนี้ใน 3 ปี", description: "วิธีจัดการหนี้อย่างเป็นระบบ และวางแผนปลดหนี้ให้สำเร็จ", price: 0, is_free: true, is_sponsored: false, tags: ["จัดการหนี้"], rating: 4.5, url: "#" },
  { id: "4", creator_name: "Tax Expert", title: "ลดหย่อนภาษี 2568 ฉบับสมบูรณ์", description: "รู้จักสิทธิ์ลดหย่อนภาษีทุกประเภท ประหยัดได้มากกว่าที่คิด", price: 590, is_free: false, is_sponsored: false, tags: ["ภาษี"], rating: 4.7, url: "#" },
  { id: "5", creator_name: "Life Planner", title: "วางแผนชีวิตด้วยเงิน", description: "เชื่อมโยงเป้าหมายชีวิตกับการวางแผนการเงิน", price: 0, is_free: true, is_sponsored: false, tags: ["วางแผนชีวิต"], rating: 4.4, url: "#" },
  { id: "6", creator_name: "Fund Master", title: "กองทุนรวม เลือกอย่างไรให้ได้กำไร", description: "วิเคราะห์กองทุนรวม เลือกให้เหมาะกับเป้าหมาย", price: 790, is_free: false, is_sponsored: false, tags: ["การลงทุน", "ออมเงิน"], rating: 4.3, url: "#" },
]

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>(MOCK_COURSES)
  const [activeCategory, setActiveCategory] = useState("ทั้งหมด")
  const [filterFree, setFilterFree] = useState<"all" | "free" | "paid">("all")
  const [search, setSearch] = useState("")

  const sponsored = courses.filter(c => c.is_sponsored)
  const filtered = courses.filter(c => {
    const matchCat = activeCategory === "ทั้งหมด" || c.tags.includes(activeCategory)
    const matchFree = filterFree === "all" ? true : filterFree === "free" ? c.is_free : !c.is_free
    const matchSearch = c.title.toLowerCase().includes(search.toLowerCase()) || c.creator_name.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchFree && matchSearch && !c.is_sponsored
  })

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">คอร์สการเงิน</h1>
      <p className="text-sm text-gray-500 mb-6">เรียนรู้การเงินจากผู้เชี่ยวชาญ</p>

      {/* Sponsored Banner */}
      {sponsored.length > 0 && (
        <div className="mb-6">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">แนะนำ</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sponsored.map(course => (
              <a key={course.id} href={course.url}
                className="bg-gradient-to-r from-[#1D9E75] to-[#378ADD] rounded-2xl p-5 text-white relative overflow-hidden hover:opacity-95 transition-opacity">
                <span className="absolute top-3 right-3 bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">Sponsored</span>
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center mb-3">
  <GraduationCap size={20} className="text-white" />
</div>
                <p className="text-xs opacity-80 mb-1">{course.creator_name}</p>
                <p className="font-bold text-lg mb-1">{course.title}</p>
                <p className="text-sm opacity-80 mb-3">{course.description}</p>
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    {course.tags.map(tag => (
                      <span key={tag} className="bg-white/20 text-xs px-2 py-0.5 rounded-full">{tag}</span>
                    ))}
                  </div>
                  <span className="font-bold">{course.is_free ? "ฟรี" : `฿${course.price}`}</span>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Search & Filter */}
      <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
        <input
          placeholder="ค้นหาคอร์ส หรือชื่อผู้สอน..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
        />
        <div className="flex flex-wrap gap-2 mb-3">
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors ${activeCategory === cat ? "bg-[#1D9E75] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {cat}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {[{ key: "all", label: "ทั้งหมด" }, { key: "free", label: "ฟรี" }, { key: "paid", label: "มีค่าใช้จ่าย" }].map(f => (
            <button key={f.key} onClick={() => setFilterFree(f.key as "all" | "free" | "paid")}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filterFree === f.key ? "border-[#1D9E75] text-[#1D9E75] bg-green-50" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Course Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {filtered.map(course => (
          <a key={course.id} href={course.url}
            className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
            <div className="h-24 bg-gradient-to-r from-gray-100 to-gray-200 flex items-center justify-center">
  <GraduationCap size={40} className="text-gray-400" />
</div>
            <div className="p-4">
              <div className="flex items-center gap-2 mb-2">
                {course.is_free ? (
                  <span className="text-xs bg-green-100 text-[#1D9E75] px-2 py-0.5 rounded-full">ฟรี</span>
                ) : (
                  <span className="text-xs bg-orange-100 text-[#D85A30] px-2 py-0.5 rounded-full">฿{course.price}</span>
                )}
                {course.tags.map(tag => (
                  <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{tag}</span>
                ))}
              </div>
              <p className="font-semibold text-gray-800 mb-1 line-clamp-2">{course.title}</p>
              <p className="text-xs text-gray-500 mb-2 line-clamp-2">{course.description}</p>
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">{course.creator_name}</p>
                <div className="flex items-center gap-1">
                  <span className="text-yellow-400 text-xs">★</span>
                  <span className="text-xs text-gray-600">{course.rating}</span>
                </div>
              </div>
            </div>
          </a>
        ))}

        {/* ลงโฆษณา card */}
        <div className="bg-white rounded-xl shadow-sm border-2 border-dashed border-gray-200 flex flex-col items-center justify-center p-6 text-center hover:border-[#1D9E75] transition-colors cursor-pointer">
          <Megaphone size={32} className="text-gray-400 mb-2" />
          <p className="text-sm font-semibold text-gray-700 mb-1">ลงโฆษณาคอร์สของคุณ</p>
          <p className="text-xs text-gray-400">เข้าถึงผู้ใช้ที่สนใจการเงิน</p>
        </div>
      </div>

      {/* Banner ล่างสุด */}
      <div className="bg-gradient-to-r from-[#378ADD] to-[#8B5CF6] rounded-2xl p-6 text-white text-center">
        <p className="text-lg font-bold mb-1">คุณมีคอร์สการเงินที่อยากแชร์ไหม?</p>
        <p className="text-sm opacity-80 mb-4">เข้าถึงผู้ใช้ที่สนใจการเงินโดยตรง เริ่มต้นฟรี หรืออัปเกรดเพื่อพื้นที่เด่น</p>
        <button className="bg-white text-[#378ADD] font-semibold px-6 py-2 rounded-xl text-sm hover:bg-gray-50 transition-colors">
          ดูแพ็กเกจโฆษณา
        </button>
      </div>
    </div>
  )
}