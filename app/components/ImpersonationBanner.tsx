'use client';

import { useSession, signOut } from 'next-auth/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

function timeAgoTR(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  const sec = Math.max(1, Math.floor(diff / 1000));
  const min = Math.floor(sec / 60);
  const hour = Math.floor(min / 60);
  const day = Math.floor(hour / 24);
  if (day > 0) return `${day} gün önce`;
  if (hour > 0) return `${hour} saat önce`;
  if (min > 0) return `${min} dk önce`;
  return `${sec} sn önce`;
}

export default function ImpersonationBanner() {
  const { data } = useSession();
  const isImp = !!data?.isImpersonated;
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const meta = useMemo(() => {
    return {
      impersonatorId: data?.impersonatorId ?? null,
      impersonatedAt: data?.impersonatedAt ?? null,
      who: `${data?.user?.name ?? 'Kullanıcı'} (${data?.user?.email ?? '—'})`,
    };
  }, [data?.impersonatorId, data?.impersonatedAt, data?.user?.name, data?.user?.email]);

  useEffect(() => {
    if (!isImp) return;

    const onClickOutside = (event: MouseEvent) => {
      if (!wrapRef.current) return;
      const target = event.target as Node | null;
      if (target && !wrapRef.current.contains(target)) {
        setOpen(false);
      }
    };

    const onEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEsc);
    };
  }, [isImp]);

  if (!isImp) return null;

  return (
    <div ref={wrapRef} className="fixed right-3 top-[72px] z-[95] print:hidden sm:right-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex size-10 items-center justify-center rounded-full border border-amber-300 bg-amber-100/95 text-amber-900 shadow-sm backdrop-blur hover:bg-amber-100"
        aria-expanded={open}
        aria-controls="impersonation-panel"
        aria-label="Impersonation detaylarını aç"
        title="Impersonation modu"
      >
        <span className="relative inline-flex">
          <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
            <path
              fill="currentColor"
              d="M12 2l7 3v6c0 5-3.4 9.7-7 11c-3.6-1.3-7-6-7-11V5l7-3zm0 2.2L7 6.1V11c0 4.1 2.6 8 5 9.1c2.4-1.1 5-5 5-9.1V6.1l-5-1.9z"
            />
          </svg>
          <span className="absolute -right-1 -top-1 inline-flex size-2.5 rounded-full bg-amber-600 ring-2 ring-amber-100" />
        </span>
      </button>

      {open ? (
        <div
          id="impersonation-panel"
          className="mt-2 w-[min(92vw,380px)] rounded-2xl border border-amber-300 bg-white p-3 text-sm text-neutral-800 shadow-xl"
        >
          <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">Aktif Oturum</div>
          <div className="mt-1 font-medium text-neutral-900">{meta.who}</div>
          {meta.impersonatedAt ? (
            <div className="mt-1 text-xs text-neutral-600">Başlangıç: {timeAgoTR(meta.impersonatedAt)}</div>
          ) : null}
          {meta.impersonatorId ? (
            <div className="mt-1 text-xs text-neutral-600">
              Başlatan admin: <code className="rounded bg-neutral-100 px-1">{meta.impersonatorId}</code>
            </div>
          ) : null}

          <div className="mt-3 flex items-center gap-2">
            <Link
              href="/dashboard/admin"
              className="inline-flex h-8 items-center rounded-lg border border-neutral-200 bg-white px-3 text-xs hover:bg-neutral-50"
              title="Yönetim panelini aç"
            >
              Admin Paneli
            </Link>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: '/auth/login' })}
              className="inline-flex h-8 items-center rounded-lg bg-rose-600 px-3 text-xs font-medium text-white hover:bg-rose-700"
              title="İmpersonation modundan çık"
            >
              Çıkış yap
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
