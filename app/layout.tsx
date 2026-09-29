"use client"

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/app/components/Sidebar"
import Toast from "@/app/components/Toast"
import ServiceWorkerRegister from "@/app/components/ServiceWorkerRegister"
import { APP_NAME } from "@/app/manifest"
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
      <head>
        <meta name="theme-color" content="#1D9E75" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content={APP_NAME} />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <RecurringProcessor />
        <ServiceWorkerRegister />
        <Sidebar>{children}</Sidebar>
        <Toast />
      </body>
    </html>
  );
}