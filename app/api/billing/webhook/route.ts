import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";

export async function POST(req: NextRequest) {
  // Not: Provider imza doğrulamasını burada yapmalısın.
  const body = await req.json();
  const type = body?.type as string | undefined;

  try {
    switch (type) {
      case "invoice.paid": {
        const { tenantId, amount, currency, providerInvoiceId, periodEnd } =
          body.data ?? {};
        // DB'yi güncelle
        await prisma.invoice.create({
          data: {
            tenantId,
            amount,
            currency: currency ?? "TRY",
            status: "paid",
            provider: body.provider ?? "manual",
            providerInvoiceId,
            paidAt: new Date(),
            raw: body,
          } as any,
        });
        await prisma.subscription.update({
          where: { tenantId },
          data: {
            status: "active",
            currentPeriodEnd: periodEnd ? new Date(periodEnd) : undefined,
            graceUntil: null,
          },
        });
        break;
      }
      case "invoice.payment_failed": {
        const { tenantId } = body.data ?? {};
        await prisma.subscription.update({
          where: { tenantId },
          data: {
            status: "past_due",
            graceUntil: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          }, // 3 gün grace
        });
        break;
      }
      case "customer.subscription.deleted": {
        const { tenantId } = body.data ?? {};
        await prisma.subscription.update({
          where: { tenantId },
          data: { status: "canceled" },
        });
        break;
      }
      default:
        // unknown type: ignore
        break;
    }
  } catch (e) {
    console.error("billing webhook error", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
