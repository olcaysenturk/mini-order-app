// app/billing/BillingClient.tsx
"use client";

import { useState, useCallback } from "react";
import { Calendar, Check, CreditCard, Lock, Clock, X } from "lucide-react";

type Status = "paid" | "unpaid";
type MonthCard = {
  key: string;
  label: string;
  status: Status;
  priceText: string;
};
type RecentPayment = {
  id: string;
  monthKey: string;
  amountText: string;
  dateText: string;
};

type Props = {
  daysLeft: number;
  nextDueText: string;
  priceText: string;
  months: MonthCard[];
  recent: RecentPayment[];
};

export default function BillingClient({
  daysLeft,
  nextDueText,
  priceText,
  months,
  recent,
}: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [pendingMonth, setPendingMonth] = useState<string | null>(null);
  const [successOpen, setSuccessOpen] = useState(false);
  const [successMonthKey, setSuccessMonthKey] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const closeSuccess = useCallback(() => {
    setSuccessOpen(false);
    setSuccessMonthKey(null);
  }, []);

  const submitMonth = useCallback(async (monthKey: string) => {
    setErrorMsg(null);
    setPendingMonth(monthKey);
    setIsLoading(true);

    try {
      const res = await fetch("/api/billing/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthKey }),
      });

      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "İstek başarısız");
      }

      // Başarılı → popup aç, konfeti at
      setSuccessMonthKey(monthKey);
      setSuccessOpen(true);

    } catch (err: any) {
      setErrorMsg(err?.message || "Bilinmeyen hata");
    } finally {
      setIsLoading(false);
      setPendingMonth(null);
    }
  }, []);

  return (
    <main className="mx-auto max-w-7xl p-6">
      {/* ======== Header ======== */}
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Faturalandırma</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Ay bazında ödemelerini yönet — ödenmiş aylar kilitlidir.
          </p>
        </div>

        {/* Özet Çipi */}
        <div className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-2 shadow-sm">
          <Clock className="h-4 w-4 opacity-70" aria-hidden />
          <span className="text-sm text-neutral-600">Sonraki vade:</span>
          <strong className="text-sm">{nextDueText}</strong>
          <span className="text-neutral-300">•</span>
          <span className="text-sm">
            <span className="text-neutral-600">Kalan</span>{" "}
            <strong>{daysLeft} gün</strong>
          </span>
        </div>
      </header>

      {/* Hata bandı */}
      {errorMsg && (
        <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">
          {errorMsg}
        </div>
      )}

      {/* ======== 8 / 4 grid ======== */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* SOL (8 col): kartlar + aylar */}
        <div className="lg:col-span-8 space-y-6">
          {/* Üst Bilgi Kartları */}
          <section className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-indigo-600" aria-hidden />
                <div>
                  <p className="text-sm text-neutral-500">Aylık ücret</p>
                  <p className="text-lg font-medium">{priceText}</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-indigo-600" aria-hidden />
                <div>
                  <p className="text-sm text-neutral-500">Plan</p>
                  <p className="text-lg font-medium">PRO</p>
                </div>
              </div>
            </div>
          </section>

          {/* Aylar Grid */}
          <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold">Aylar</h2>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {months.map((m) => {
                const isPaid = m.status === "paid";
                const submitting = pendingMonth === m.key;

                return (
                  <div
                    key={m.key}
                    className={`group relative overflow-hidden rounded-2xl border p-5 transition
                      ${isPaid ? "border-neutral-200 bg-neutral-50" : "border-neutral-200 bg-white hover:shadow-md"}`}
                  >
                    {/* Status Badge */}
                    <div className="absolute right-3 top-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium
                          ${isPaid ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
                      >
                        {isPaid ? (
                          <>
                            <Check className="h-3.5 w-3.5" />
                            Ödendi
                          </>
                        ) : (
                          <>Ödenmedi</>
                        )}
                      </span>
                    </div>

                    {/* Month label */}
                    <div className="pr-20">
                      <div className="text-sm text-neutral-500">{m.key}</div>
                      <div className="text-base font-medium">{m.label}</div>
                    </div>

                    {/* Price row */}
                    <div className="mt-3 flex items-center justify-between rounded-xl bg-neutral-50 px-3 py-2 text-sm">
                      <span>Tutar</span>
                      <strong>{m.priceText}</strong>
                    </div>

                    {/* Button */}
                    <button
                      type="button"
                      disabled={isPaid || submitting}
                      onClick={() => submitMonth(m.key)}
                      className={`mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium transition
                        focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
                        ${
                          isPaid
                            ? "cursor-not-allowed border-neutral-300 bg-neutral-200 text-neutral-500"
                            : "border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700"
                        } ${submitting ? "opacity-70" : ""}`}
                      aria-disabled={isPaid || submitting}
                    >
                      {isPaid ? (
                        <>
                          <Lock className="h-4 w-4" aria-hidden />
                          Bu ay ödenmiş
                        </>
                      ) : submitting ? (
                        <>
                          <span className="size-4 rounded-full border-2 border-white/50 border-t-white animate-spin" />
                          Gönderiliyor…
                        </>
                      ) : (
                        <>
                          <CreditCard className="h-4 w-4" aria-hidden />
                          Öde
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* SAĞ (4 col): Geçmiş Ödemeler */}
        <aside className="lg:col-span-4">
          <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold">Son Ödemeler</h2>
            <div className="mt-3 divide-y">
              {recent.length === 0 && (
                <p className="text-sm text-neutral-600">Henüz ödeme kaydı yok.</p>
              )}
              {recent.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex size-2 rounded-full bg-emerald-500" aria-hidden />
                    <span className="font-medium">{p.monthKey}</span>
                    <span className="text-neutral-500">• {p.dateText}</span>
                  </div>
                  <div className="font-medium">{p.amountText}</div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>

      {/* ======= Loading Overlay (blur + popup kart) ======= */}
      {isLoading && (
        <div
          className="fixed inset-0 z-[60] grid place-items-center bg-black/30 backdrop-blur-sm"
          aria-hidden="true"
        >
          <div className="w-[92vw] max-w-sm rounded-2xl bg-white/90 shadow-2xl ring-1 ring-black/5 p-6">
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                <div className="size-6 rounded-full border-2 border-neutral-300 border-t-indigo-600 animate-spin" />
              </div>
              <div>
                <div className="text-base font-semibold">Talebiniz gönderiliyor…</div>
                <div className="mt-1 text-sm text-neutral-600">Lütfen bekleyin.</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======= Success Modal (modern popup + soft confetti background) ======= */}
      {successOpen && (
        <div
          className="fixed inset-0 z-[70] grid place-items-center bg-black/30 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="billing-success-title"
        >
          <div className="relative w-[92vw] max-w-md overflow-hidden rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/5">
            {/* soft confetti blobs */}
            <div className="pointer-events-none absolute inset-0 -z-0">
              <div className="absolute -left-6 -top-6 size-24 rounded-full bg-indigo-100 animate-[pulse_3s_ease-in-out_infinite]" />
              <div className="absolute -right-6 -bottom-6 size-24 rounded-full bg-emerald-100 animate-[pulse_4s_ease-in-out_infinite]" />
            </div>

            <div className="relative z-10">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex size-8 items-center justify-center rounded-full bg-emerald-100">
                  <Check className="h-5 w-5 text-emerald-700" />
                </span>
                <div className="me-6">
                  <h3 id="billing-success-title" className="text-lg font-semibold">
                    Talebiniz alındı!
                  </h3>
                  <p className="mt-1 text-sm text-neutral-600">
                    {successMonthKey
                      ? `${successMonthKey} dönemi için ödeme talebiniz alınmıştır, en kısa sürede size dönüş yapacağız.`
                      : "Ödeme talebiniz alınmıştır, en kısa sürede size dönüş yapacağız."}
                  </p>
                </div>
                <button
                  onClick={closeSuccess}
                  className="ms-auto rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100"
                  aria-label="Kapat"
                  title="Kapat"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  onClick={closeSuccess}
                  className="inline-flex h-9 items-center justify-center rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  Tamam
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
