"use client"
import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"

export default function Login() {
    const [email, setEmail] = useState("")
    const [password, setPassword] =useState("")
    const router = useRouter()
    const [message, setMessage] = useState("")
    const [showPassword, setShowPassword] = useState(false)

    const handleLogin = async () => {
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password
        })
        if (error) {
            setMessage("Email หรือ Password ไม่ถูกต้อง")
        } else {
             router.push("/")  // redirect ไป Dashboard
        }
    }
    return (
        <main className="p-8 max-w-md mx-auto">
            <h1 className="text-2xl font-bold">Login</h1>
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
                {message && <p className="mt-4 text-red-500">{message}</p>}
            <button
            onClick={handleLogin}
            className="mt-6 w-full bg-blue-500 text-white rounded-lg p-2 hover:bg-blue-600"
            >
                Login
            </button>
            <p className="mt-4 text-center text-sm text-gray-500">
  ยังไม่มีบัญชี?{" "}
  <a href="/register" className="text-[#1D9E75] hover:underline font-medium">
    สมัครสมาชิก
  </a>
</p>
        </main>
    )
}