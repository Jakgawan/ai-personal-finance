"use client"

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/app/components/Sidebar"
import { useEffect } from "react"
import { supabase } from "@/lib/supabase"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

function RecurringProcessor() {
  useEffect(() => {
    const process = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const today = new Date().toISOString().split("T")[0]
      const { data } = await supabase
        .from("recurring_transactions")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .lte("next_date", today)

      for (const item of data || []) {
        if (item.business_id) {
          await supabase.from("business_transactions").insert({
            user_id: user.id,
            business_id: item.business_id,
            name: item.name,
            amount: item.amount,
            type: item.type,
            category: item.category,
            date: item.next_date,
          })
        } else {
          await supabase.from("transactions").insert({
            user_id: user.id,
            name: item.name,
            amount: item.amount,
            type: item.type,
            category: item.category,
            date: item.next_date,
            note: "สร้างอัตโนมัติจากรายการซ้ำ",
          })
        }

        const d = new Date(item.next_date)
        if (item.cycle === "monthly") d.setMonth(d.getMonth() + 1)
        if (item.cycle === "weekly") d.setDate(d.getDate() + 7)
        if (item.cycle === "yearly") d.setFullYear(d.getFullYear() + 1)

        await supabase
          .from("recurring_transactions")
          .update({ next_date: d.toISOString().split("T")[0] })
          .eq("id", item.id)
      }
    }
    process()
  }, [])

  return null
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <RecurringProcessor />
        <Sidebar>{children}</Sidebar>
      </body>
    </html>
  );
}