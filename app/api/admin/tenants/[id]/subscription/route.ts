import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { requireSuperAdmin } from "@/app/lib/requireSuperAdmin";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    await requireSuperAdmin(); // süper admin koruması varsa

    const { id: tenantId } = await ctx.params;
    const body = await req.json();
    const plan = (body?.plan as "FREE" | "PRO") ?? null;

    if (!tenantId) {
      return NextResponse.json({ error: "missing_tenant" }, { status: 400 });
    }
    if (!plan) {
      return NextResponse.json({ error: "missing_plan" }, { status: 400 });
    }

    const now = new Date();

    // FREE -> 5 gün trial
    // PRO  -> active (örnek olarak 1 ay sonrasını period end yaptım; istersen 1 yıl yap)
    let status: "trialing" | "active" | "past_due" | "canceled";
    let currentPeriodStart: Date | null = now;
    let currentPeriodEnd: Date | null = null;
    let trialEndsAt: Date | null = null;

    if (plan === "FREE") {
      status = "trialing";
      trialEndsAt = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
      currentPeriodEnd = trialEndsAt;
    } else {
      status = "active";
      const end = new Date(now);
      end.setMonth(end.getMonth() + 1); // aylık örnek; yıllık istersen setFullYear(end.getFullYear()+1)
      currentPeriodEnd = end;
      trialEndsAt = null;
    }

    const sub = await prisma.subscription.upsert({
      where: { tenantId },
      create: {
        tenantId,
        plan,
        status,
        provider: "manual",
        currentPeriodStart,
        currentPeriodEnd,
        trialEndsAt,
        cancelAtPeriodEnd: false,
      },
      update: {
        plan,
        status,
        currentPeriodStart,
        currentPeriodEnd,
        trialEndsAt,
        cancelAtPeriodEnd: false,
      },
    });

    return NextResponse.json({
      ok: true,
      subscription: {
        plan: sub.plan,
        status: sub.status,
        currentPeriodStart: sub.currentPeriodStart,
        currentPeriodEnd: sub.currentPeriodEnd,
        trialEndsAt: sub.trialEndsAt,
      },
    });
  } catch (e: any) {
    console.error("PATCH /admin/tenants/:id/subscription error:", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
