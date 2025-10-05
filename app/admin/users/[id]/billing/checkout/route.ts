// app/admin/users/[id]/billing/checkout/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { requireSuperAdmin } from "@/app/lib/requireSuperAdmin";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: any) {
  await requireSuperAdmin();

  // Next 15'te params bazen Promise; await ikisinde de güvenli
  const { id: userId } = await ctx.params;

  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");
  const plan = (searchParams.get("plan") ?? "PRO").toUpperCase();

  if (!tenantId) {
    return NextResponse.json({ error: "tenant_required" }, { status: 400 });
  }

  const seats = await prisma.membership.count({ where: { tenantId } });

  const now = new Date();
  const next30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  await prisma.subscription.upsert({
    where: { tenantId },
    update: {
      plan: plan as any,
      status: "active",
      currentPeriodStart: now,
      currentPeriodEnd: next30,
      seats,
    },
    create: {
      tenantId,
      plan: plan as any,
      status: "active",
      currentPeriodStart: now,
      currentPeriodEnd: next30,
      seats,
    },
  });

  const redirectTo = new URL(`/admin/users/${userId}/billing?pro=ok&tenant=${tenantId}`, req.url);
  return NextResponse.redirect(redirectTo);
}
