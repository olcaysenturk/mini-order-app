// app/billing/page.tsx
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
import BillingClient from "./BillingClient";

export const dynamic = "force-dynamic";

/** Kaç ay listelensin — içinde bulunulan aydan başlayarak */
const MONTH_SPAN = 12;

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
      billingNextDueAt: true,
      billingPaidForMonth: true,
      monthlyPriceCents: true,
      email: true,
    },
  });

  const now = new Date();
  const price = user?.monthlyPriceCents ?? 200000; // kuruş
  const priceText = tryIntlCurrency(price, "TRY");
  const nextDue = user?.billingNextDueAt ?? addMonths(startOfMonth(now), 1);
  const daysLeft = Math.max(0, daysBetween(now, nextDue));

  // Ay listesi (grid)
  const start = startOfMonth(now);
  const keys = Array.from({ length: MONTH_SPAN }, (_, i) =>
    formatMonthKey(addMonths(start, i))
  );

  // Bu aralıktaki ödenmiş aylar
  const paidMonths = await prisma.payment.findMany({
    where: { userId: session.user.id, monthKey: { in: keys } },
    select: { monthKey: true },
  });
  const paidSet = new Set(paidMonths.map((p) => p.monthKey));

  const months: MonthCard[] = keys.map((key, idx) => {
    const d = addMonths(start, idx);
    const label = d.toLocaleDateString("tr-TR", { year: "numeric", month: "long" });
    const status: Status = paidSet.has(key) ? "paid" : "unpaid";
    return { key, label, status, priceText };
  });

  // Son ödemeler (sağ kolon)
  const recentRaw = await prisma.payment.findMany({
    where: { userId: session.user.id },
    orderBy: { paidAt: "desc" },
    take: 6,
    select: { id: true, monthKey: true, amount: true, paidAt: true, status: true },
  });
  const recent: RecentPayment[] = recentRaw.map((p) => ({
    id: p.id,
    monthKey: p.monthKey,
    amountText: tryIntlCurrency(p.amount ?? 0, "TRY"),
    dateText: new Date(p.paidAt).toLocaleDateString("tr-TR"),
  }));

  return (
    <BillingClient
      daysLeft={daysLeft}
      nextDueText={nextDue.toLocaleDateString("tr-TR")}
      priceText={priceText}
      months={months}
      recent={recent}
    />
  );
}
