import Link  from "next/link";

export default function Navbar() {
    return (
<nav className="flex gap-4 bg-gray-500 p-4">
    <Link href="/" className="text-white hover:text-gray-300">Dashboard</Link>
    <Link href="/transaction" className="text-white hover:text-gray-300">Transaction</Link>
    <Link href="/planning" className="text-white hover:text-gray-300">Planning</Link>
    <Link href="/business" className="text-white hover:text-gray-300">Business</Link>
    <Link href="/ai" className="text-white hover:text-gray-300">AI</Link>
</nav>
    )
}
