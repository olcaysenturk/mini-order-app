import { prisma } from "@/app/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { redirect } from "next/navigation";

export async function ensureSubscriptionRow(tenantId: string) {
  const sub = await prisma.subscription.findUnique({ where: { tenantId } });
  if (sub) return sub;
  // Yeni tenant için başlangıç: trialing + FREE plan (veya doğrudan PRO'ya yönlendirme)
  return prisma.subscription.create({
    data: {
      tenantId,
      plan: "FREE",
      status: "trialing",
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 gün trial örneği
      seats: 1,
    },
  });
}

export async function getActiveSubscription(tenantId: string) {
  return prisma.subscription.findUnique({ where: { tenantId } });
}

export function isSubscriptionActive(sub: {
  status: string;
  currentPeriodEnd: Date | null;
  graceUntil: Date | null;
}) {
  const now = new Date();
  if (!sub) return false as any;
  if (sub.status === "active" || sub.status === "trialing") return true;
  if (sub.status === "past_due" && sub.graceUntil && sub.graceUntil > now)
    return true; // grace içinde
  return false;
}

export async function requireActiveSubscription() {
  const session = await getServerSession(authOptions);
  const tenantId = (session as any)?.tenantId as string | undefined;
  if (!tenantId) redirect("/auth/login");

  const sub = await prisma.subscription.findUnique({ where: { tenantId } });
  if (!sub || !isSubscriptionActive(sub as any)) {
    redirect("/settings/billing?needPayment=1");
  }
  return sub;
}

export async function countSeats(tenantId: string) {
  // Üyelik sayısını koltuk (seat) olarak yorumla
  const seats = await prisma.membership.count({ where: { tenantId } });
  return seats;
}
export function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

export function formatMonthKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function parseMonthKey(key: string) {
  // "YYYY-MM" -> Date (month start)
  const [y, m] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, 1);
}

export function daysBetween(a: Date, b: Date) {
  const MS = 24 * 60 * 60 * 1000;
  return Math.ceil((startOfDay(b).getTime() - startOfDay(a).getTime()) / MS);
}

export function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function tryIntlCurrency(amountCents: number, currency = "TRY") {
  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency,
    }).format(amountCents / 100);
  } catch {
    return `${(amountCents / 100).toFixed(2)} ${currency}`;
  }
}
