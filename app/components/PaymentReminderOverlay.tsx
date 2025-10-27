// components/PaymentNoticeOverlay.tsx
"use client";

import { useEffect, useRef } from "react";

type Props = {
  open: boolean;
  onClose: () => void;              // ✅ zorunlu kapatma callback'i
  periodLabel: string;              // "Ekim 2025"
  amount: number;                   // 2000
  currency?: string;                // "TRY" ya da "₺"
  daysLeft?: number | null;         // 6
  dueDate?: string | Date | null;   // "2025-10-31"
  supportHref?: string;             // "/support"
};

export default function PaymentNoticeOverlay({
  open,
  onClose,
  periodLabel,
  amount,
  currency = "TRY",
  daysLeft,
  dueDate,
  supportHref = "/support",
}: Props) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const backdropRef = useRef<HTMLDivElement | null>(null);

  // Body scroll kilidi
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // ESC ile kapat
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const fmtMoney = new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format;

  const fmtDateTR = (v?: string | Date | null) => {
    if (!v) return null;
    const d = v instanceof Date ? v : new Date(v);
    if (isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(d);
  };

  const duePretty = fmtDateTR(dueDate);

  // Backdrop tıklamasıyla kapat
  const onBackdropMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === backdropRef.current) onClose();
  };

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[100] grid place-items-center bg-black/50 backdrop-blur-sm p-4"
      onMouseDown={onBackdropMouseDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-title"
      aria-describedby="payment-desc"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-md rounded-2xl bg-white/80 backdrop-blur-md p-6 shadow-xl ring-1 ring-black/5"
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <path
                fill="currentColor"
                d="M3 6h18a2 2 0 0 1 2 2v1H1V8a2 2 0 0 1 2-2m-2 6v4a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2v-4zM4 16h6v2H4z"
              />
            </svg>
          </div>
          <div className="min-w-0">
            <h2 id="payment-title" className="text-lg font-semibold tracking-tight text-neutral-900">
              Abonelik Bildirimi
            </h2>
            <p id="payment-desc" className="mt-1 text-sm leading-6 text-neutral-700">
              <strong>{periodLabel}</strong> dönemine ait abonelik ücretiniz{" "}
              <strong>
                {fmtMoney(amount)} {currency}
              </strong>{" "}
              olarak beklemede. Çevrimiçi ödeme adımı şu an devre dışıdır.
            </p>
            {(daysLeft !== null && daysLeft !== undefined) || duePretty ? (
              <p className="mt-1 text-xs text-neutral-500">
                {daysLeft !== null && daysLeft !== undefined ? (
                  <>
                    Kalan gün: <strong>{daysLeft}</strong>
                  </>
                ) : null}
                {daysLeft !== null && daysLeft !== undefined && duePretty ? " • " : null}
                {duePretty ? (
                  <>
                    Son ödeme tarihi: <strong>{duePretty}</strong>
                  </>
                ) : null}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 active:scale-[.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300"
          >
            Tamam
          </button>

          <a
            href={supportHref}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 active:scale-[.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            Destek ile İletişim
          </a>
        </div>
      </div>
    </div>
  );
}
