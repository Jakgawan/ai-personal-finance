"use client"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"

export default function Business() {

    const [businesses, setBusinesses] = useState<any[]>([])
    const [selectedBusiness, setSelectedBusiness] = useState<any>(null)
    const [newBusinessName, setNewBusinessName] = useState("")
    const [transactions, setTransactions] = useState<any[]>([])
    const [name, setName] = useState("")
    const [amount, setAmount] = useState("")
    const [date, setDate] = useState("")
    const [type, setType] = useState("income")

    const fetchBusinesses = async () => { 
    const { data: { user } } = await supabase.auth.getUser()
     const { data } = await supabase
        .from("businesses")
        .select("*")
        .eq("user_id", user?.id)
    
    if (data) {
        setBusinesses(data as any[])
    }
}
    const fetchTransactions = async (businessId: number) => {
    const { data } = await supabase
        .from("business_transactions")
        .select("*")
        .eq("business_id", businessId)
    
    if (data) {
        setTransactions(data as any[])
    }
}
    useEffect(() => {
    fetchBusinesses()
}, [])

    const handleAddBusiness = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase
        .from("businesses")
        .insert({ name: newBusinessName, user_id: user?.id })
    setNewBusinessName("")
    fetchBusinesses()
}
    const handleSubmit = async () => {
    if (!selectedBusiness) return
    
    await supabase
        .from("business_transactions")
        .insert({ 
            name, 
            amount, 
            date, 
            type, 
            business_id: selectedBusiness.id,
            user_id: selectedBusiness.user_id
        })
    
    setName("")
    setAmount("")
    setDate("")
    setType("income")
    fetchTransactions(selectedBusiness.id)
}
    return (
    <main className="p-8">
        <h1 className="text-2xl font-bold">Business</h1>

        {/* เพิ่มธุรกิจใหม่ */}
        <div className="mt-6 flex gap-2">
            <input
                type="text"
                placeholder="ชื่อธุรกิจ"
                value={newBusinessName}
                onChange={(e) => setNewBusinessName(e.target.value)}
                className="flex-1 border rounded-lg p-2"
            />
            <button
                onClick={handleAddBusiness}
                className="bg-green-500 text-white rounded-lg px-4 hover:bg-green-600"
            >
                เพิ่มธุรกิจ
            </button>
        </div>

        {/* แสดงรายการธุรกิจ */}
        <div className="mt-4 flex gap-2">
            {businesses.map((business, index) => (
                <button
                    key={index}
                    onClick={() => {
                        setSelectedBusiness(business)
                        fetchTransactions(business.id)
                    }}
                    className={`px-4 py-2 rounded-lg ${selectedBusiness?.id === business.id ? "bg-blue-500 text-white" : "bg-gray-200"}`}
                >
                    {business.name}
                </button>
            ))}
        </div>
        {selectedBusiness && (
            <div className="mt-6">
                <h2 className="text-xl font-bold">{selectedBusiness.name}</h2>
                
                <div className="mt-4">
                    <label className="text-sm text-gray-500">รายการ</label>
                    <input type="text" placeholder="ชื่อรายการ" value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full border rounded-lg p-2 mt-1" />
                </div>

                <div className="mt-4">
                    <label className="text-sm text-gray-500">จำนวนเงิน</label>
                    <input type="number" placeholder="0" value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-full border rounded-lg p-2 mt-1" />
                </div>

                <div className="mt-4">
                    <label className="text-sm text-gray-500">วันที่</label>
                    <input type="date" value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full border rounded-lg p-2 mt-1" />
                </div>

                <div className="mt-4">
                    <label className="text-sm text-gray-500">ประเภท</label>
                    <select value={type} onChange={(e) => setType(e.target.value)}
                        className="w-full border rounded-lg p-2 mt-1">
                        <option value="income">Income</option>
                        <option value="expense">Expense</option>
                    </select>
                </div>

                <button onClick={handleSubmit}
                    className="mt-6 w-full bg-blue-500 text-white rounded-lg p-2 hover:bg-blue-600">
                    บันทึก
                </button>

                {/* รายการ */}
                <div className="mt-8">
                    {transactions.map((item, index) => (
                        <div key={index} className="bg-white rounded-lg p-4 shadow mt-2 flex justify-between items-center">
                            <div>
                                <p>{item.name} - ฿{item.amount}</p>
                                <p className="text-sm text-gray-500">{item.date} · {item.type}</p>
                            </div>
                            <button
                                onClick={async () => {
                                    await supabase.from("business_transactions").delete().eq("id", item.id)
                                    fetchTransactions(selectedBusiness.id)
                                }}
                                className="text-red-500 hover:text-red-700"
                            >
                                ลบ
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        )}
    </main>
)
}