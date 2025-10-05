import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/app/lib/db";


export async function POST(req: NextRequest) {
const session = await getServerSession(authOptions);
const tenantId = (session as any)?.tenantId as string | undefined;
if (!tenantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });


const { plan } = await req.json().catch(() => ({ plan: "PRO" }));
const sub = await prisma.subscription.upsert({
where: { tenantId },
update: { plan },
create: { tenantId, plan, status: "trialing", currentPeriodStart: new Date(), currentPeriodEnd: new Date() },
});


// TODO: Burada ödeme servisinde (Stripe/İyzico/PayTR) checkout oturumu oluştur.
// Örn: const url = await createCheckoutOnProvider({ tenantId, plan, seats })
const url = `/settings/billing?mock=1`;
return NextResponse.json({ url });
}