// app/(dashboard)/billing/page.tsx
import { prisma } from "@/app/lib/db";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { getServerSession } from "next-auth";
import {
  addMonths,
  daysBetween,
  formatMonthKey,
  startOfMonth,
  tryIntlCurrency,
} from "@/app/lib/billing";
import { payForMonth } from "./actions";
import { Calendar, Check, CreditCard, Lock, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

/** Kaç ay listelensin — içinde bulunulan aydan başlayarak */
const MONTH_SPAN = 12;

export default async function BillingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-semibold">Faturalandırma</h1>
        <p className="mt-2 text-neutral-600">Devam etmek için giriş yapın.</p>
      </main>
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      // billingPlan: true, // migration sonrası aktif edebiliriz
      billingNextDueAt: true,
      billingPaidForMonth: true,
      monthlyPriceCents: true,
      email: true,
    },
  });

  const now = new Date();
  const price = user?.monthlyPriceCents ?? 200000; // kuruş
  const nextDue = user?.billingNextDueAt ?? addMonths(startOfMonth(now), 1);
  const daysLeft = Math.max(0, daysBetween(now, nextDue));

  // Ay listesi (grid)
  const start = startOfMonth(now);
  const months = Array.from({ length: MONTH_SPAN }, (_, i) => addMonths(start, i));
  const keys = months.map((d) => formatMonthKey(d));

  // Bu aralıktaki ödenmiş aylar
  const paidMonths = await prisma.payment.findMany({
    where: { userId: session.user.id, monthKey: { in: keys } },
    select: { monthKey: true },
  });
  const paidSet = new Set(paidMonths.map((p) => p.monthKey));

  // Son ödemeler
  const recent = await prisma.payment.findMany({
    where: { userId: session.user.id },
    orderBy: { paidAt: "desc" },
    take: 6,
    select: { id: true, monthKey: true, amount: true, paidAt: true, status: true },
  });

  return (
    <main className="mx-auto max-w-6xl p-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
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
          <strong className="text-sm">
            {nextDue.toLocaleDateString("tr-TR")}
          </strong>
          <span className="text-neutral-300">•</span>
          <span className="text-sm">
            <span className="text-neutral-600">Kalan</span>{" "}
            <strong>{daysLeft} gün</strong>
          </span>
        </div>
      </header>

      {/* Üst Bilgi Kartları */}
      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-indigo-600" aria-hidden />
            <div>
              <p className="text-sm text-neutral-500">Aylık ücret</p>
              <p className="text-lg font-medium">{tryIntlCurrency(price, "TRY")}</p>
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

      {/* Aylar Grid (Select YOK) */}
      <section className="mt-8 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold">Aylar</h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {months.map((d) => {
            const key = formatMonthKey(d);
            const isPaid = paidSet.has(key);
            const label = d.toLocaleDateString("tr-TR", {
              year: "numeric",
              month: "long",
            });

            return (
              <form
                key={key}
                action={payForMonth}
                className={`group relative overflow-hidden rounded-2xl border p-5 transition
                  ${isPaid ? "border-neutral-200 bg-neutral-50" : "border-neutral-200 bg-white hover:shadow-md"}`}
              >
                <input type="hidden" name="monthKey" value={key} />

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
                  <div className="text-sm text-neutral-500">{key}</div>
                  <div className="text-base font-medium">{label}</div>
                </div>

                {/* Price row */}
                <div className="mt-3 flex items-center justify-between rounded-xl bg-neutral-50 px-3 py-2 text-sm">
                  <span>Tutar</span>
                  <strong>{tryIntlCurrency(price, "TRY")}</strong>
                </div>

                {/* Button */}
                <button
                  type="submit"
                  disabled={isPaid}
                  className={`mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium transition
                    focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
                    ${
                      isPaid
                        ? "cursor-not-allowed border-neutral-300 bg-neutral-200 text-neutral-500"
                        : "border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700"
                    }`}
                  aria-disabled={isPaid}
                >
                  {isPaid ? (
                    <>
                      <Lock className="h-4 w-4" aria-hidden />
                      Bu ay ödenmiş
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4" aria-hidden />
                      Öde
                    </>
                  )}
                </button>
              </form>
            );
          })}
        </div>
      </section>

      {/* Geçmiş Ödemeler */}
      <section className="mt-8 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
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
                <span className="text-neutral-500">
                  • {new Date(p.paidAt).toLocaleDateString("tr-TR")}
                </span>
              </div>
              <div className="font-medium">{tryIntlCurrency(p.amount, "TRY")}</div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
