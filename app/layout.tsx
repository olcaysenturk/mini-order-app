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
import { absoluteUrl, getOgImage, siteMetadata } from "@/app/lib/seo";



export const metadata: Metadata = {
  metadataBase: new URL(siteMetadata.siteUrl),
  title: {
    default: siteMetadata.shortName,
    template: "%s — Perdexa",
  },
  description: siteMetadata.description,
  keywords: siteMetadata.keywords,
  applicationName: siteMetadata.shortName,
  authors: [{ name: siteMetadata.name, url: siteMetadata.siteUrl }],
  creator: siteMetadata.name,
  publisher: siteMetadata.name,
  category: "Business SaaS",
  alternates: {
    canonical: absoluteUrl(),
  },
  openGraph: {
    type: "website",
    locale: siteMetadata.locale,
    url: siteMetadata.siteUrl,
    siteName: siteMetadata.name,
    title: siteMetadata.title,
    description: siteMetadata.description,
    emails: [siteMetadata.contactEmail],
    images: [
      {
        url: getOgImage(),
        width: 1200,
        height: 630,
        alt: "Perdexa perde sipariş yönetimi ekran önizlemesi",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteMetadata.title,
    description: siteMetadata.description,
    images: [getOgImage()],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-video-preview": -1,
      "max-snippet": -1,
    },
  },
  verification: {
    other: {
      "linkedin:owner": siteMetadata.socialProfiles.linkedin,
    },
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
