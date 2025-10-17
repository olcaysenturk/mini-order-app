// app/components/UserMenu.tsx
'use client'

import Link from 'next/link'
import { signOut, useSession } from 'next-auth/react'
import { useEffect, useRef, useState } from 'react'

export function UserMenu() {
  const { data, status } = useSession()
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement | null>(null)
  const popRef = useRef<HTMLDivElement | null>(null)

  // Dışarı tıklayınca / ESC basınca kapat (her render'da aynı sırada çalışan hook)
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!open) return
      const t = e.target as Node
      if (popRef.current?.contains(t) || btnRef.current?.contains(t)) return
      setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (!open) return
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // ---- Türetilen değerler (hooks DEĞİL) ----
  const role = (data?.user as any)?.role as string | undefined
  const isSuper = role === 'SUPERADMIN'
  const isPro = (data as any)?.isPro === true
  const name = data?.user?.name || data?.user?.email || 'Kullanıcı'
  const initials = (() => {
    const s = (data?.user?.name || data?.user?.email || '').trim()
    if (!s) return 'U'
    const parts = s.split(/\s+/).filter(Boolean)
    const a = parts[0]?.[0] || ''
    const b = parts.length > 1 ? parts[parts.length - 1][0] : ''
    const x = (a + b) || a || 'U'
    return x.toUpperCase()
  })()

  // ---- Koşullu dönüşler (hooks'tan SONRA) ----
  if (status === 'loading') {
    return <div className="h-9 w-36 rounded-full bg-neutral-200 animate-pulse" aria-hidden />
  }

  if (!data?.user) {
    return (
      <Link
        className="inline-flex h-9 items-center rounded-xl border border-neutral-200 bg-white px-4 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        href="/login"
      >
        Giriş
      </Link>
    )
  }

  return (
    <div className="relative">
      {/* Tetik butonu */}
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setOpen((v) => !v)
          }
        }}
        className="group inline-flex h-9 items-center gap-2 rounded-xl border border-neutral-200 bg-white pl-2 pr-2.5 text-sm shadow-sm hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
      >
        {/* Avatar */}
        <span className="grid size-6 place-items-center rounded-full bg-neutral-200 text-[10px] font-bold text-neutral-700">
          {initials} 
        </span>
        <span className='hidden md:flex'>Hesabım</span>
        {/* İsim */}
       
        {/* Rozetler */}
        {/* <span className="hidden md:flex items-center gap-1">
          {isPro ? (
            <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
              PRO
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-700">
              FREE
            </span>
          )}
          {role && (
            <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-700">
              {role}
            </span>
          )}
        </span> */}
        {/* Caret */}
        <svg
          className={`size-4 text-neutral-400 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path fill="currentColor" d="M7 10l5 5 5-5H7z" />
        </svg>
      </button>

      {/* Açılır menü */}
      {open && (
        <div
          ref={popRef}
          role="menu"
          aria-label="Kullanıcı menüsü"
          className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-lg"
        >
          <div className="px-3 py-3">
            <div className="text-sm font-semibold text-neutral-800 truncate">{name}</div>
            <div className="mt-0.5 text-xs text-neutral-500 truncate">{data.user.email}</div>
            <div className="mt-2 flex items-center gap-1">
              {isPro ? (
                <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                  PRO
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-700">
                  Ücretsiz Deneme
                </span>
              )}
              {/* {role && (
                <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-700">
                  {role}
                </span>
              )} */}
            </div>
          </div>

          <div className="h-px bg-neutral-100" />

          <div className="py-1" onClick={() => setOpen(false)}>
            <Link
              prefetch={false}
              role="menuitem"
              href="/company"
              className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
            >
              <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                <path fill="currentColor" d="M3 6h18v2H3zm0 5h18v2H3zm0 5h12v2H3z" />
              </svg>
              Hesap Bilgileri
            </Link>

            {isSuper && (
              <Link
                prefetch={false}
                role="menuitem"
                href="/admin/users"
                className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
              >
                <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                  <path fill="currentColor" d="M3 4h18v2H3zm0 14h18v2H3zM5 8h14v8H5z" />
                </svg>
                Kullanıcı Yönetimi
              </Link>
            )}
          </div>

          <div className="h-px bg-neutral-100" />

          <div className="p-2">
            <button
              role="menuitem"
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                <path fill="currentColor" d="M10 17v-2h4v2h-4zm1-14h2v8h-2V3zM5 21h14v-2H5v2z" />
              </svg>
              Çıkış
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
