// app/components/UserMenu.tsx
"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

export function UserMenu() {
  const { data, status } = useSession();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);

  // ▼ Guests (logged-out) için mobil menü state/ref
  const [guestOpen, setGuestOpen] = useState(false);
  const guestBtnRef = useRef<HTMLButtonElement | null>(null);
  const guestPopRef = useRef<HTMLDivElement | null>(null);

  // Dışarı tıklayınca / ESC basınca kapat
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (open) {
        if (popRef.current?.contains(t) || btnRef.current?.contains(t)) return;
        setOpen(false);
      }
      if (guestOpen) {
        if (guestPopRef.current?.contains(t) || guestBtnRef.current?.contains(t)) return;
        setGuestOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (open) setOpen(false);
        if (guestOpen) setGuestOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, guestOpen]);

  // ---- Türetilen değerler ----
  const role = (data?.user as any)?.role as string | undefined;
  const isSuper = role === "SUPERADMIN";
  const isPro = (data as any)?.isPro === true;
  const name = data?.user?.name || data?.user?.email || "Kullanıcı";
  const initials = (() => {
    const s = (data?.user?.name || data?.user?.email || "").trim();
    if (!s) return "U";
    const parts = s.split(/\s+/).filter(Boolean);
    const a = parts[0]?.[0] || "";
    const b = parts.length > 1 ? parts[parts.length - 1][0] : "";
    const x = a + b || a || "U";
    return x.toUpperCase();
  })();

  // ---- Koşullu dönüşler ----
  if (status === "loading") {
    return (
      <div
        className="h-9 w-36 rounded-full bg-neutral-200 animate-pulse"
        aria-hidden
      />
    );
  }

  // ▼ GUEST (oturumsuz) — mobile uyumlu
  if (!data?.user) {
    return (
      <div className="flex items-center gap-2">
        {/* md ve üzeri: mevcut üç link yan yana */}
        <div className="hidden md:flex items-center gap-2">
          <Link
            className="inline-flex h-9 items-center rounded-xl border border-neutral-200 bg-white px-4 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            href="/about-us"
          >
            Hakkımızda
          </Link>
          <Link
            className="inline-flex h-9 items-center rounded-xl border border-neutral-200 bg-white px-4 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            href="/contact"
          >
            İletişim
          </Link>
          <Link
            className="inline-flex h-9 items-center rounded-xl border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
            href="/auth/login"
          >
            Giriş
          </Link>
        </div>

        {/* mobil: büyük bir “Giriş” + hamburger altında diğerleri */}
        <div className="flex md:hidden items-center gap-2">
          <Link
            className="inline-flex h-10 items-center rounded-xl border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-800 shadow-sm active:scale-[0.99]"
            href="/auth/login"
          >
            Giriş
          </Link>

          <div className="relative">
            <button
              ref={guestBtnRef}
              type="button"
              aria-label="Diğer bağlantılar menüsü"
              aria-haspopup="menu"
              aria-expanded={guestOpen}
              onClick={() => setGuestOpen(v => !v)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setGuestOpen(v => !v);
                }
              }}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-200 bg-white shadow-sm hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 active:scale-[0.99]"
            >
              {/* Hamburger icon */}
              <svg viewBox="0 0 24 24" className="size-5 text-neutral-700" aria-hidden>
                <path fill="currentColor" d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z" />
              </svg>
            </button>

            {guestOpen && (
              <div
                ref={guestPopRef}
                role="menu"
                aria-label="Diğer bağlantılar"
                className="absolute right-0 z-50 mt-2 w-48 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-lg"
              >
                <div className="py-1">
                  <Link
                    prefetch={false}
                    role="menuitem"
                    href="/about-us"
                    className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                    onClick={() => setGuestOpen(false)}
                  >
                    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                      <path fill="currentColor" d="M12 12a5 5 0 1 0-5-5a5 5 0 0 0 5 5m0 2c-4 0-8 2-8 5v2h16v-2c0-3-4-5-8-5"/>
                    </svg>
                    Hakkımızda
                  </Link>
                  <Link
                    prefetch={false}
                    role="menuitem"
                    href="/contact"
                    className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                    onClick={() => setGuestOpen(false)}
                  >
                    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                      <path fill="currentColor" d="M21 8V7l-3 2l-3-2v1l3 2zM3 5h18v14H3zM5 7v10h14V7z"/>
                    </svg>
                    İletişim
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
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
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
        className="group inline-flex h-9 items-center gap-2 rounded-xl border border-neutral-200 bg-white pl-2 pr-2.5 text-sm shadow-sm hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
      >
        {/* Avatar */}
        <span className="grid size-6 place-items-center rounded-full bg-neutral-200 text-[10px] font-bold text-neutral-700">
          {initials}
        </span>
        <span className="hidden md:flex">Hesabım</span>
        <svg
          className={`size-4 text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`}
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
            <div className="text-sm font-semibold text-neutral-800 truncate">
              {name}
            </div>
            <div className="mt-0.5 text-xs text-neutral-500 truncate">
              {data!.user!.email}
            </div>
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
                <path fill="currentColor" d="M3 6h18v2H3zm0 5h18v2H3zm0 5h12v2H3z"/>
              </svg>
              Hesap Bilgileri
            </Link>

            <Link
              prefetch={false}
              role="menuitem"
              href="/billing"
              className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
            >
              <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                <path
                  fill="currentColor"
                  fillRule="evenodd"
                  d="M2.25 6.75A2.25 2.25 0 0 1 4.5 4.5h15a2.25 2.25 0 0 1 2.25 2.25v.75H2.25v-.75Zm0 3.75h19.5v6a2.25 2.25 0 0 1-2.25 2.25h-15A2.25 2.25 0 0 1 2.25 16.5v-6Z"
                  clipRule="evenodd"
                />
                <path fill="currentColor" d="M5 14.25h7.5v1.5H5z" />
              </svg>
              Ödeme Bilgileri
            </Link>

            {isSuper && (
              <Link
                prefetch={false}
                role="menuitem"
                href="/admin/users"
                className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
              >
                <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                  <path fill="currentColor" d="M3 4h18v2H3zm0 14h18v2H3zM5 8h14v8H5z"/>
                </svg>
                Kullanıcı Yönetimi
              </Link>
            )}
          </div>

          <div className="h-px bg-neutral-100" />

          <div className="p-2">
            <button
              role="menuitem"
              onClick={() => signOut({ callbackUrl: "/auth/login" })}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                <path fill="currentColor" d="M10 17v-2h4v2h-4zm1-14h2v8h-2V3zM5 21h14v-2H5v2z"/>
              </svg>
              Çıkış
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
