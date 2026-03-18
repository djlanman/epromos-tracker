import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ePromos Order Entry Tracker",
  description: "Time study and order entry process tracker for ePromos",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <header className="bg-[#003087] text-white shadow-md">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-[#FF6B00]">e</span>
              <span className="text-lg font-semibold tracking-wide">
                ePromos Order Entry Tracker
              </span>
            </div>
            <nav className="flex gap-6 text-sm font-medium">
              <a href="/" className="hover:text-[#FF6B00] transition-colors">
                Process Tracker
              </a>
              <a
                href="/entry-log"
                className="hover:text-[#FF6B00] transition-colors"
              >
                Entry Log
              </a>
              <a
                href="/employees"
                className="hover:text-[#FF6B00] transition-colors"
              >
                Employees
              </a>
            </nav>
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
