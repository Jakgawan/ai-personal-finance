import Link  from "next/link";

export default function Navbar() {
    return (
<nav>
    <Link href="/">Dashboard</Link>
    <Link href="/transaction">Transaction</Link>
    <Link href="/planning">Planning</Link>
    <Link href="/business">Business</Link>
    <Link href="/ai">AI</Link>
</nav>
    )
}
