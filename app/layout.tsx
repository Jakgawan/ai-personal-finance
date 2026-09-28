"use client"

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/app/components/Sidebar"
import Toast from "@/app/components/Toast"
import { useEffect } from "react"
import { processDueRecurring } from "@/lib/recurring"

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
    // ประมวลผลรายการซ้ำที่ถึงกำหนดแล้ว (มี guard กันสร้างซ้ำ + โชว์ toast เองถ้ามี error อยู่ใน lib/recurring.ts)
    processDueRecurring()
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
        <Toast />
      </body>
    </html>
  );
}