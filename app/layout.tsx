// app/layout.tsx (LIGHT MODE)
import "./globals.css";
import type { Metadata, Viewport } from "next";
import Link from "next/link";
import Providers from "./providers";
import { UserMenu } from "./components/UserMenu";   // ✅ components
import { AuthedNav } from "./components/AuthedNav"; // ✅ components
import { Toaster } from 'sonner'
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import ImpersonationBanner from "./components/ImpersonationBanner";



export const metadata: Metadata = {
  title: {
    default: "PERDEXA",
    template: "%s — PERDEXA",
  },
  description: "Kategori/Ürün + Sipariş",
  metadataBase: new URL("https://perde-konagi.local"),
  openGraph: {
    title: "PERDEXA",
    description: "Kategori/Ürün + Sipariş",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "PERDEXA",
    description: "Kategori/Ürün + Sipariş",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  return (
    <html lang="tr">
      <body className="min-h-dvh bg-white text-neutral-900 antialiased">
        <Providers>
          {/* ======= Sticky App Header (Light) ======= */}
          <ImpersonationBanner />
          <header className="sticky top-0 z-40 border-b border-neutral-200/80 bg-white/70 backdrop-blur-md print:hidden">
            <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="flex h-16 items-center gap-3 justify-between ">
                {/* Brand */}
                <Link href="/" className="font-extrabold tracking-tight text-base sm:text-3xl">
                  PERDE<span className="text-indigo-600">XA</span>
                </Link>

              <div className="flex">

                {/* Primary nav (authed routes) */}
                <nav className="ml-6 md:flex items-center gap-4 text-sm text-neutral-600">
                  <AuthedNav  />
                </nav>

                {/* Right side */}
                <div className="ml-2 md:ml-8 flex items-center gap-2">
                  <UserMenu />
                </div>
              </div>
              </div>
            </div>
          </header>
          

          {/* ======= Page Content ======= */}
          <main id="content" className="relative p-8">
            {children}
           
            <Toaster 
              richColors        // daha canlı renkler
              position="bottom-right"
              className="print:hidden"
              theme="light"    // 'light' | 'dark' | 'system'
              closeButton
              expand            // aynı tip toasları gruplayıp genişletir
              duration={3000}   // varsayılan süre
            />
          </main>

          {/* ======= Footer (Light) ======= */}
           <footer className="relative z-10 border-t border-neutral-200 bg-white print:hidden">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-neutral-600">
              <span className="font-semibold">Perdexa</span>
              <span className="hidden sm:inline">•</span>
              <span className="text-neutral-500">Perde Sipariş Yönetimi</span>
            </div>
            <nav aria-label="Alt menü" className="flex items-center gap-4 text-sm">
              <Link prefetch={false} href="/legal/privacy" className="text-neutral-600 hover:text-neutral-900">
                Gizlilik
              </Link>
              <Link prefetch={false} href="/legal/terms" className="text-neutral-600 hover:text-neutral-900">
                Şartlar
              </Link>
              <Link prefetch={false} href="/contact" className="text-neutral-600 hover:text-neutral-900">
                İletişim
              </Link>
            </nav>
          </div>
        </div>
      </footer>
        </Providers>
      </body>
    </html>
  );
}
