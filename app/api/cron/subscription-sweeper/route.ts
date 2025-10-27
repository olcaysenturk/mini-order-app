// app/api/cron/subscription-sweeper/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const now = new Date();

  // FREE trial bitenleri iptal et
  const freeExpired = await prisma.subscription.updateMany({
    where: {
      plan: "FREE",
      status: "trialing",
      trialEndsAt: { lt: now },
    },
    data: { status: "canceled" },
  });

  // PRO dönemi geçmişleri past_due
  const proPastDue = await prisma.subscription.updateMany({
    where: {
      plan: "PRO",
      status: { in: ["active", "trialing"] },
      currentPeriodEnd: { lt: now },
    },
    data: { status: "past_due" },
  });

  return NextResponse.json({
    ok: true,
    freeCanceled: freeExpired.count,
    proPastDue: proPastDue.count,
  });
}
