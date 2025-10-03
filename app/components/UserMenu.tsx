// app/components/UserMenu.tsx
'use client'

import Link from 'next/link'
import { signOut, useSession } from 'next-auth/react'

export function UserMenu() {
  const { data, status } = useSession()

  if (status === 'loading') {
    return <span className="text-sm text-gray-600">Yükleniyor…</span>
  }

  if (!data?.user) {
    return <Link className="btn-secondary" href="/login">Giriş</Link>
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm">Merhaba, {data.user.name || data.user.email}</span>
      <button
        className="btn-secondary"
        onClick={() => signOut({ callbackUrl: '/login' })}
      >
        Çıkış
      </button>
    </div>
  )
}
