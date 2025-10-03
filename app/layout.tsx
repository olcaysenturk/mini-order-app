// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import Providers from "./providers";
import { UserMenu } from "./components/UserMenu";   // ✅ components
import { AuthedNav } from "./components/AuthedNav"; // ✅ components

export const metadata: Metadata = {
  title: "PERDE KONAĞI",
  description: "Kategori/Varyant + Sipariş",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>
        <Providers>
          <header className="border-b border-gray-200 print:hidden">
            <div className="container flex justify-between items-center gap-3 py-4">
              <Link href="/" className="font-extrabold tracking-tight text-lg">
                PERDE <span className="text-indigo-600">KONAĞI</span>
              </Link>

              {/* Sağ taraf: nav + kullanıcı menüsü */}
              <div className="ml-auto flex items-center gap-3">
                <AuthedNav />
                <UserMenu />
              </div>
            </div>
          </header>

          <main className="container py-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
