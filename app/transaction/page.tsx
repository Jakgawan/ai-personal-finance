"use client"
import { supabase } from "@/lib/supabase"
import { useState, useEffect } from "react"
export  default function Transaction() {
    const [name, setName] = useState("")
    const [amount, setAmount] = useState("")
    const [date, setDate] = useState("")
    const [type, setType] = useState("income")
    const [ transaction, setTransaction ] = useState<any[]>([])
    const [category, setCategory] = useState("")
    const [categories, setCategories] = useState<any[]>([])
    const [newCategory, setNewCategory] = useState("")
    const fetchTransaction = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user?.id)
    
    if (data) {
        setTransaction(data as any[])
    }
}
    const fetchCategories = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase
        .from("categories") 
        .select("*")
        .eq("user_id", user?.id)
    if (data) {
        setCategories(data as any[])
    }
}

    useEffect(() => {
    fetchTransaction()
    fetchCategories()
}, [])
    const [editId, setEditId] = useState<number | null>(null)

    const handleSubmit = async () => {
        
    const { data: { user } } = await supabase.auth.getUser()
    
    if (editId) {
        // Update
        await supabase
            .from("transactions")
            .update({ name, amount, date, type })
            .eq("id", editId)
        setEditId(null)
    } else {
    // Insert ใหม่
    await supabase
        .from("transactions")
        .insert({ name, amount, date, type, category, user_id: user?.id })  // ← เพิ่ม category
}
    
     setName("")
     setAmount("")
     setDate("")
     setType("income")
     fetchTransaction()
}
    const handleDelete = async (id: number) => {
    await supabase
        .from("transactions")
        .delete()
        .eq("id", id)
    fetchTransaction()
}

const handleAddCategory = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase
        .from("categories")
        .insert({ name: newCategory, user_id: user?.id })
    setNewCategory("")
    fetchCategories()
}
    
  

    return (
        <main className="p-8">
            <h1 className="text-2xl font-bold">Transaction</h1>
            <div className="mt-6">
                <label className="text-sm text-gray-500">List Name</label>
                <input 
                    type="text"
                    placeholder="Food"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full border rounded-lg p-2 mt-1"
            
                />
            </div>
            <div className="mt-6">
                <label className="text-sm text-gray-500">Number</label>
                <input
                    type="number"
                    placeholder="123"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full border rounded-lg p-2 mt-1"
                    />
            </div>
            <div className="mt-6">
                <label className="text-sm text-gray-500">Date</label>
                <input
                    type="date"
                    placeholder="1/1/1"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full border rounded-lg p-2 mt-1"
                    />
            </div>
            <div className="mt-6">
                <label className="text-sm text-gray-500">Select</label>
              <select 
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full border rounded-lg p-2 mt-1">
                     <option value="income">Income</option>
                    <option value="expense">Expense</option>
                </select>
            </div>
            <div className="mt-6">
    <label className="text-sm text-gray-500">หมวดหมู่</label>
             <select
                     value={category}
                     onChange={(e) => setCategory(e.target.value)}
                    className="w-full border rounded-lg p-2 mt-1"
    >
        <option value="">-- เลือกหมวดหมู่ --</option>
        {categories.map((cat, index) => (
            <option key={index} value={cat.name}>{cat.name}</option>
        ))}
                </select>
            </div>
            <div className="mt-4 flex gap-2">
    <input
        type="text"
        placeholder="เพิ่มหมวดหมู่ใหม่"
        value={newCategory}
        onChange={(e) => setNewCategory(e.target.value)}
        className="flex-1 border rounded-lg p-2"
    />
    <button
        onClick={handleAddCategory}
        className="bg-green-500 text-white rounded-lg px-4 hover:bg-green-600"
    >
        เพิ่ม
    </button>
</div>
            <div>
                <button 
                    onClick={handleSubmit}
                    className="mt-6 w-full bg-blue-500 text-white rounded-lg p-2 hover:bg-blue-600">
                     Record
            </button>
            </div>
        <div className="mt-8">
            {transaction.map((item, index) => (
             <div key={index} className="bg-white rounded-lg p-4 shadow mt-2 flex justify-between items-center">
            <div>
                <p>{item.name} - ฿{item.amount}</p>
                <p className="text-sm text-gray-500">{item.date} . {item.type} . {item.category}</p>
            </div>
            <button
                onClick={() => handleDelete(item.id)}
                className="text-red-500 hover:text-red-700"
      >
        ลบ
            </button>
            <button
    onClick={() => {
        setEditId(item.id)
        setName(item.name)
        setAmount(item.amount)
        setDate(item.date)
        setType(item.type)
    }}
             className="text-blue-500 hover:text-blue-700 mr-2"
>
                     แก้ไข
            </button>
    </div>
  ))}
</div>
        </main>
    )
}