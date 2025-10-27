// app/api/admin/users/[id]/billing/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { requireSuperAdmin } from "@/app/lib/requireSuperAdmin";

export const runtime = "nodejs";

// --- küçük yardımcılar ---
function toPlainInvoice(inv: any) {
  return {
    id: inv.id,
    createdAt: inv.createdAt,
    status: inv.status,
    amount: Number(inv.amount ?? 0),
    currency: inv.currency,
    provider: inv.provider,
    paidAt: inv.paidAt,
    dueAt: inv.dueAt,
    providerInvoiceId: inv.providerInvoiceId ?? null,
  };
}

function toPlainSub(sub: any | null) {
  if (!sub) return null;
  return {
    plan: sub.plan as "FREE" | "PRO",
    status: sub.status as "trialing" | "active" | "past_due" | "canceled",
    provider: sub.provider,
    currentPeriodStart: sub.currentPeriodStart,
    currentPeriodEnd: sub.currentPeriodEnd,
    trialEndsAt: sub.trialEndsAt,
    cancelAtPeriodEnd: !!sub.cancelAtPeriodEnd,
    seats: sub.seats,
    seatLimit: sub.seatLimit,
    graceUntil: sub.graceUntil,
  };
}

/**
 * GET: Kullanıcı + bağlı tenant’lar (OWNER/MEMBER), abonelik & faturalar
 * Not: Next.js 15 → ctx.params bir Promise. Önce await et!
 */
export async function GET(_req: Request, ctx: any) {
  await requireSuperAdmin();

  const p = await ctx?.params;
  const userId = p?.id as string | undefined;
  if (!userId) {
    return NextResponse.json({ error: "missing_user_id" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      role: true,
      createdAt: true,
      // Sahibi olduğu tenantlar
      tenantsOwned: {
        select: {
          id: true,
          name: true,
          createdAt: true,
          subscriptions: {
            select: {
              plan: true,
              status: true,
              provider: true,
              currentPeriodStart: true,
              currentPeriodEnd: true,
              trialEndsAt: true,
              cancelAtPeriodEnd: true,
              seats: true,
              seatLimit: true,
              graceUntil: true,
            },
          },
          invoices: {
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              createdAt: true,
              status: true,
              amount: true,
              currency: true,
              provider: true,
              providerInvoiceId: true,
              paidAt: true,
              dueAt: true,
            },
            take: 100,
          },
        },
      },
      // Üyesi olduğu tenantlar
      memberships: {
        select: {
          role: true,
          createdAt: true,
          tenant: {
            select: {
              id: true,
              name: true,
              createdAt: true,
              subscriptions: {
                select: {
                  plan: true,
                  status: true,
                  provider: true,
                  currentPeriodStart: true,
                  currentPeriodEnd: true,
                  trialEndsAt: true,
                  cancelAtPeriodEnd: true,
                  seats: true,
                  seatLimit: true,
                  graceUntil: true,
                },
              },
              invoices: {
                orderBy: { createdAt: "desc" },
                select: {
                  id: true,
                  createdAt: true,
                  status: true,
                  amount: true,
                  currency: true,
                  provider: true,
                  providerInvoiceId: true,
                  paidAt: true,
                  dueAt: true,
                },
                take: 100,
              },
            },
          },
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Tek formatta birleştir
  const tenants: Array<{
    id: string;
    name: string;
    role: "OWNER" | "MEMBER";
    createdAt: Date;
    memberSince: Date;
    subscription: ReturnType<typeof toPlainSub>;
    invoices: ReturnType<typeof toPlainInvoice>[];
  }> = [];

  for (const m of user.memberships ?? []) {
  const t = m.tenant;
  tenants.push({
    id: t.id,
    name: t.name,
    role: "MEMBER",
    createdAt: t.createdAt,
    memberSince: m.createdAt, // ⬅️ asıl üyelik başlangıcı
    subscription: toPlainSub(t.subscriptions),
    invoices: (t.invoices ?? []).map(toPlainInvoice),
  });
}

for (const t of user.tenantsOwned ?? []) {
  tenants.push({
    id: t.id,
    name: t.name,
    role: "OWNER",
    createdAt: t.createdAt,
    memberSince: t.createdAt, // ⬅️ sahibi ise kurulum tarihi
    subscription: toPlainSub(t.subscriptions),
    invoices: (t.invoices ?? []).map(toPlainInvoice),
  });
}

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      isActive: user.isActive,
      role: user.role,
      createdAt: user.createdAt,
    },
    tenants,
  });
}

/**
 * PATCH: küçük yönetim işlemleri
 * body.op:
 *   - "toggleActive"              { active: boolean }
 *   - "setSubscription"           { tenantId, plan: "FREE"|"PRO", status?, trialDays?, periodEnd? }
 */
export async function PATCH(req: Request, ctx: any) {
  await requireSuperAdmin();

  const p = await ctx?.params;
  const userId = p?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "missing_user_id" }, { status: 400 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const op = String(body?.op ?? "");

  if (op === "toggleActive") {
    const active = !!body?.active;
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { isActive: active },
      select: { id: true, isActive: true },
    });
    return NextResponse.json({ ok: true, user: updated });
  }

  if (op === "setSubscription") {
    const tenantId = body?.tenantId as string | undefined;
    const plan = body?.plan as "FREE" | "PRO" | undefined;
    const status = body?.status as "trialing" | "active" | "past_due" | "canceled" | undefined;
    const trialDays = Number.isFinite(body?.trialDays) ? Math.trunc(Number(body.trialDays)) : undefined;
    const periodEnd = body?.periodEnd ? new Date(body.periodEnd) : undefined;

    if (!tenantId) return NextResponse.json({ error: "missing_tenant_id" }, { status: 400 });
    if (plan !== "FREE" && plan !== "PRO") return NextResponse.json({ error: "invalid_plan" }, { status: 400 });
    if (status && !["trialing", "active", "past_due", "canceled"].includes(status)) {
      return NextResponse.json({ error: "invalid_status" }, { status: 400 });
    }

    const now = new Date();
    const data: any = { plan };
    if (status) data.status = status;

    if (plan === "FREE") {
      data.currentPeriodEnd = null;
      if (status !== "trialing") data.trialEndsAt = null;
    } else {
      if (Number.isFinite(trialDays)) {
        data.trialEndsAt = new Date(now.getTime() + Math.max(0, trialDays!) * 24 * 60 * 60 * 1000);
      }
      if (periodEnd && !isNaN(periodEnd.getTime())) {
        data.currentPeriodEnd = periodEnd;
      }
    }

    const existing = await prisma.subscription.findUnique({ where: { tenantId } });
    if (!existing) {
      await prisma.subscription.create({
        data: {
          tenantId,
          provider: "manual",
          status: status ?? (plan === "FREE" ? "trialing" : "active"),
          ...data,
        },
      });
    } else {
      await prisma.subscription.update({
        where: { tenantId },
        data,
      });
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "invalid_op" }, { status: 400 });
}
