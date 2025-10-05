import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { requireSuperAdmin } from "@/app/lib/requireSuperAdmin";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: any) {
  await requireSuperAdmin();
  const { id: userId } = await ctx.params;

  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");
  const mode = (searchParams.get("mode") ?? "now").toLowerCase(); // "now" | "period_end"

  if (!tenantId) {
    return NextResponse.json({ error: "tenant_required" }, { status: 400 });
  }

  const now = new Date();

  if (mode === "period_end") {
    // Dönem sonunda pasifleştir: sadece işaretle
    await prisma.subscription.upsert({
      where: { tenantId },
      update: {
        cancelAtPeriodEnd: true,
      },
      create: {
        tenantId,
        plan: "PRO", // yoksa bile default varsayalım; istersen "FREE" yapma
        status: "active",
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        cancelAtPeriodEnd: true,
        seats: await prisma.membership.count({ where: { tenantId } }),
      },
    });

    return NextResponse.redirect(
      new URL(`/admin/users/${userId}/billing?canceled=period_end&tenant=${tenantId}`, req.url),
    );
  }

  // mode === "now" → anında pasif
  await prisma.subscription.upsert({
    where: { tenantId },
    update: {
      status: "canceled",
      cancelAtPeriodEnd: false,
      currentPeriodEnd: now,
    },
    create: {
      tenantId,
      plan: "PRO",
      status: "canceled",
      cancelAtPeriodEnd: false,
      currentPeriodStart: now,
      currentPeriodEnd: now,
      seats: await prisma.membership.count({ where: { tenantId } }),
    },
  });

  return NextResponse.redirect(
    new URL(`/admin/users/${userId}/billing?canceled=now&tenant=${tenantId}`, req.url),
  );
}
