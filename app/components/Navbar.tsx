"use client"
import { usePathname } from "next/navigation"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

export default function Navbar() {
    const pathname = usePathname()
    const router = useRouter()

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push("/login")
    }

    return (
        <nav className="flex gap-4 bg-gray-500 p-4">
            <Link href="/" className={pathname === "/" ? "text-white font-bold" : "text-gray-300"}>Dashboard</Link>
            <Link href="/transaction" className={pathname === "/transaction" ? "text-white font-bold" : "text-gray-300"}>Transaction</Link>
            <Link href="/planning" className={pathname === "/planning" ? "text-white font-bold" : "text-gray-300"}>Planning</Link>
            <Link href="/business" className={pathname === "/business" ? "text-white font-bold" : "text-gray-300"}>Business</Link>
            <Link href="/ai" className={pathname === "/ai" ? "text-white font-bold" : "text-gray-300"}>AI</Link>
            <button onClick={handleLogout} className="text-gray-300 hover:text-white ml-auto">
                Logout
            </button>
        </nav>
    )
}