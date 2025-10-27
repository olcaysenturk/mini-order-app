// app/lib/requireActiveTenant.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/app/lib/db";

type Ok = { tenantId: string };
type Block = { response: NextResponse };

export async function requireActiveTenant(req: NextRequest): Promise<Ok | Block> {
  const session = await getServerSession(authOptions);
  const tenantId = (session as any)?.tenantId as string | null;
  if (!tenantId) {
    return { response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }

  const sub = await prisma.subscription.findUnique({
    where: { tenantId },
    select: {
      plan: true,
      status: true,
      trialEndsAt: true,
      currentPeriodEnd: true,
      cancelAtPeriodEnd: true,
    },
  });

  // Abonelik yoksa: pasif say
  if (!sub) {
    return { response: NextResponse.json({ error: "inactive" }, { status: 402 }) };
  }

  const now = new Date();

  if (sub.plan === "FREE") {
    // FREE: 5 günlük deneme bitti mi?
    if (sub.status === "trialing" && sub.trialEndsAt && sub.trialEndsAt < now) {
      await prisma.subscription.update({
        where: { tenantId },
        data: { status: "canceled" }, // pasife çek
      });
      return { response: NextResponse.json({ error: "trial_expired", plan: "FREE" }, { status: 402 }) };
    }
    if (sub.status === "canceled") {
      return { response: NextResponse.json({ error: "inactive", plan: "FREE" }, { status: 402 }) };
    }
    // FREE + trial devam ediyorsa erişim ver
    return { tenantId };
  }

  // PRO: dönem bitti mi?
  const expired =
    !!sub.currentPeriodEnd && sub.currentPeriodEnd < now && sub.status !== "canceled";

  if (expired) {
    if (sub.status !== "past_due") {
      await prisma.subscription.update({
        where: { tenantId },
        data: { status: "past_due" },
      });
    }
    return { response: NextResponse.json({ error: "payment_required", plan: "PRO" }, { status: 402 }) };
  }

  // PRO aktif
  return { tenantId };
}
