// app/components/AuthedNav.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useEffect, useRef, useState } from 'react'

type NavItem = {
  href: string
  label: string
  icon: React.ReactNode
}

function NavButton({
  item,
  active,
}: {
  item: NavItem
  active: boolean
}) {
  return (
    <Link
      prefetch={false}
      href={item.href}
      aria-current={active ? 'page' : undefined}
      title={item.label}
      className={[
        'inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-sm transition',
        active
          ? 'border-indigo-700 bg-indigo-700 text-white'
          : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2',
      ].join(' ')}
    >
      <span className="size-4" aria-hidden>{item.icon}</span>
      <span className="hidden sm:inline">{item.label}</span>
    </Link>
  )
}

export function AuthedNav() {
  const { status, data } = useSession()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement | null>(null)
  const popRef = useRef<HTMLDivElement | null>(null)

  // rota değişince kapat
  useEffect(() => setOpen(false), [pathname])

  // dışarı tıkla / ESC kapat
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

  if (status !== 'authenticated') return null

  const role = (data?.user as any)?.role as string | undefined
  const isSuperAdmin = role === 'SUPERADMIN'
  const isActive = (href: string) => pathname.startsWith(href)

  const items: NavItem[] = [
    // {
    //   href: '/company',
    //   label: 'Şirketim',
    //   icon: <svg viewBox="0 0 24 24" className="size-4"><path fill="currentColor" d="M19 3H5a2 2 0 0 0-2 2v14l4-4h12a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z"/></svg>,
    // },
    {
      href: '/category',
      label: 'Kategoriler',
      icon: <svg viewBox="0 0 24 24" className="size-4"><path fill="currentColor" d="M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z"/></svg>,
    },
    {
      href: '/orders',
      label: 'Siparişler',
      icon: <svg viewBox="0 0 24 24" className="size-4"><path fill="currentColor" d="M3 6h18v2H3zm0 5h18v2H3zm0 5h12v2H3z"/></svg>,
    },
    {
      href: '/customers',
      label: 'Müşteriler',
      icon: <svg viewBox="0 0 24 24" className="size-4"><path fill="currentColor" d="M12 12a5 5 0 1 0-5-5a5 5 0 0 0 5 5m0 2c-4 0-8 2-8 5v2h16v-2c0-3-4-5-8-5"/></svg>,
    },
    {
      href: '/reports',
      label: 'Raporlar',
      icon: <svg viewBox="0 0 24 24" className="size-4"><path fill="currentColor" d="M3 21V3h2v18zm4 0V10h2v11zm4 0V6h2v15zm4 0V13h2v8zm4 0V8h2v13z"/></svg>,
    },
  ]

  const adminItem: NavItem = {
    href: '/admin/users',
    label: 'Üyeler',
    icon: <svg viewBox="0 0 24 24" className="size-4"><path fill="currentColor" d="M12 7c1.66 0 3-1.34 3-3S13.66 1 12 1S9 2.34 9 4s1.34 3 3 3m-2 2h4l1 3h3l-4 4l1 5l-5-3l-5 3l1-5l-4-4h3z"/></svg>,
  }

  return (
    <div className="flex items-center gap-2">
      {/* Mobile dropdown tetikleyici */}
      <div className="relative sm:hidden">
        <button
          ref={btnRef}
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls="authednav-mobile-menu"
          onClick={() => setOpen(v => !v)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setOpen(v => !v)
            }
          }}
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-700 shadow-sm hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          {/* menu icon */}
          <svg viewBox="0 0 24 24" className={`size-4 transition-transform ${open ? 'rotate-90' : ''}`} aria-hidden>
            <path fill="currentColor" d="M4 7h16v2H4zm0 4h16v2H4zm0 4h10v2H4z" />
          </svg>
          <span>Menü</span>
          {/* caret */}
          <svg viewBox="0 0 24 24" className={`size-4 text-neutral-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden>
            <path fill="currentColor" d="M7 10l5 5 5-5H7z" />
          </svg>
        </button>

        {open && (
          <div
            ref={popRef}
            id="authednav-mobile-menu"
            role="menu"
            aria-label="Gezinti"
            className="absolute left-0 right-auto top-full z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-lg"
          >
            <nav className="py-2 max-h-[70vh] overflow-y-auto">
              {[...items, ...(isSuperAdmin ? [adminItem] as NavItem[] : [])].map((it) => {
                const active = isActive(it.href) || (it.href.startsWith('/admin') && pathname.startsWith('/admin'))
                return (
                  <Link
                    key={it.href}
                    prefetch={false}
                    role="menuitem"
                    href={it.href}
                    onClick={() => setOpen(false)}
                    className={[
                      'flex items-center gap-3 px-3 py-2 text-sm transition',
                      active ? 'bg-neutral-900 text-white' : 'text-neutral-700 hover:bg-neutral-50',
                    ].join(' ')}
                  >
                    <span className="size-4" aria-hidden>{it.icon}</span>
                    <span>{it.label}</span>
                  </Link>
                )
              })}
            </nav>
          </div>
        )}
      </div>

      {/* Desktop yatay nav */}
      <nav
        className="
          -mx-1 hidden items-center gap-1 overflow-x-auto sm:flex sm:gap-2
          [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden
        "
        aria-label="Uygulama gezinti"
      >
        {items.map((it) => (
          <NavButton key={it.href} item={it} active={isActive(it.href)} />
        ))}

        {isSuperAdmin && (
          <>
            <span className="hidden sm:inline text-neutral-300">·</span>
            <NavButton item={adminItem} active={pathname.startsWith('/admin')} />
          </>
        )}
      </nav>
    </div>
  )
}
