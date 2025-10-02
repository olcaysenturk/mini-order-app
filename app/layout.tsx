// app/layout.tsx
import './globals.css'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'PERDE KONAĞI',
  description: 'Kategori/Varyant + Sipariş',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>
        <header className="border-b border-gray-200 dark:border-gray-800">
          <div className="container flex items-center gap-3 py-4">
            <Link href="/" className="font-semibold">PERDE KONAĞI</Link>
            <nav className="ml-auto flex gap-2">
              <Link className="btn-secondary" href="/admin">Yönetim</Link>
              <Link className="btn-secondary" href="/order">Yeni Sipariş</Link>
              <Link className="btn-secondary" href="/orders">Siparişler</Link>
            </nav>
          </div>
        </header>
        <main className="container py-6">{children}</main>
      </body>
    </html>
  )
}
