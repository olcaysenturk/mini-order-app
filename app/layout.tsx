// app/layout.tsx (LIGHT MODE)
import "./globals.css";
import type { Metadata, Viewport } from "next";
import Link from "next/link";
import Providers from "./providers";
import { UserMenu } from "./components/UserMenu";   // ✅ components
import { AuthedNav } from "./components/AuthedNav"; // ✅ components
import { Toaster } from 'sonner'

export const metadata: Metadata = {
  title: {
    default: "PERDEXA",
    template: "%s — PERDEXA",
  },
  description: "Kategori/Varyant + Sipariş",
  metadataBase: new URL("https://perde-konagi.local"),
  openGraph: {
    title: "PERDEXA",
    description: "Kategori/Varyant + Sipariş",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "PERDEXA",
    description: "Kategori/Varyant + Sipariş",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="min-h-dvh bg-white text-neutral-900 antialiased">
        <Providers>
          {/* ======= Sticky App Header (Light) ======= */}
          <header className="sticky top-0 z-40 border-b border-neutral-200/80 bg-white/70 backdrop-blur-md print:hidden">
            <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="flex h-16 items-center gap-3">
                {/* Brand */}
                <Link href="/" className="font-extrabold tracking-tight text-base sm:text-lg">
                  PERDE<span className="text-indigo-600">XA</span>
                </Link>

                {/* Primary nav (authed routes) */}
                <nav className="ml-6 hidden md:flex items-center gap-4 text-sm text-neutral-600">
                  <AuthedNav />
                </nav>

                {/* Right side */}
                <div className="ml-auto flex items-center gap-2">
                  <UserMenu />
                </div>
              </div>
            </div>
          </header>

          {/* ======= Page Content ======= */}
          <main id="content" className="relative min-h-[calc(100vh-135px)] p-8">
            {children}
            <Toaster 
              richColors        // daha canlı renkler
              position="bottom-right"
              theme="system"    // 'light' | 'dark' | 'system'
              closeButton
              expand            // aynı tip toasları gruplayıp genişletir
              duration={3000}   // varsayılan süre
            />
          </main>

          {/* ======= Footer (Light) ======= */}
          <footer className="border-t border-neutral-200/80 bg-white/70 backdrop-blur print:hidden flex items-end">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 text-sm text-neutral-600 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div>© {new Date().getFullYear()} Perde Konağı</div>
              <div className="flex items-center gap-4">
                <Link href="/login" className="hover:text-indigo-600">Giriş</Link>
                <Link href="/register" className="hover:text-indigo-600">Kaydol</Link>
                <a href="#ozellikler" className="hover:text-indigo-600">Özellikler</a>
              </div>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
