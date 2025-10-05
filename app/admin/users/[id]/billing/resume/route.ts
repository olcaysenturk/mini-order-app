import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { requireSuperAdmin } from "@/app/lib/requireSuperAdmin";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: any) {
  await requireSuperAdmin();
  const { id: userId } = await ctx.params;

  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");
  if (!tenantId) {
    return NextResponse.json({ error: "tenant_required" }, { status: 400 });
  }

  const now = new Date();
  const next30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const seats = await prisma.membership.count({ where: { tenantId } });

  await prisma.subscription.upsert({
    where: { tenantId },
    update: {
      status: "active",
      cancelAtPeriodEnd: false,
      currentPeriodStart: now,
      currentPeriodEnd: next30,
      seats,
    },
    create: {
      tenantId,
      plan: "PRO",
      status: "active",
      cancelAtPeriodEnd: false,
      currentPeriodStart: now,
      currentPeriodEnd: next30,
      seats,
    },
  });

  return NextResponse.redirect(
    new URL(`/admin/users/${userId}/billing?resumed=1&tenant=${tenantId}`, req.url),
  );
}
