'use client';

import { useSession, signOut } from 'next-auth/react';
import { useMemo } from 'react';
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

  const meta = useMemo(() => {
    return {
      impersonatorId: data?.impersonatorId ?? null,
      impersonatedAt: data?.impersonatedAt ?? null,
      who: `${data?.user?.name ?? 'Kullanıcı'} (${data?.user?.email ?? '—'})`,
    };
  }, [data?.impersonatorId, data?.impersonatedAt, data?.user?.name, data?.user?.email]);

  if (!isImp) return null;

  return (
    <div className="sticky print:hidden top-0 z-[100] w-full bg-amber-100/95 text-amber-900 border-b border-amber-300 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-3 py-2 text-sm">
        <div className="min-w-0">
          <div className="font-semibold">İMPERSONATION MODU</div>
          <div className="mt-0.5 truncate">
            Şu an <b>{meta.who}</b> olarak oturum açık.
            {meta.impersonatedAt ? (
              <span className="ms-2 opacity-80">Başlangıç: {timeAgoTR(meta.impersonatedAt)}</span>
            ) : null}
          </div>
          {meta.impersonatorId ? (
            <div className="mt-0.5 opacity-80">
              Başlatan admin: <code className="rounded bg-amber-200 px-1">{meta.impersonatorId}</code>
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/dashboard/admin"
            className="inline-flex h-8 items-center rounded-lg border border-amber-300 bg-white/80 px-3 hover:bg-white"
            title="Yönetim panelini aç"
          >
            Admin Paneli
          </Link>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/auth/login' })}
            className="inline-flex h-8 items-center rounded-lg bg-rose-600 px-3 text-white hover:bg-rose-700"
            title="İmpersonation modundan çık"
          >
            Çıkış yap
          </button>
        </div>
      </div>
    </div>
  );
}
