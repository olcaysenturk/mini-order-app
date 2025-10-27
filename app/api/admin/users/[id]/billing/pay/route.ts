import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { requireSuperAdmin } from "@/app/lib/requireSuperAdmin";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";

// Helpers
function startOfMonth(d: Date) {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfMonth(y: number, m1_12: number) {
  // m1_12: 1..12  (örn: Ekim = 10)
  const last = new Date(y, m1_12, 0);
  last.setHours(23, 59, 59, 999);
  return last;
}

const PRICE_TRY = new Prisma.Decimal(2000); // ✅ 2000₺

// Next 15: ctx.params Promise, await etmeliyiz
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await requireSuperAdmin();

  const { id } = await ctx.params;
  const tenantId = id; // Bu endpointte :id'yi tenantId olarak kabul ediyoruz

  if (!tenantId) {
    return NextResponse.json({ error: "missing_tenant_id" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({} as any));
  const y = Number(body?.year);
  const m1 = Number(body?.month); // 1..12

  if (!Number.isInteger(y) || !Number.isInteger(m1) || m1 < 1 || m1 > 12) {
    return NextResponse.json({ error: "invalid_year_month" }, { status: 400 });
  }

  // Abonelik (tenantId unique)
  let sub = await prisma.subscription.findUnique({ where: { tenantId } });

  if (!sub) {
    // Abonelik yoksa FREE/trialing oluştur
    sub = await prisma.subscription.create({
      data: {
        tenantId,
        plan: "FREE",
        status: "trialing",
        provider: "manual",
        currentPeriodStart: null,
        currentPeriodEnd: null,
        trialEndsAt: null,
      },
    });
  }

  // Bu ödeme ayının dönem başlangıç/bitişleri
  const periodStart = startOfMonth(new Date(y, m1 - 1, 1));
  const periodEnd = endOfMonth(y, m1);

  // Aynı aya ait paid fatura var mı? (dueAt ayın sonu olacak)
  const alreadyPaid = await prisma.invoice.findFirst({
    where: {
      tenantId,
      status: "paid",
      dueAt: { gte: new Date(y, m1 - 1, 1), lte: periodEnd },
    },
    select: { id: true },
  });
  if (alreadyPaid) {
    return NextResponse.json({ error: "already_paid" }, { status: 409 });
  }

  // Fatura oluştur (paid)
  const now = new Date();
  await prisma.invoice.create({
    data: {
      tenantId,
      subscriptionId: sub.id,
      status: "paid",
      amount: PRICE_TRY,     // ✅ 2000₺
      currency: "TRY",
      provider: "manual",
      raw: { year: y, month: m1, via: "admin_users_pay" },
      paidAt: now,
      dueAt: periodEnd,      // ✅ ay sonu
    },
  });

  // Aboneliği bu aya sabitle
  await prisma.subscription.update({
    where: { id: sub.id },
    data: {
      status: "active",
      provider: "manual",
      trialEndsAt: null,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd, // ✅ örn: 31 Ekim 23:59:59
    },
  });

  // Güncel durum döndür (UI hemen yenilesin)
  const fresh = await prisma.subscription.findUnique({ where: { id: sub.id } });
  const invoices = await prisma.invoice.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json({
    ok: true,
    subscription: fresh,
    invoices: invoices.map(i => ({ ...i, amount: Number(i.amount) })),
  });
}
