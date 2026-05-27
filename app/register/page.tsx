"use client"
import { useState } from "react"
import { supabase } from "@/lib/supabase"

export default function Register() {
    const [email, setEmail] = useState("")
    const [password, setPassword] =useState("")
    const [message, setMessage] = useState("")
    const [showPassword, setShowPassword] = useState(false)

    const handleRegister = async () => {
        const { error } = await supabase.auth.signUp({
            email,
            password
        })
        if (error) {
            console.log(error)
        } else {
            setMessage("สมัครสมาชิกสำเร็จ!")
}
    }
    return (
        <main className="p-8 max-w-md mx-auto">
            <h1 className="text-2xl font-bold">Register</h1>
            <div className="mt-6">
                <label className="text-sm text-gray-500">Email</label>
                <input
                    type="email"
                    placeholder="example@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full border rounded-lg p-2 mt-1"
                />
            </div>
            <div className="mt-4">
                <label className="text-sm text-gray-500">Password</label>
                <input
                    type={showPassword ? "text" : "password"}
                    placeholder="********"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full border rounded-lg p-2 mt-1"
                    />
            </div>
            <button onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? "ซ่อน" : "แสดง"}
            </button>
            {message && (
  <div className="mt-4">
    <p className="text-green-500">{message}</p>
    <a href="/login" className="block mt-2 text-center text-[#1D9E75] hover:underline font-medium text-sm">
      เข้าสู่ระบบเลย →
    </a>
  </div>
)}

<button
  onClick={handleRegister}
  className="mt-6 w-full bg-blue-500 text-white rounded-lg p-2 hover:bg-blue-600"
>
  Register
</button>

<p className="mt-4 text-center text-sm text-gray-500">
  มีบัญชีแล้ว?{" "}
  <a href="/login" className="text-[#1D9E75] hover:underline font-medium">
    เข้าสู่ระบบ
  </a>
</p>
        </main>
    )
}
