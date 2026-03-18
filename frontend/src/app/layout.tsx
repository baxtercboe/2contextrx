import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import { HIPAAComplianceBar } from "@/components/layout/HIPAABar";

export const metadata: Metadata = {
  title: "ContextRx — Privacy-Preserved Healthcare Context Marketplace",
  description:
    "The world's first autonomous marketplace connecting healthcare data providers with AI applications via MCP.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen font-sans flex flex-col">
        <Navbar />
        <main className="flex-1">{children}</main>
        <HIPAAComplianceBar />
      </body>
    </html>
  );
}
