import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { requireSuperAdmin } from "@/app/lib/requireSuperAdmin";

export const runtime = "nodejs";

function monthStart(y: number, m1to12: number) {
  return new Date(y, m1to12 - 1, 1, 0, 0, 0, 0);
}
function nextMonthStart(y: number, m1to12: number) {
  return m1to12 === 12 ? monthStart(y + 1, 1) : monthStart(y, m1to12 + 1);
}

export async function POST(req: NextRequest) {
  await requireSuperAdmin();

  const { tenantId, year, month, amount } = await req.json();

  const y = parseInt(String(year ?? ""));
  const m = parseInt(String(month ?? ""));
  if (!tenantId || !Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  // İlgili subscription (varsa)
  const sub = await prisma.subscription.findUnique({
    where: { tenantId: String(tenantId) },
    select: { id: true, plan: true },
  });

  // İlgili ay aralığı
  const from = monthStart(y, m);
  const to = nextMonthStart(y, m);

  // Önceden fatura var mı?
  const existing = await prisma.invoice.findFirst({
    where: {
      tenantId: String(tenantId),
      dueAt: { gte: from, lt: to },
    },
    select: { id: true, status: true },
  });

  if (!existing) {
    // yoksa oluşturup ödenmiş yap
    await prisma.invoice.create({
      data: {
        tenantId: String(tenantId),
        subscriptionId: sub?.id ?? null,
        status: "paid",
        amount: amount != null ? amount : 0,
        currency: "TRY",
        provider: "manual",
        dueAt: from,
        paidAt: new Date(),
      },
    });
  } else {
    // varsa güncelle
    await prisma.invoice.update({
      where: { id: existing.id },
      data: {
        status: "paid",
        paidAt: new Date(),
      },
    });
  }

  return NextResponse.json({ ok: true });
}
