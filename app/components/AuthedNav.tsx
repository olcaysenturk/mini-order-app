// app/components/AuthedNav.tsx
'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'

export function AuthedNav() {
  const { status } = useSession()
  if (status !== 'authenticated') return null

  return (
    <nav className="flex gap-2">
      <Link className="btn-secondary" href="/admin">Yönetim</Link>
      <Link className="btn-secondary" href="/order">Yeni Sipariş</Link>
      <Link className="btn-secondary" href="/orders">Siparişler</Link>
      <Link className="btn-secondary" href="/customers">Kullanıcılar</Link>
    </nav>
  )
}
