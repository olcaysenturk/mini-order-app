// app/dashboard/billing/BillingClient.tsx
"use client";

import { useState, useCallback, ReactNode } from "react";
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

      setSuccessMonthKey(monthKey);
      setSuccessOpen(true);
    } catch (err: any) {
      setErrorMsg(err?.message || "Bilinmeyen hata");
    } finally {
      setIsLoading(false);
      setPendingMonth(null);
    }
  }, []);

  const paidCount = months.filter((m) => m.status === "paid").length;
  const unpaidCount = months.length - paidCount;
  const nextPayable = months.find((m) => m.status === "unpaid");
  const summaryCards = [
    {
      label: "Plan",
      value: "PRO",
      helper: `Aylık ücret ${priceText}`,
      tone: "indigo" as const,
    },
    {
      label: "Ödenen Ay",
      value: paidCount,
      helper: `Son ${months.length} ay`,
      tone: "emerald" as const,
    },
    {
      label: "Bekleyen Ay",
      value: unpaidCount,
      helper: nextPayable ? `${nextPayable.label} sırada` : "Hepsi ödendi",
      tone: "amber" as const,
    },
    {
      label: "Vade",
      value: nextDueText,
      helper: `${daysLeft} gün kaldı`,
      tone: "rose" as const,
    },
  ];

  const quickPayDisabled = !nextPayable || pendingMonth === nextPayable.key;
  const handleQuickPay = useCallback(() => {
    if (!nextPayable) return;
    submitMonth(nextPayable.key);
  }, [nextPayable, submitMonth]);

  const scrollToRecent = useCallback(() => {
    document.getElementById("recent-payments")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <main className="mx-auto max-w-7xl space-y-8 p-4 sm:p-6">
      <section className="relative overflow-hidden rounded-3xl border border-neutral-200 bg-white/90 shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(79,70,229,0.18),transparent_55%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.18),transparent_55%)]" />
        <div className="relative z-10 grid gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div className="space-y-5">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-100">
              Faturalandırma • Control Panel
            </span>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
                Ödemelerinizi yönetin
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-neutral-600">
                Ay bazında ödeme talepleri oluşturun, kalan günleri görün ve son işlemlere hızla erişin.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-600">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 font-medium text-neutral-800 shadow-sm shadow-black/5 ring-1 ring-white/70">
                <Clock className="h-3.5 w-3.5 text-indigo-600" aria-hidden /> Sonraki vade {nextDueText}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-neutral-900/80 px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm">
                {daysLeft} gün kaldı
              </span>
              {nextPayable && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                  Sıradaki ay: {nextPayable.label}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleQuickPay}
                disabled={quickPayDisabled}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pendingMonth === nextPayable?.key ? (
                  <>
                    <span className="size-4 rounded-full border-2 border-white/50 border-t-white animate-spin" />
                    Talep gönderiliyor…
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4" aria-hidden />
                    {nextPayable ? `${nextPayable.label} için öde` : "Tüm aylar ödendi"}
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={scrollToRecent}
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/70 bg-white/80 px-4 text-sm font-semibold text-neutral-800 shadow-sm transition hover:bg-white"
              >
                <Calendar className="h-4 w-4 text-indigo-600" aria-hidden />
                Son ödemelere git
              </button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {summaryCards.map((card) => (
              <HeroStat key={card.label} {...card} />
            ))}
          </div>
        </div>
      </section>

      {errorMsg && (
        <div className="rounded-3xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm text-rose-700 shadow-sm">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <section className="grid gap-4 sm:grid-cols-2">
            <InfoCard
              icon={<CreditCard className="h-5 w-5 text-indigo-600" aria-hidden />}
              label="Aylık Ücret"
              value={priceText}
              helper="KDV dahil standart tutar"
            />
            <InfoCard
              icon={<Calendar className="h-5 w-5 text-indigo-600" aria-hidden />}
              label="Plan"
              value="PRO"
              helper="Tüm premium özellikler açık"
            />
          </section>

          <section className="rounded-3xl border border-neutral-200 bg-white/95 p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-neutral-900">Aylar</h2>
                <p className="text-xs text-neutral-500">
                  Ödenmiş aylar kilitlenir, diğerleri için talep gönderebilirsiniz.
                </p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-3 py-1 text-[11px] font-semibold text-neutral-700 ring-1 ring-neutral-200">
                {months.length} ay görüntüleniyor
              </span>
            </div>

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

                    <div className="pr-20">
                      <div className="text-sm text-neutral-500">{m.key}</div>
                      <div className="text-base font-medium">{m.label}</div>
                    </div>

                    <div className="mt-3 flex items-center justify-between rounded-xl bg-neutral-50 px-3 py-2 text-sm">
                      <span>Tutar</span>
                      <strong>{m.priceText}</strong>
                    </div>

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

        <aside className="lg:col-span-4">
          <section
            id="recent-payments"
            className="rounded-3xl border border-neutral-200 bg-white/95 p-5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-neutral-900">Son Ödemeler</h2>
                <p className="text-xs text-neutral-500">En güncel tahsilatlar burada listelenir.</p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                {recent.length} kayıt
              </span>
            </div>
            <div className="mt-3 divide-y divide-neutral-100">
              {recent.length === 0 && (
                <p className="py-4 text-sm text-neutral-600">Henüz ödeme kaydı yok.</p>
              )}
              {recent.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-3 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex size-2 rounded-full bg-emerald-500" aria-hidden />
                    <div>
                      <div className="font-semibold text-neutral-900">{p.monthKey}</div>
                      <div className="text-xs text-neutral-500">{p.dateText}</div>
                    </div>
                  </div>
                  <div className="font-semibold text-neutral-800">{p.amountText}</div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>

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

      {successOpen && (
        <div
          className="fixed inset-0 z-[70] grid place-items-center bg-black/30 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="billing-success-title"
        >
          <div className="relative w-[92vw] max-w-md overflow-hidden rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/5">
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

function HeroStat({
  label,
  value,
  helper,
  tone,
}: {
  label: string;
  value: string | number;
  helper: string;
  tone: "indigo" | "emerald" | "amber" | "rose";
}) {
  const toneClass =
    tone === "emerald"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : tone === "amber"
      ? "bg-amber-50 text-amber-700 ring-amber-200"
      : tone === "rose"
      ? "bg-rose-50 text-rose-700 ring-rose-200"
      : "bg-indigo-50 text-indigo-700 ring-indigo-200";

  return (
    <div className={`rounded-2xl bg-white/75 px-4 py-3 text-sm shadow-sm ring-1 ${toneClass}`}>
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
      <div className="mt-1 text-[11px] text-neutral-500">{helper}</div>
    </div>
  );
}

function InfoCard({
  icon,
  label,
  value,
  helper,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-3xl border border-neutral-200 bg-white/95 p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="inline-flex size-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
          {icon}
        </div>
        <div>
          <p className="text-sm text-neutral-500">{label}</p>
          <p className="text-lg font-medium text-neutral-900">{value}</p>
          <p className="text-xs text-neutral-500">{helper}</p>
        </div>
      </div>
    </div>
  );
}
